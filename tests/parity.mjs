import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { run, rolling } from "../web/src/model.js";
import { cases } from "./cases.mjs";
let n = 0,
  max = 0;
function cmp(a, b) {
  if (a === null || b === null) {
    assert.equal(a, b);
    n++;
    return;
  }
  if (Array.isArray(a)) {
    assert.equal(a.length, b.length);
    a.forEach((v, k) => cmp(v, b[k]));
    return;
  }
  const e = Math.abs(a - b) / Math.max(1, Math.abs(a));
  max = Math.max(max, e);
  assert.ok(e < 2e-12, `${a} vs ${b}`);
  n++;
}
for (const p of cases) {
  const z = spawnSync(
    process.env.JAVA || "java",
    [
      "-cp",
      "build/classes",
      "Dump",
      p.scenario,
      p.window + "",
      p.end + "",
      p.seed + "",
    ],
    { encoding: "utf8", maxBuffer: 5000000 },
  );
  assert.equal(z.status, 0, z.stderr);
  const a = JSON.parse(z.stdout),
    b = run(p);
  cmp(a.data, b.data);
  cmp(
    a.matrix,
    b.matrix.flatMap((row) => row.map(Object.values)),
  );
  cmp(
    a.baseline,
    b.baseline.flatMap((row) => row.map(Object.values)),
  );
  cmp(
    a.rolling,
    b.matrix.flatMap((row, i) => row.map((_, j) => rolling(b, i, j))),
  );
}
console.log(`${n} Java/JS full-value checks; max scaled difference ${max}`);
