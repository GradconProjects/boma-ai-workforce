import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadPolicy } from "@boma/core";
import { migrateUp } from "@boma/db";
import { createTempDb, SKIP_DB } from "../../db/src/testdb";
import { loadBotFile } from "./load";
import { syncBot } from "./sync";
import { ROOT, variant } from "./testutil";

const policy = loadPolicy(fileURLToPath(new URL("config/policy.yaml", ROOT)));
const chiefPath = fileURLToPath(new URL("bots/chief-of-staff.md", ROOT));

describe.skipIf(SKIP_DB)("bot sync to bot_versions", () => {
  let client: pg.Client;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    const db = await createTempDb();
    drop = db.drop;
    client = new pg.Client({ connectionString: db.url });
    await client.connect();
    await migrateUp(client);
  });

  afterAll(async () => {
    await client?.end();
    await drop?.();
  });

  it("creates v1, skips unchanged files, and adds v2 on edit", async () => {
    const bot = loadBotFile(chiefPath);
    expect(await syncBot(client, bot, policy)).toMatchObject({ status: "created", version: 1 });
    expect(await syncBot(client, bot, policy)).toMatchObject({ status: "unchanged", version: 1 });

    const edited = variant("bots/chief-of-staff.md", (fm) => (fm.purpose = "Edited purpose."));
    expect(await syncBot(client, edited, policy)).toMatchObject({ status: "updated", version: 2 });

    const { rows } = await client.query(
      `select v.version, v.created_by, v.frontmatter->>'purpose' as purpose
         from bots b join bot_versions v on v.id = b.current_version_id where b.slug = 'chief-of-staff'`,
    );
    expect(rows[0]).toEqual({ version: 2, created_by: "git-sync", purpose: "Edited purpose." });
  });

  it("never syncs a file that fails lint", async () => {
    const bad = variant("bots/facebook-page-poster.md", (fm) => (fm.actions.delete_live_post = 5));
    const r = await syncBot(client, bad, policy);
    expect(r.status).toBe("rejected");
    const { rows } = await client.query("select 1 from bots where slug = 'facebook-page-poster'");
    expect(rows).toHaveLength(0);
  });
});
