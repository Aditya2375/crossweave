export const NAMES = [
  "A · Anchor",
  "B · Follower",
  "C · Counter",
  "D · Mix",
  "E · Curve",
  "F · Solo",
];
export function validate(p) {
  if (
    !p ||
    !["flip", "steady", "flat"].includes(p.scenario) ||
    ![40, 80, 120].includes(p.window) ||
    !Number.isInteger(p.end) ||
    p.end < p.window ||
    p.end > 240 ||
    !Number.isInteger(p.seed) ||
    p.seed < 1 ||
    p.seed > 4294967295
  )
    throw new Error(
      "Use a listed model, a 40/80/120-point window, an integer end between the window length and 240, and a whole seed from 1 to 4,294,967,295.",
    );
}
export function generate(p) {
  validate(p);
  let state = p.seed >>> 0;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (((state >>> 0) / 4294967296) * 2 - 1) * Math.sqrt(3);
  };
  const d = Array.from({ length: 6 }, () => []);
  for (let t = 0; t < 240; t++) {
    const f = next(),
      a = next(),
      b = next(),
      c = next(),
      e = next(),
      h = next();
    d[0].push(f);
    d[1].push((p.scenario === "flip" && t >= 120 ? -0.8 : 0.8) * f + 0.6 * a);
    d[2].push(-0.6 * f + 0.8 * b);
    d[3].push(0.7 * c + 0.3 * a);
    d[4].push(f * f - 1 + 0.25 * e);
    d[5].push(p.scenario === "flat" ? 0 : h);
  }
  return d;
}
function sum(x) {
  let s = 0,
    c = 0;
  for (const a of x) {
    const y = a - c,
      t = s + y;
    c = t - s - y;
    s = t;
  }
  return s;
}
export function pair(x, y, start, end) {
  if (
    !x ||
    !y ||
    x.length !== y.length ||
    x.length > 240 ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end > x.length ||
    end - start < 2
  )
    throw new Error("Invalid series/window");
  const n = end - start,
    dx = [],
    dy = [];
  let cx = true,
    cy = true;
  for (let k = 0; k < n; k++) {
    const a = x[start + k],
      b = y[start + k];
    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      Math.abs(a) > 1e6 ||
      Math.abs(b) > 1e6
    )
      throw new Error("Invalid value");
    dx.push(a - x[start]);
    dy.push(b - y[start]);
    cx &&= a === x[start];
    cy &&= b === y[start];
  }
  const mx = sum(dx) / n,
    my = sum(dy) / n,
    xx = [],
    yy = [],
    xy = [];
  for (let k = 0; k < n; k++) {
    const a = dx[k] - mx,
      b = dy[k] - my;
    xx.push(a * a);
    yy.push(b * b);
    xy.push(a * b);
  }
  const sx = cx ? 0 : sum(xx),
    sy = cy ? 0 : sum(yy),
    cxy = cx || cy ? 0 : sum(xy),
    r =
      sx === 0 || sy === 0
        ? null
        : Math.max(-1, Math.min(1, cxy / (Math.sqrt(sx) * Math.sqrt(sy))));
  return {
    r,
    covariance: cxy / (n - 1),
    meanX: x[start] + mx,
    meanY: y[start] + my,
    sdX: Math.sqrt(sx / (n - 1)),
    sdY: Math.sqrt(sy / (n - 1)),
  };
}
export function matrix(d, start, end) {
  return d.map((x) => d.map((y) => pair(x, y, start, end)));
}
export function run(p) {
  validate(p);
  const data = generate(p);
  return {
    input: { ...p },
    data,
    matrix: matrix(data, p.end - p.window, p.end),
    baseline: matrix(data, 0, p.window),
  };
}
export function rolling(r, i, j) {
  if (
    !Number.isInteger(i) ||
    !Number.isInteger(j) ||
    i < 0 ||
    i > 5 ||
    j < 0 ||
    j > 5
  )
    throw new Error("Invalid pair");
  return Array.from(
    { length: 241 - r.input.window },
    (_, k) => pair(r.data[i], r.data[j], k, k + r.input.window).r,
  );
}
