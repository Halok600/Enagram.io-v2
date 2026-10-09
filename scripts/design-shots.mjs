// Screenshot runner for the development-only /design preview. Dependency-free (Node 22+ for the global WebSocket).
//
//   node scripts/design-shots.mjs [view ...] [--base=http://localhost:3100] [--section=<id>] [--size=WxH] [--viewport-only]
//
// For every view (default "kit") x theme (dark, light) x size (1440x900, 390x844) it starts headless Chrome or Edge
// from the command line with a throwaway --user-data-dir in the OS temp directory (never a real browser profile,
// never any MCP browser), drives it over the DevTools protocol on a private local port, and writes
// design-shots/<view>-<theme>-<WxH>.png. The browser runs in real time (the framer-motion entrance animations of
// the app never finish under --virtual-time-budget), waits for the fonts and animations, then grows the viewport
// to the full page height so the picture shows everything. --viewport-only keeps the plain WxH picture.
// --section=<id> renders a single section of the kit (the file name gets the section).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
// view and section end up in file names and URLs: keep only [a-z0-9-].
const safe = (value) => value.toLowerCase().replace(/[^a-z0-9-]/g, "");
const base = opt("base") ?? "http://localhost:3100";
const sectionRaw = opt("section");
const section = sectionRaw === undefined ? undefined : safe(sectionRaw) || undefined;
const viewportOnly = args.includes("--viewport-only");
const views = args.filter((a) => !a.startsWith("--")).map(safe).filter(Boolean);
if (views.length === 0) views.push("kit");

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const browserPath = CANDIDATES.find((p) => existsSync(p));
if (!browserPath) {
  console.error("No Chrome or Edge found. Set CHROME_PATH to a browser executable.");
  process.exit(1);
}

// --size=WxH renders just that one size (for example --size=800x900 to look at a tablet width).
const sizeOpt = opt("size");
const SIZES = sizeOpt
  ? [sizeOpt.split("x").map(Number)]
  : [
      [1440, 900],
      [390, 844],
    ];
const SEND_TIMEOUT_MS = 20000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const outDir = resolve("design-shots");
mkdirSync(outDir, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "enagram-shots-"));

const child = spawn(
  browserPath,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
  { stdio: "ignore" },
);
let spawnError = null;
child.on("error", (err) => {
  spawnError = err;
  console.error(`Could not start the browser (${browserPath}): ${err.message}`);
});

function cleanup() {
  try {
    child.kill();
  } catch {
    // Already gone.
  }
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // The temp profile may still be locked for a moment; the OS temp cleaner removes it later.
  }
}
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    cleanup();
    process.exit(130);
  });
}

async function debuggerPort() {
  const file = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError;
    if (existsSync(file)) {
      const port = readFileSync(file, "utf8").split(/\r?\n/)[0];
      if (port) return Number(port);
    }
    await sleep(100);
  }
  throw new Error("The browser did not report a debugging port.");
}

function connect(url) {
  return new Promise((resolveWs, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { ok, fail } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) fail(new Error(msg.error.message));
        else ok(msg.result);
      }
    };
    ws.onerror = () => reject(new Error("DevTools connection failed"));
    ws.onopen = () =>
      resolveWs({
        send: (method, params = {}) =>
          new Promise((ok, fail) => {
            const mid = ++id;
            const timer = setTimeout(() => {
              pending.delete(mid);
              fail(new Error(`DevTools call ${method} timed out after ${SEND_TIMEOUT_MS / 1000}s`));
            }, SEND_TIMEOUT_MS);
            pending.set(mid, {
              ok: (v) => (clearTimeout(timer), ok(v)),
              fail: (e) => (clearTimeout(timer), fail(e)),
            });
            ws.send(JSON.stringify({ id: mid, method, params }));
          }),
        close: () => ws.close(),
      });
  });
}

async function shoot(cdp, url, w, h, file) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url });
  await sleep(2500); // load, hydrate, fonts, entrance animations
  const hide = `document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()); document.fonts.ready.then(() => document.documentElement.scrollHeight)`;
  const res = await cdp.send("Runtime.evaluate", { expression: hide, awaitPromise: true, returnByValue: true });
  let height = h;
  if (!viewportOnly) height = Math.max(h, Number(res.result.value) || h);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  return height;
}

let failed = false;
try {
  const port = await debuggerPort();
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  for (const view of views) {
    for (const theme of ["dark", "light"]) {
      for (const [w, h] of SIZES) {
        const q = new URLSearchParams({ view, theme });
        if (section) q.set("section", section);
        const name = `${[view, section, theme].filter(Boolean).join("-")}-${w}x${h}.png`;
        try {
          const height = await shoot(cdp, `${base}/design?${q}`, w, h, join(outDir, name));
          console.log(`${name}  (${w}x${height})`);
        } catch (err) {
          failed = true;
          console.error(`FAILED ${name}: ${err.message}`);
        }
      }
    }
  }
  cdp.close();
} catch (err) {
  failed = true;
  console.error(err.message);
} finally {
  child.kill();
  await sleep(500);
  cleanup();
}
process.exit(failed ? 1 : 0);
