import {
  run as referenceRun,
  rolling as referenceRolling,
} from "../web/src/model.js";
import { spawn } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  mkdtempSync,
} from "node:fs";

const HTTP_PORT = 8979;
const CDP_PORT = 9380;
const SHOTS = process.env.SMOKE_SHOTS === "1";
const root = new URL("..", import.meta.url).pathname;

const profile = mkdtempSync("/tmp/crossweave-chrome-");
const server = spawn(
  "python3",
  [
    "-m",
    "http.server",
    String(HTTP_PORT),
    "--bind",
    "127.0.0.1",
    "--directory",
    `${root}docs`,
  ],
  { stdio: "ignore", detached: true },
);
const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore", detached: true },
);

const cleanup = async (code) => {
  for (const child of [chrome, server]) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  await Promise.all(
    [chrome, server].map((child) =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise((r) => child.once("exit", r)),
    ),
  );
  rmSync(profile, { recursive: true, force: true });
  process.exit(code);
};
const timeout = setTimeout(() => {
  console.error("smoke: timeout");
  cleanup(1);
}, 90000);
process.on("SIGINT", () => cleanup(2));
process.on("uncaughtException", (e) => {
  console.error(e);
  cleanup(1);
});
process.on("unhandledRejection", (e) => {
  console.error(e);
  cleanup(1);
});

async function waitFor(fn, label, timeoutMs = 60000) {
  const start = Date.now();
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    if (Date.now() - start > timeoutMs)
      throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(
    `${ok ? "ok" : "NOT OK"} - ${name}${detail ? " - " + detail : ""}`,
  );
};

await waitFor(
  async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok,
  "chrome devtools",
);
const target = await (
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: "PUT" })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let mid = 0;
const rpcPending = new Map();
const consoleErrors = [];
const requests = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Network.requestWillBeSent")
    requests.push(msg.params.request.url);
  if (msg.id && rpcPending.has(msg.id)) {
    rpcPending.get(msg.id)(msg);
    rpcPending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown")
    consoleErrors.push(
      msg.params.exceptionDetails?.exception?.description ?? "page exception",
    );
};
const cdp = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++mid;
    rpcPending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const res = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.result?.exceptionDetails)
    throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result?.result?.value;
};
const shot = async (name) => {
  if (!SHOTS) return;
  await new Promise((r) => setTimeout(r, 900));
  const metrics = await cdp("Page.getLayoutMetrics");
  const size = metrics.result.cssContentSize;
  const r = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 },
  });
  writeFileSync(
    `${root}smoke-${name}.png`,
    Buffer.from(r.result.data, "base64"),
  );
};

await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp("Page.navigate", { url: `http://127.0.0.1:${HTTP_PORT}/` });
await waitFor(
  async () =>
    await evaluate(`document.querySelectorAll('#heatmap button').length===36`),
);
const state = () =>
  evaluate(
    `JSON.stringify({matrix:[...document.querySelectorAll('#heatmap button')].map(b=>b.dataset.r),label:document.querySelector('#window-label').textContent,scatter:document.querySelector('#scatter').outerHTML,rolling:document.querySelector('#rolling').outerHTML})`,
  );
const input = async (id, value) =>
  evaluate(
    `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('input',{bubbles:true}));true`,
  );
const submit = async () =>
  evaluate(`document.querySelector('#controls').requestSubmit();true`);
check(
  "default36cells",
  await evaluate(`document.querySelectorAll('#heatmap button').length===36`),
);
check(
  "defaultnegativeB",
  await evaluate(
    `Number(document.querySelector('#heatmap button[data-i="0"][data-j="1"]').dataset.r)<-.6&&document.querySelector('#window-label').textContent==='161-240 / 240'`,
  ),
);
check(
  "defaultscatter80",
  await evaluate(`document.querySelectorAll('#scatter circle').length===80`),
);
check(
  "selected1",
  await evaluate(
    `document.querySelectorAll('#heatmap button[aria-pressed="true"]').length===1`,
  ),
);
await shot("default");
const ref = referenceRun({
  scenario: "flip",
  window: 80,
  end: 240,
  seed: 2026,
});
const cellData = await evaluate(
  `Array.from(document.querySelectorAll('#heatmap button'), b=>b.dataset.r==='null'?null:Number(b.dataset.r))`,
);
check(
  "all36defaultvalues",
  cellData.every((v, k) => v === ref.matrix[Math.floor(k / 6)][k % 6].r),
);
const chartData = await evaluate(
  `({w:document.querySelector('#scatter').viewBox.baseVal.width,h:document.querySelector('#scatter').viewBox.baseVal.height,points:[...document.querySelectorAll('#scatter circle')].map(c=>[Number(c.getAttribute('cx')),Number(c.getAttribute('cy'))]),rolling:document.querySelector('#rolling path').getAttribute('d'),rw:document.querySelector('#rolling').viewBox.baseVal.width,rh:document.querySelector('#rolling').viewBox.baseVal.height})`,
);
const rx = ref.data[0].slice(160),
  ry = ref.data[1].slice(160);
