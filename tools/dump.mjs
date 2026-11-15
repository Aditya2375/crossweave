import { run, rolling } from "../web/src/model.js";
import { cases } from "../tests/cases.mjs";
console.log(
  JSON.stringify(
    cases.map((p) => {
      const r = run(p);
      return {
        ...r,
        rolling: r.matrix.flatMap((row, i) =>
          row.map((_, j) => rolling(r, i, j)),
        ),
      };
    }),
  ),
);
