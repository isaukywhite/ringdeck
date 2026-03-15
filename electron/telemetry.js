const { app, dialog, nativeImage, net } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const os = require("node:os");

// ─── Error Reporting (GlitchTip via Sentry API) ───

const SENTRY_KEY = "77683c1f1e2c4cb48f396713891d691d";
const SENTRY_URL = "https://ringdeckglitchtip.i2tech.dev/api/1/store/";
const TELEMETRY_PATH = path.join(app.getPath("userData"), "telemetry.json");

function getTelemetryConsent() {
  try {
    const data = JSON.parse(fs.readFileSync(TELEMETRY_PATH, "utf-8"));
    return data.consent;
  } catch {
    return null;
  }
}

function saveTelemetryConsent(consent) {
  fs.writeFileSync(TELEMETRY_PATH, JSON.stringify({ consent }, null, 2));
}

let sentryEnabled = getTelemetryConsent() === true;

function captureException(err, extra) {
  if (!sentryEnabled) return;
  const payload = {
    event_id: crypto.randomUUID().replaceAll("-", ""),
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    release: `ringdeck@${app.getVersion()}`,
    environment: app.isPackaged ? "production" : "development",
    contexts: {
      os: { name: process.platform, version: os.release() },
      runtime: { name: "Electron", version: process.versions.electron },
    },
    exception: {
      values: [{
        type: err.name || "Error",
        value: err.message || String(err),
        stacktrace: err.stack ? { frames: parseStack(err.stack) } : undefined,
      }],
    },
    extra: extra || {},
  };

  try {
    const url = `${SENTRY_URL}?sentry_key=${SENTRY_KEY}`;
    const req = net.request({ method: "POST", url });
    req.setHeader("Content-Type", "application/json");
    req.on("response", (res) => {
      console.log("[RingDeck] Error report sent, status:", res.statusCode);
    });
    req.on("error", (e) => {
      console.error("[RingDeck] Error report failed:", e.message);
    });
    req.write(JSON.stringify(payload));
    req.end();
  } catch {}
}

function parseStack(stack) {
  return stack.split("\n").slice(1).reverse().map((line) => {
    const m = line.match(/at\s+(?:([^\s(]+)\s+)?\(?([^:]+):(\d+):(\d+)\)?/); // NOSONAR — parsing trusted stack traces
    if (!m) return { filename: line.trim(), lineno: 0, colno: 0, function: "?" };
    return { function: m[1] || "?", filename: m[2], lineno: +m[3], colno: +m[4] };
  }).filter((f) => f.lineno > 0);
}

function getSentryEnabled() {
  return sentryEnabled;
}

function setSentryEnabled(enabled) {
  sentryEnabled = enabled;
}

async function askTelemetryConsent() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "..", "logo_ring_2_1.png")
  );
  const { response } = await dialog.showMessageBox({
    type: "question",
    icon,
    buttons: ["Yes, send anonymous reports", "No, thanks"],
    defaultId: 0,
    cancelId: 1,
    title: "RingDeck — Error Reporting",
    message: "Help improve RingDeck?",
    detail: "Would you like to send anonymous crash and error reports? No personal data is collected — only technical information to help fix bugs.",
  });
  const consent = response === 0;
  saveTelemetryConsent(consent);
  return consent;
}

// ─── Global Error Handlers ───

process.on("uncaughtException", (err) => {
  console.error("[RingDeck] Uncaught exception:", err);
  captureException(err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[RingDeck] Unhandled rejection:", reason);
  if (reason instanceof Error) captureException(reason);
});

module.exports = {
  SENTRY_KEY,
  SENTRY_URL,
  TELEMETRY_PATH,
  getTelemetryConsent,
  saveTelemetryConsent,
  captureException,
  parseStack,
  getSentryEnabled,
  setSentryEnabled,
  askTelemetryConsent,
};
