import {
  claimTask,
  cronMatches,
  expireDueApprovals,
  isPaused,
  minuteKey,
  runTask,
  setStateOnce,
  type Policy,
  type Queryable,
  type TaskHandler,
} from "@boma/core";
import type { TelegramGateway } from "@boma/connectors";
import { eveningReport, morningBrief } from "./chief/briefs";
import type { ChiefOfStaff } from "./chief/chief";
import type { Notifier } from "./chief/notifier";

/**
 * The single worker process (CLAUDE.md stack): claims and runs tasks, fires Sydney-time
 * schedules, expires approvals, and long-polls Telegram. Each loop is a testable tick.
 */

export interface WorkerDeps {
  db: Queryable;
  policy: Policy;
  chief: ChiefOfStaff;
  notify: Notifier;
  handlers: TaskHandler[];
  gateway?: TelegramGateway;
  workerId: string;
  tz: string;
  schedules?: { cron: string; name: "morning_brief" | "evening_report" }[];
}

export class Worker {
  private running = false;
  private handlerByKind: Map<string, TaskHandler>;

  constructor(private deps: WorkerDeps) {
    this.handlerByKind = new Map(deps.handlers.map((h) => [h.kind, h]));
  }

  /** Claim and run at most one task. Returns true if a task ran. */
  async engineTick(): Promise<boolean> {
    if (await isPaused(this.deps.db)) return false; // E2: nothing new starts while paused
    const task = await claimTask(this.deps.db, this.deps.workerId, [...this.handlerByKind.keys()]);
    if (!task) return false;
    await runTask(this.deps.db, task, this.handlerByKind.get(task.kind)!, {
      workerId: this.deps.workerId,
      onEvent: (e) => this.deps.chief.onTaskEvent(e),
    });
    return true;
  }

  /** Fire due schedules once per matching minute (Australia/Sydney, DST-safe). */
  async scheduleTick(now = new Date()): Promise<string[]> {
    const fired: string[] = [];
    const schedules = this.deps.schedules ?? [
      { cron: "30 7 * * *", name: "morning_brief" as const },
      { cron: "0 18 * * *", name: "evening_report" as const },
    ];
    for (const s of schedules) {
      if (!cronMatches(s.cron, now, this.deps.tz)) continue;
      if (
        !(await setStateOnce(
          this.deps.db,
          `schedule:${s.name}:${minuteKey(now, this.deps.tz)}`,
          true,
        ))
      )
        continue;
      const text =
        s.name === "morning_brief"
          ? await morningBrief(this.deps.db, this.deps.policy, this.deps.tz, now)
          : await eveningReport(this.deps.db, this.deps.policy, this.deps.tz, now);
      await this.deps.notify.send(text);
      fired.push(s.name);
    }
    return fired;
  }

  async maintenanceTick(now = new Date()): Promise<void> {
    await this.deps.chief.onExpiredApprovals(await expireDueApprovals(this.deps.db, now));
    await this.deps.chief.sendUnsentApprovals();
  }

  async start(): Promise<void> {
    this.running = true;
    const loop = async (name: string, fn: () => Promise<unknown>, idleMs: number) => {
      while (this.running) {
        try {
          const busy = await fn();
          if (busy !== true) await sleep(idleMs);
        } catch (err) {
          console.error(`[${name}] ${(err as Error).message}`);
          await sleep(Math.max(idleMs, 5_000));
        }
      }
    };
    const loops = [
      loop("engine", () => this.engineTick(), 2_000),
      loop("schedule", () => this.scheduleTick(), 20_000),
      loop("maintenance", () => this.maintenanceTick(), 60_000),
    ];
    if (this.deps.gateway)
      loops.push(loop("telegram", () => this.deps.gateway!.pollOnce(25), 1_000));
    await Promise.all(loops);
  }

  stop(): void {
    this.running = false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
