import { connect } from "./client";
import { migrateDown, migrateUp } from "./migrate";

const [cmd, arg] = process.argv.slice(2);
const client = await connect();
try {
  if (cmd === "up") {
    const applied = await migrateUp(client);
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Nothing to apply.");
  } else if (cmd === "down") {
    const steps = arg === "--all" ? Infinity : Number(arg ?? 1);
    const undone = await migrateDown(client, steps);
    console.log(undone.length ? `Rolled back: ${undone.join(", ")}` : "Nothing to roll back.");
  } else {
    console.error("Usage: db up | db down [n|--all]");
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
