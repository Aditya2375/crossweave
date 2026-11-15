import { run, rolling, NAMES } from "./model.js";
const $ = (s) => document.querySelector(s),
  by = (id) => document.getElementById(id),
  el = (tag, text) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  };
const fmt = (x, d = 2) =>
    x === null ? "NA" : (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d),
  signed = (x) => (x === null ? "NA" : `${x >= 0 ? "+" : ""}${fmt(x)}`);
let active = null,
  ix = 0,
  iy = 1;
for (const id of ["pair-x", "pair-y"])
  NAMES.forEach((name, i) => {
    const n = el("option", name);
    n.value = String(i);
    by(id).append(n);
  });
by("pair-y").value = "1";
function color(r) {
  if (r === null) return "#e4e0e9";
  const a = [245, 243, 248],
    b = r < 0 ? [222, 169, 136] : [172, 154, 212],
    t = Math.abs(r);
  return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * t)).join(",")})`;
}
function heatmap(r) {
  const table = by("heatmap"),
    caption = el("caption", "Pearson r · same observations in every cell"),
    head = el("thead"),
    tr = el("tr");
  tr.append(el("th", "Signal"));
  NAMES.forEach((n) => {
    const th = el("th", n[0]);
    th.scope = "col";
    th.title = n;
    tr.append(th);
  });
  head.append(tr);
  const body = el("tbody");
  r.matrix.forEach((row, i) => {
    const tr = el("tr"),
      th = el("th", NAMES[i][0]);
    th.scope = "row";
    th.title = NAMES[i];
    tr.append(th);
    row.forEach((q, j) => {
      const td = el("td"),
        b = el("button", fmt(q.r));
      b.type = "button";
      b.dataset.i = String(i);
      b.dataset.j = String(j);
      b.dataset.r = String(q.r);
      b.style.backgroundColor = color(q.r);
      b.className = q.r === null ? "na" : "";
      b.setAttribute(
        "aria-label",
        `${NAMES[i]} versus ${NAMES[j]}, Pearson r ${q.r === null ? "undefined, constant signal" : fmt(q.r, 6)}`,
      );
      b.addEventListener("click", () => select(i, j));
      td.append(b);
      tr.append(td);
    });
    body.append(tr);
  });
  table.replaceChildren(caption, head, body);
}
function select(i, j) {
  ix = i;
  iy = j;
  by("pair-x").value = String(i);
  by("pair-y").value = String(j);
  pairView(active);
}
function svg(tag, attrs = {}, text) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text !== undefined) n.textContent = text;
  return n;
}
function chart(id, title) {
  const n = by(id),
    w = Math.max(260, Math.round(n.getBoundingClientRect().width)),
    h = id === "scatter" ? 290 : 275;
  n.setAttribute("viewBox", `0 0 ${w} ${h}`);
  n.replaceChildren(svg("title", {}, title));
  return { n, w, h, left: 48, right: w - 17, top: 22, bottom: h - 49 };
}
function axes(c, xmin, xmax, ymin, ymax, xlabel, ylabel) {
  const x = (v) => c.left + ((v - xmin) / (xmax - xmin)) * (c.right - c.left),
    y = (v) => c.bottom - ((v - ymin) / (ymax - ymin)) * (c.bottom - c.top);
  for (let k = 0; k < 3; k++) {
    const f = k / 2,
      a = xmin + (xmax - xmin) * f,
      b = ymin + (ymax - ymin) * f;
    c.n.append(
      svg("line", {
        x1: c.left,
        y1: y(b),
        x2: c.right,
        y2: y(b),
        stroke: "#d5cedf",
      }),
      svg(
        "text",
        { x: c.left - 7, y: y(b) + 4, "text-anchor": "end" },
        fmt(b, 1),
      ),
      svg(
        "text",
        {
          x: x(a),
          y: c.bottom + 22,
          "text-anchor": k === 0 ? "start" : k === 2 ? "end" : "middle",
        },
        Number.isInteger(xmin) &&
          Number.isInteger(xmax) &&
          xlabel === "Window end"
          ? String(Math.round(a))
          : fmt(a, 1),
      ),
    );
  }
  c.n.append(
    svg("text", { x: c.left, y: 12 }, ylabel),
    svg("text", { x: c.right, y: c.h - 5, "text-anchor": "end" }, xlabel),
  );
  return { x, y };
}
function range(a) {
  let lo = Math.min(...a),
    hi = Math.max(...a);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  } else {
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
  }
  return [lo, hi];
}
function charts(r) {
  const p = r.input,
    start = p.end - p.window,
    xs = r.data[ix].slice(start, p.end),
    ys = r.data[iy].slice(start, p.end),
    label = `${NAMES[ix]} × ${NAMES[iy]}`;
  const c = chart(
      "scatter",
      `${label}: ${p.window} paired unitless observations, ${start + 1} through ${p.end}`,
    ),
    a = axes(
      c,
      ...range(xs),
      ...range(ys),
      NAMES[ix][0] + " / units",
      NAMES[iy][0] + " / units",
    );
  xs.forEach((v, k) =>
    c.n.append(
      svg("circle", {
        cx: a.x(v),
        cy: a.y(ys[k]),
        r: 3.1,
        fill: "#534189",
        "fill-opacity": 0.58,
      }),
    ),
  );
  const d = chart(
      "rolling",
      `${label}: trailing ${p.window}-point Pearson r by window end`,
    ),
    b = axes(d, p.window, 240, -1, 1, "Window end", "Pearson r"),
    values = rolling(r, ix, iy);
  let path = "";
  values.forEach((v, k) => {
    if (v !== null) {
      path += `${path ? " L" : "M"}${b.x(k + p.window)},${b.y(v)}`;
    }
  });
  d.n.append(
    svg("line", {
      x1: d.left,
      y1: b.y(0),
      x2: d.right,
      y2: b.y(0),
      stroke: "#93879e",
      "stroke-dasharray": "3 4",
    }),
  );
  if (p.scenario === "flip")
    d.n.append(
      svg("line", {
        x1: b.x(120.5),
        y1: d.top,
        x2: b.x(120.5),
        y2: d.bottom,
        stroke: "#854724",
        "stroke-dasharray": "5 4",
      }),
    );
  if (path) {
    d.n.append(
      svg("path", {
        d: path,
        fill: "none",
        stroke: "#534189",
        "stroke-width": 2,
      }),
    );
    const now = r.matrix[ix][iy].r;
    d.n.append(
      svg("line", {
        x1: b.x(p.end),
        y1: d.top,
        x2: b.x(p.end),
        y2: d.bottom,
        stroke: "#262130",
        "stroke-opacity": 0.3,
      }),
      svg("circle", {
        cx: b.x(p.end),
        cy: b.y(now),
        r: 5,
        fill: "#262130",
        stroke: "#f5f3f8",
        "stroke-width": 2,
      }),
    );
  } else
    d.n.append(
      svg(
        "text",
        {
          x: (d.left + d.right) / 2,
          y: (d.top + d.bottom) / 2,
          "text-anchor": "middle",
        },
        "NA · constant signal",
      ),
    );
}
function pairView(r) {
  const p = r.input,
    q = r.matrix[ix][iy],
    first = r.baseline[ix][iy],
    now = q.r,
    delta = now === null || first.r === null ? null : now - first.r;
  by("pair-title").textContent = `${NAMES[ix]} × ${NAMES[iy]}`;
  by("r-now").textContent = signed(now);
  by("r-first").textContent = signed(first.r);
  by("r-change").textContent = signed(delta);
  by("scatter-note").textContent =
    `${p.window} paired points · observations ${p.end - p.window + 1}-${p.end}. Both axes use invented, unitless values; axis ranges adapt to this pair and window.`;
  by("rolling-label").textContent =
    `${NAMES[ix][0]} × ${NAMES[iy][0]} · ${p.window}-point windows`;
  by("pair-message").textContent =
    now === null
      ? "Undefined, not uncorrelated. At least one selected signal is constant, so the standard-deviation denominator is zero."
      : ix === iy
        ? "A signal compared with itself has r = +1 when it varies. This diagonal is not evidence of a relationship between different signals."
        : ix === 4 || iy === 4
          ? "This pair includes the curved signal E. A small Pearson r can hide a nonlinear relationship. Read the scatter as well as the number."
          : p.scenario === "flip" &&
              ((ix === 1 && (iy === 0 || iy === 2)) ||
                (iy === 1 && (ix === 0 || ix === 2)))
            ? "B's link to A and C changes after observation 120. A window crossing that break mixes two different rules. This is a synthetic example, not a forecast."
            : "This is a finite-sample linear association. The sign, magnitude and first-window difference describe these invented observations, not causation or certainty.";
  by("heatmap")
    .querySelectorAll("button")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.i) === ix && Number(b.dataset.j) === iy),
      ),
    );
  by("stats-caption").textContent =
    `Applied window ${p.end - p.window + 1}-${p.end} · values rounded to six decimals`;
  by("x-col").textContent = NAMES[ix];
  by("y-col").textContent = NAMES[iy];
  const rows = [
      ["Sample mean", q.meanX, q.meanY],
      ["Sample standard deviation", q.sdX, q.sdY],
    ],
    body = by("stats-body");
  body.replaceChildren(
    ...rows.map(([name, x, y]) => {
      const tr = el("tr"),
        th = el("th", name);
      th.scope = "row";
      tr.append(th, el("td", fmt(x, 6)), el("td", fmt(y, 6)));
      return tr;
    }),
  );
  by("covariance").textContent =
    `Sample covariance: ${fmt(q.covariance, 6)} units². Pearson r: ${fmt(now, 6)}. First window: observations 1-${p.window}. Difference is current minus first-window r, not a percentage.`;
  charts(r);
}
function render(r) {
  by("window-label").textContent =
    `${r.input.end - r.input.window + 1}-${r.input.end} / 240`;
  heatmap(r);
  pairView(r);
}
function apply() {
  const ids = ["scenario", "window", "end", "seed"];
  ids.forEach((id) => by(id).removeAttribute("aria-invalid"));
  try {
    for (const id of ["end", "seed"])
      if (!by(id).value.trim())
        throw new Error(
          "Enter both a window end and a seed. The prior applied window is unchanged.",
        );
    const p = {
      scenario: by("scenario").value,
      window: Number(by("window").value),
      end: Number(by("end").value),
      seed: Number(by("seed").value),
    };
    const candidate = run(p);
    render(candidate);
    active = candidate;
    by("status").className = "";
    by("status").textContent =
      `Applied: ${p.scenario === "flip" ? "B flips after 120" : p.scenario === "flat" ? "F is constant" : "steady relationships"} · observations ${p.end - p.window + 1}-${p.end} · seed ${p.seed}.`;
    by("end").min = String(p.window);
  } catch (e) {
    by("status").className = "error";
    by("status").textContent =
      `${e.message} Prior applied values remain visible.`;
    ids.forEach((id) => by(id).setAttribute("aria-invalid", "true"));
  }
}
by("controls").addEventListener("submit", (e) => {
  e.preventDefault();
  apply();
});
for (const type of ["input", "change"])
  by("controls").addEventListener(type, () => {
    by("status").className = "dirty";
    by("status").textContent =
      "Not applied. The matrix and plots still show the prior applied window.";
  });
by("pair-x").addEventListener("change", () =>
  select(Number(by("pair-x").value), iy),
);
by("pair-y").addEventListener("change", () =>
  select(ix, Number(by("pair-y").value)),
);
let pending;
window.addEventListener("resize", () => {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    if (active) charts(active);
  });
});
apply();