const bounds = (a) => {
  const lo = Math.min(...a),
    hi = Math.max(...a);
  return [lo - (hi - lo) * 0.08, hi + (hi - lo) * 0.08];
};
const bx = bounds(rx),
  by = bounds(ry);
check(
  "all80scatterpositions",
  chartData.points.every(
    ([x, y], k) =>
      Math.abs(
        x - (48 + ((rx[k] - bx[0]) / (bx[1] - bx[0])) * (chartData.w - 65)),
      ) < 1e-10 &&
      Math.abs(
        y -
          (chartData.h -
            49 -
            ((ry[k] - by[0]) / (by[1] - by[0])) * (chartData.h - 71)),
      ) < 1e-10,
  ),
);
const rollRef = referenceRolling(ref, 0, 1),
  rollPoints = chartData.rolling
    .match(/[ML][^ML]+/g)
    .map((s) => s.slice(1).split(",").map(Number));
check(
  "all161rollingpositions",
  rollPoints.length === 161 &&
    rollPoints.every(
      ([x, y], k) =>
        Math.abs(x - (48 + (k / 160) * (chartData.rw - 65))) < 1e-10 &&
        Math.abs(
          y -
            (chartData.rh - 49 - ((rollRef[k] + 1) / 2) * (chartData.rh - 71)),
        ) < 1e-10,
    ),
);
for (const [i, j, expected] of [
  [1, 3, false],
  [1, 5, false],
  [1, 0, true],
  [1, 2, true],
  [0, 1, true],
  [2, 1, true],
]) {
  await evaluate(
    `document.querySelector('#heatmap button[data-i="${i}"][data-j="${j}"]').click();true`,
  );
  check(
    `flipcallout${i}${j}`,
    await evaluate(
      `document.querySelector('#pair-message').textContent.includes("B's link to A and C changes")===${expected}`,
    ),
  );
}
await evaluate(
  `document.querySelector('#heatmap button[data-i="0"][data-j="1"]').click();true`,
);
const initial = await state();
await input("end", 80);
check(
  "dirtyretention",
  (await state()) === initial &&
    (await evaluate(`document.querySelector('#status').className==='dirty'`)),
);
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await new Promise((r) => setTimeout(r, 100));
check(
  "resizeappliedonly",
  await evaluate(
    `document.querySelector('#window-label').textContent==='161-240 / 240'&&document.querySelectorAll('#scatter circle').length===80`,
  ),
);
await submit();
check(
  "firstwindowpositiveB",
  await evaluate(
    `Number(document.querySelector('#heatmap button[data-i="0"][data-j="1"]').dataset.r)>.6&&document.querySelector('#r-change').textContent==='+0.00'`,
  ),
);
for (const [id, value, name] of [
  ["end", 79, "endbelowwindow"],
  ["end", 241, "endabove240"],
  ["end", 80.5, "fractionalend"],
  ["end", "", "emptyend"],
  ["seed", 0, "zeroseed"],
  ["seed", 4294967296, "highseed"],
  ["seed", 1.5, "fractionalseed"],
  ["seed", "", "emptyseed"],
]) {
  await input("end", 80);
  await input("seed", 2026);
  const old = await state();
  await input(id, value);
  await submit();
  check(
    name,
    (await state()) === old &&
      (await evaluate(`document.querySelector('#status').className==='error'`)),
  );
}
await input("end", 240);
await input("seed", 4294967295);
await input("window", 120);
await input("scenario", "flat");
await submit();
check(
  "flat11NA",
  await evaluate(`document.querySelectorAll('#heatmap button.na').length===11`),
);
await evaluate(
  `document.querySelector('#heatmap button[data-i="5"][data-j="5"]').click();true`,
);
check(
  "flatdiagonalNA",
  await evaluate(
    `document.querySelector('#r-now').textContent==='NA'&&document.querySelector('#rolling').textContent.includes('NA')&&document.querySelectorAll('#rolling path').length===0`,
  ),
);
check(
  "flatselected120points",
  await evaluate(`document.querySelectorAll('#scatter circle').length===120`),
);
await shot("flat");
await input("scenario", "steady");
await input("window", 40);
await input("end", 40);
await input("seed", 1);
await submit();
await cdp("Page.bringToFront");
await evaluate(
  `document.querySelector('#heatmap button[data-i="0"][data-j="4"]').focus();true`,
);
await cdp("Input.dispatchKeyEvent", {
  type: "keyDown",
  key: "Enter",
  code: "Enter",
  windowsVirtualKeyCode: 13,
  text: "\r",
});
await cdp("Input.dispatchKeyEvent", {
  type: "keyUp",
  key: "Enter",
  code: "Enter",
  windowsVirtualKeyCode: 13,
});
check(
  "keyboardpairselect",
  await evaluate(
    `document.querySelector('#pair-title').textContent.includes('Curve')&&document.activeElement.getAttribute('aria-pressed')==='true'`,
  ),
);
check(
  "curved40scatter",
  await evaluate(
    `document.querySelectorAll('#scatter circle').length===40&&document.querySelector('#pair-message').textContent.includes('nonlinear')`,
  ),
);
await shot("curve");
await evaluate(
  `document.querySelector('#pair-x').value='2';document.querySelector('#pair-x').dispatchEvent(new Event('change'));document.querySelector('#pair-y').value='2';document.querySelector('#pair-y').dispatchEvent(new Event('change'));true`,
);
check(
  "diagonalunit",
  await evaluate(
    `document.querySelector('#r-now').textContent==='+1.00'&&document.querySelector('#pair-message').textContent.includes('itself')`,
  ),
);
for (const width of [320, 360, 390, 768]) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height: 844,
    deviceScaleFactor: 1,
    mobile: width < 500,
  });
  await new Promise((r) => setTimeout(r, 120));
  check(
    `${width}pxpage`,
    await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),
  );
  check(
    `${width}pxcharts`,
    await evaluate(
      `[...document.querySelectorAll('svg')].every(s=>Math.abs(s.viewBox.baseVal.width-s.getBoundingClientRect().width)<1)`,
    ),
  );
  if (width < 500)
    check(
      `${width}pxmatrixscroll`,
      await evaluate(
        `document.querySelector('.scroll').scrollWidth>document.querySelector('.scroll').clientWidth`,
      ),
    );
  await shot(`mobile-${width}`);
}
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await evaluate(
  `[...document.querySelectorAll('details')].forEach(d=>d.open=true);true`,
);
await new Promise((r) => setTimeout(r, 100));
await shot("details");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 320,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await new Promise((r) => setTimeout(r, 120));
check(
  "320expandednooverflow",
  await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),
);
await shot("mobile-expanded");
check(
  "CSPconnectnone",
  await evaluate(
    `document.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'")`,
  ),
);
check(
  "nostorage",
  await evaluate(`localStorage.length===0&&sessionStorage.length===0`),
);
check("noexceptions", consoleErrors.length === 0, consoleErrors.join(";"));
const unexpected = requests.filter(
  (u) =>
    !u.startsWith(`http://127.0.0.1:${HTTP_PORT}/`) &&
    u !== "about:blank" &&
    !u.startsWith("data:"),
);
check("noofforigin", unexpected.length === 0, unexpected.join(";"));
writeFileSync(
  `${root}build/browser-result.json`,
  JSON.stringify(checks, null, 2),
);
const failed = checks.filter((c) => !c.ok);
console.log(`${checks.length} browser checks, ${failed.length} failed`);
clearTimeout(timeout);
ws.close();
await cleanup(failed.length ? 1 : 0);
