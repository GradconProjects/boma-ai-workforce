import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAKE } from "../packages/core/src/fixtures";
import { filesToScan, scan } from "./secret-scan";

describe("G0.5 secret scan", () => {
  it("finds no secrets in any committed or about-to-be-committed file", () => {
    const files = filesToScan();
    expect(files).toContain(".env.example");
    expect(scan(files)).toEqual([]);
  });

  it("flags a file containing a secret, without printing it", () => {
    const dir = mkdtempSync(join(tmpdir(), "scan-"));
    const file = join(dir, "leak.ts");
    writeFileSync(file, `const key = "${FAKE.anthropicKey}";\n`);
    const hits = scan([file]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.join("\n")).not.toContain(FAKE.anthropicKey);
  });
});
