const { shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { captureException } = require("./telemetry");

// ─── Actions ───

function executeAction(action) {
  const platform = process.platform;

  switch (action.type) {
    case "Script": {
      let child;
      if (platform === "win32") {
        if (action.command.startsWith("powershell")) {
          // Write script to temp .ps1 file to avoid argument escaping issues
          const raw = action.command.replace(/^powershell(?:\.exe)?\s*(?:-Command|-c)?\s*/i, '');
          const tmpFile = path.join(os.tmpdir(), `ringdeck-ps-${Date.now()}.ps1`);
          console.log("[RingDeck] PS raw script:", raw.substring(0, 200));
          console.log("[RingDeck] PS temp file:", tmpFile);
          fs.writeFileSync(tmpFile, raw, "utf8");
          child = spawn("powershell.exe", [ // NOSONAR — user-configured action
            "-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", tmpFile
          ], {
            detached: true, stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true
          });
          child.stdout.on("data", (d) => console.log("[RingDeck] PS stdout:", d.toString()));
          child.stderr.on("data", (d) => console.error("[RingDeck] PS stderr:", d.toString()));
          child.on("close", (code) => {
            console.log("[RingDeck] PS exit code:", code);
            try { fs.unlinkSync(tmpFile); } catch { /* temp file cleanup */ }
          });
        } else {
          child = spawn("cmd", ["/c", action.command], { // NOSONAR — user-configured action
            detached: true, stdio: "ignore", shell: false, windowsHide: true
          });
        }
      } else {
        child = spawn("sh", ["-c", action.command], { detached: true, stdio: "ignore" }); // NOSONAR — user-configured action
      }
      child.on("error", (err) => { captureException(err); console.error("Script spawn error:", err); });
      child.unref();
      break;
    }
    case "Program": {
      if (platform === "darwin" && action.path.endsWith(".app")) {
        // macOS: use 'open -a' for .app bundles
        const args = ["-a", action.path];
        if (action.args?.length) {
          args.push("--args", ...action.args);
        }
        const child = spawn("open", args, { detached: true, stdio: "ignore" }); // NOSONAR — user-configured action
        child.on("error", (err) => { captureException(err); console.error("Program spawn error:", err); });
        child.unref();
      } else {
        // Windows & Linux: use Electron shell.openPath (native, reliable)
        shell.openPath(action.path).then((err) => {
          if (err) { captureException(new Error("shell.openPath: " + err)); console.error("shell.openPath error:", err); }
        });
      }
      break;
    }
    case "System":
      console.log("System action not yet implemented:", action.action);
      break;
    case "Submenu":
      // Submenu navigation is handled by the ring renderer, not here
      break;
  }
}

module.exports = { executeAction };
