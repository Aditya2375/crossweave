import assert from "node:assert/strict";
import { pair, run, rolling, validate } from "../web/src/model.js";
import { cases } from "./cases.mjs";
let checks = 0;
const ok = (b) => {
  assert.ok(b);
  checks++;
};
for (const p of cases) {
  const r = run(p);
  r.matrix.forEach((row, i) =>
    row.forEach((q, j) => {
      ok(q.r === null || (Number.isFinite(q.r) && Math.abs(q.r) <= 1));
      ok(q.r === r.matrix[j][i].r);
      const z = rolling(r, i, j);
      ok(z[p.end - p.window] === q.r);
      ok(z.length === 241 - p.window);
      if (p.scenario === "flat" && (i === 5 || j === 5))
        ok(q.r === null && q.covariance === 0);
      const x = r.data[i].slice(p.end - p.window, p.end),
        y = r.data[j].slice(p.end - p.window, p.end);
      const shift = pair(
        x.map((a) => 3 * a + 11),
        y.map((a) => -2 * a + 4),
        0,
        p.window,
      );
      if (q.r !== null) ok(Math.abs(shift.r + q.r) < 1e-13);
    }),
  );
}
for (const k of ["seed", "window", "end"])
  for (const v of [NaN, Infinity, -1, 0, 1.5, 4294967296])
    assert.throws(() =>
      validate({ scenario: "flip", window: 80, end: 160, seed: 2026, [k]: v }),
    );
ok(Math.abs(pair([1, 2, 3], [3, 2, 1], 0, 3).r + 1) < 1e-14);
ok(pair([0.667, 0.667], [1, 2], 0, 2).r === null);
ok(pair([-2, -1, 0, 1, 2], [4, 1, 0, 1, 4], 0, 5).r === 0);
console.log(`${checks} domain/invariance/rolling checks passed`);
