import { loadPolicy } from "@boma/core";
import { connect } from "@boma/db";
import { lintBot } from "./lint";
import { BotFileError, listBotFiles, loadBotFile } from "./load";
import { syncBot } from "./sync";

const cmd = process.argv[2];
const policy = loadPolicy();
let failed = false;

const bots = listBotFiles().flatMap((path) => {
  try {
    return [loadBotFile(path)];
  } catch (err) {
    if (!(err instanceof BotFileError)) throw err;
    console.error(`✗ ${err.message}`);
    failed = true;
    return [];
  }
});

if (cmd === "validate") {
  for (const bot of bots) {
    const report = lintBot(bot, { policy });
    if (report.ok) console.log(`✓ ${bot.frontmatter.slug}`);
    else {
      failed = true;
      console.error(`✗ ${bot.frontmatter.slug}`);
      for (const e of report.errors) console.error(`    ${e.rule}: ${e.message}`);
    }
  }
} else if (cmd === "sync") {
  const client = await connect();
  try {
    for (const bot of bots) {
      const r = await syncBot(client, bot, policy);
      if (r.status === "rejected") {
        failed = true;
        console.error(`✗ ${r.slug} rejected:\n    ${r.errors.join("\n    ")}`);
      } else console.log(`✓ ${r.slug}: ${r.status} (v${r.version})`);
    }
  } finally {
    await client.end();
  }
} else {
  console.error("Usage: bots validate | bots sync");
  failed = true;
}

if (failed) process.exitCode = 1;
