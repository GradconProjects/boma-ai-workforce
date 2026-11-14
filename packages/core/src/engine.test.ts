import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { key, setupDb, SKIP_DB, type Fixture } from "../../../test/fixture";
import { createApproval, decideApproval, expireDueApprovals } from "./approvals";
import {
  budgetStatus,
  BudgetBlockedError,
  recordOwnerAdjustment,
  reconcile,
  reserve,
} from "./budget";
import { Halt, runTask, type TaskEvent, type TaskHandler } from "./runner";
import { isPaused, pauseAll, resumeAll } from "./state";
import { claimTask, createTask, getTask, transition } from "./tasks";

describe.skipIf(SKIP_DB)("task engine", () => {
  let fx: Fixture;
  beforeAll(async () => {
    fx = await setupDb();
  });
  afterAll(async () => fx?.close());

  const newTask = (kind: string, extra: Record<string, unknown> = {}) =>
    createTask(fx.pool, {
      bot: "chief-of-staff",
      kind,
      idempotencyKey: key(kind),
      actor: "system",
      ...extra,
    }).then((r) => r.task);

  it("pins the bot version and is idempotent on its key", async () => {
    const k = key("idem");
    const a = await createTask(fx.pool, {
      bot: "chief-of-staff",
      kind: "noop",
      idempotencyKey: k,
      actor: "owner",
    });
    const b = await createTask(fx.pool, {
      bot: "chief-of-staff",
      kind: "noop",
      idempotencyKey: k,
      actor: "owner",
    });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.task.id).toBe(a.task.id);
    expect(a.task.bot_version_id).toBeTruthy();
  });

  it("rejects transitions the lifecycle does not allow", async () => {
    const t = await newTask("noop");
    await expect(transition(fx.pool, t.id, "done", "system")).rejects.toThrow(/not allowed/);
  });

  it("E1: a worker killed mid-task resumes from its checkpoint without repeating steps", async () => {
    const t = await newTask("e1");
    const runs: string[] = [];
    let firstC = true;
    let cStarted!: () => void;
    const started = new Promise<void>((r) => (cStarted = r));
    const handler: TaskHandler = {
      kind: "e1",
      steps: ["a", "b", "c"].map((name) => ({
        name,
        run: async () => {
          runs.push(name);
          if (name === "c" && firstC) {
            firstC = false;
            cStarted();
            return new Promise(() => {}); // the process dies here: this run never continues
          }
          return `${name}-out`;
        },
      })),
    };

    const w1 = await claimTask(fx.pool, "worker-1", ["e1"]);
    expect(w1?.id).toBe(t.id);
    // Simulate a hard kill inside step c: abandon the run, nothing after this point executes.
    void runTask(fx.pool, w1!, handler, { workerId: "worker-1" });
    await started;

    // Another worker cannot take it while the lease is fresh...
    expect(await claimTask(fx.pool, "worker-2", ["e1"])).toBeNull();
    // ...but can once the dead worker's lease lapses.
    await fx.pool.query(
      "update tasks set locked_at = now() - interval '11 minutes' where id = $1",
      [t.id],
    );
    const w2 = await claimTask(fx.pool, "worker-2", ["e1"]);
    expect(w2?.status).toBe("running");
    expect(await runTask(fx.pool, w2!, handler, { workerId: "worker-2" })).toBe("done");

    expect(runs).toEqual(["a", "b", "c", "c"]); // a and b ran once; only the interrupted step re-ran
    const done = await getTask(fx.pool, t.id);
    expect(done.status).toBe("done");
    expect(done.outputs).toEqual({ a: "a-out", b: "b-out", c: "c-out" });
  });

  it("C6: a failing task is retried twice, then fails with the reason reported", async () => {
    const t = await newTask("flaky");
    const events: TaskEvent[] = [];
    const handler: TaskHandler = {
      kind: "flaky",
      steps: [
        { name: "boom", run: async () => Promise.reject(new Error("upstream returned 503")) },
      ],
    };
    for (let i = 0; i < 3; i++) {
      await fx.pool.query("update tasks set next_attempt_at = null where id = $1", [t.id]);
      const c = await claimTask(fx.pool, "w", ["flaky"]);
      expect(c?.id).toBe(t.id);
      await runTask(fx.pool, c!, handler, { workerId: "w", onEvent: (e) => void events.push(e) });
    }
    expect(events.map((e) => e.type)).toEqual(["task.retry", "task.retry", "task.failed"]);
    const failed = events[2] as Extract<TaskEvent, { type: "task.failed" }>;
    expect(failed.reason).toMatch(/503/);
    expect(failed.attempts).toBe(3);
    expect((await getTask(fx.pool, t.id)).status).toBe("failed");
    expect(await claimTask(fx.pool, "w", ["flaky"])).toBeNull();
  });

  it("a step can halt the pipeline at an approval checkpoint", async () => {
    const t = await newTask("halting");
    const handler: TaskHandler = {
      kind: "halting",
      steps: [
        { name: "draft", run: async () => "draft text" },
        { name: "await", run: async () => new Halt("awaiting_approval", "waiting for owner") },
        { name: "never", run: async () => expect.unreachable() },
      ],
    };
    const c = await claimTask(fx.pool, "w", ["halting"]);
    expect(await runTask(fx.pool, c!, handler, { workerId: "w" })).toBe("halted");
    expect((await getTask(fx.pool, t.id)).status).toBe("awaiting_approval");
  });

  it("E2/C4: /pause_all stops new actions within one tick and /resume restores state", async () => {
    const t1 = await newTask("pausable");
    const t2 = await newTask("pausable");
    await transition(fx.pool, t2.id, "running", "system");
    expect(await pauseAll(fx.pool, "owner")).toBeGreaterThanOrEqual(2);
    expect(await isPaused(fx.pool)).toBe(true);
    expect(await claimTask(fx.pool, "w", ["pausable"])).toBeNull(); // paused tasks are not claimable

    // A worker already mid-task stops before its next step.
    const ran: string[] = [];
    const handler: TaskHandler = {
      kind: "pausable",
      steps: [{ name: "s", run: async () => void ran.push("s") }],
    };
    expect(await runTask(fx.pool, { ...t1, status: "running" }, handler, { workerId: "w" })).toBe(
      "paused",
    );
    expect(ran).toEqual([]);

    await resumeAll(fx.pool, "owner");
    expect(await isPaused(fx.pool)).toBe(false);
    expect((await getTask(fx.pool, t1.id)).status).toBe("queued");
    expect((await getTask(fx.pool, t2.id)).status).toBe("running");
  });

  it("approvals bind to content, expire, and only pending ones can be decided", async () => {
    const t = await newTask("approval");
    await transition(fx.pool, t.id, "running", "system");
    const now = new Date();
    const a = await createApproval(fx.pool, {
      taskId: t.id,
      content: { text: "Hello", link: null },
      preview: { text: "Hello" },
      policy: fx.policy,
      actor: "bot:chief-of-staff",
      now,
    });
    expect(a.expires_at.getTime() - now.getTime()).toBe(72 * 3600_000);
    expect(await decideApproval(fx.pool, a.id, "approved")).toBe("approved");
    expect(await decideApproval(fx.pool, a.id, "rejected")).toBe("already_decided");
    expect((await getTask(fx.pool, t.id)).status).toBe("approved");

    const t2 = await newTask("approval");
    await transition(fx.pool, t2.id, "running", "system");
    await createApproval(fx.pool, {
      taskId: t2.id,
      content: { text: "x" },
      preview: {},
      policy: fx.policy,
      actor: "system",
      now,
    });
    expect(await expireDueApprovals(fx.pool, new Date(now.getTime() + 73 * 3600_000))).toBe(1);
    expect((await getTask(fx.pool, t2.id)).status).toBe("expired");
  });

  describe("budget gateway ledger", () => {
    const limits = { hardStopAud: 45, warnAud: 35 };

    it("reserves, reconciles to actual cost, and enforces scope and task limits", async () => {
      const t = await newTask("billable");
      const r = await reserve(fx.pool, {
        scope: "bot:chief-of-staff",
        taskId: t.id,
        provider: "anthropic",
        amountAud: 0.2,
        limits,
      });
      await reconcile(fx.pool, r, { amountAud: 0.05, tokensIn: 1000, tokensOut: 200 });
      const s = await budgetStatus(fx.pool, fx.policy);
      expect(s.byScope["bot:chief-of-staff"]).toBeCloseTo(0.05);
      expect(Number((await getTask(fx.pool, t.id)).actual_cost_aud)).toBeCloseTo(0.05);

      await expect(
        reserve(fx.pool, {
          scope: "bot:chief-of-staff",
          taskId: t.id,
          provider: "anthropic",
          amountAud: 0.3,
          limits: { ...limits, taskMaxAud: 0.3 },
        }),
      ).rejects.toMatchObject({ reason: "task_max" });
      await expect(
        reserve(fx.pool, {
          scope: "bot:chief-of-staff",
          provider: "anthropic",
          amountAud: 3,
          limits: { ...limits, scopeMonthlyAud: 3 },
        }),
      ).rejects.toMatchObject({ reason: "scope_monthly" });
    });

    it("E3: at A$45 committed, new billable work is blocked; zero-cost work continues", async () => {
      const before = await budgetStatus(fx.pool, fx.policy);
      await recordOwnerAdjustment(fx.pool, "bot:chief-of-staff", 45 - before.spentAud, "seed E3");
      const s = await budgetStatus(fx.pool, fx.policy);
      expect(s.spentAud).toBeCloseTo(45);
      expect(s.stopped).toBe(true);
      expect(s.warn).toBe(true);

      const err = await reserve(fx.pool, {
        scope: "dual-review",
        provider: "openai",
        amountAud: 0.001,
        limits,
      }).catch((e) => e);
      expect(err).toBeInstanceOf(BudgetBlockedError);
      expect(err.reason).toBe("company_hard_stop");

      // Monitoring / zero-cost work: tasks can still be created and the kill switch still works.
      await expect(newTask("status-check")).resolves.toBeTruthy();
      await pauseAll(fx.pool, "owner");
      expect(await isPaused(fx.pool)).toBe(true);
      await resumeAll(fx.pool, "owner");
    });
  });
});
