const { shell, clipboard } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { captureException } = require("./telemetry");

// ─── Helpers ───

/**
 * Expands Windows environment variables in a path string.
 * e.g. "%LOCALAPPDATA%\\Perplexity\\..." → "C:\\Users\\...\\Perplexity\\..."
 */
function expandEnvVars(str) {
  if (!str || process.platform !== "win32") return str;
  return str.replace(/%([^%]+)%/g, (_, key) => process.env[key] || `%${key}%`);
}

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
      } else if (platform === "win32" && action.terminal) {
        // Interactive terminal mode: use 'start' to open a new visible console window.
        // This is the same pattern used by Logi Options+ plugins — proven to work
        // for PowerShell 7 + Gemini CLI, pwsh sessions, etc.
        // 'start ""' creates a detached console window that survives Electron exit.
        const { exec } = require("node:child_process");
        const quotedPath = `"${action.path}"`;
        const argsStr = (action.args || []).map(a => {
          // Wrap args containing spaces in quotes
          return a.includes(" ") || a.includes("'") ? `"${a}"` : a;
        }).join(" ");
        const cmd = `start "" ${quotedPath} ${argsStr}`;
        console.log("[RingDeck] Terminal exec:", cmd);
        exec(cmd, (err) => {
          if (err) { captureException(err); console.error("Program terminal exec error:", err); }
        });
      } else {
        // Windows & Linux (non-terminal / background programs)
        if (action.args && action.args.length > 0) {
          const child = spawn(action.path, action.args, { detached: true, stdio: "ignore" }); // NOSONAR
          child.on("error", (err) => { captureException(err); console.error("Program spawn error:", err); });
          child.unref();
        } else {
          shell.openPath(action.path).then((err) => {
            if (err) { captureException(new Error("shell.openPath: " + err)); console.error("shell.openPath error:", err); }
          });
        }
      }
      break;
    }
    case "MediaKey": {
      // Native Windows media key simulation via keybd_event P/Invoke.
      // WScript.Shell.SendKeys is unreliable for virtual media keys,
      // especially with -WindowStyle Hidden. keybd_event works at kernel level.
      //
      // Virtual key codes:
      //   VK_MEDIA_PLAY_PAUSE = 0xB3 (179)
      //   VK_MEDIA_NEXT_TRACK = 0xB0 (176)
      //   VK_MEDIA_PREV_TRACK = 0xB1 (177)
      //   VK_MEDIA_STOP       = 0xB2 (178)
      //   VK_VOLUME_MUTE      = 0xAD (173)
      //   VK_VOLUME_DOWN      = 0xAE (174)
      //   VK_VOLUME_UP        = 0xAF (175)
      const keyMap = {
        "play-pause": 0xB3,
        "next":       0xB0,
        "prev":       0xB1,
        "stop":       0xB2,
        "mute":       0xAD,
        "vol-down":   0xAE,
        "vol-up":     0xAF,
      };
      const vk = keyMap[action.key];
      if (!vk) {
        console.error(`[RingDeck] MediaKey: unknown key "${action.key}"`);
        break;
      }
      if (platform === "win32") {
        const ps = `$code = '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);'; $kb = Add-Type -MemberDefinition $code -Name 'KB${Date.now()}' -PassThru; $kb::keybd_event(${vk}, 0, 1, 0); $kb::keybd_event(${vk}, 0, 3, 0)`;
        const child = spawn("powershell.exe", [ // NOSONAR — media key P/Invoke
          "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps
        ], {
          detached: true, stdio: "ignore", shell: false, windowsHide: true
        });
        child.on("error", (err) => { captureException(err); console.error("MediaKey spawn error:", err); });
        child.unref();
      } else {
        console.warn("[RingDeck] MediaKey: not implemented for", platform);
      }
      break;
    }
    case "System":
      console.log("System action not yet implemented:", action.action);
      break;
    case "Submenu":
      // Submenu navigation is handled by the ring renderer, not here
      break;

    // ─── New action types for HellRing / Logi Options+ migration ───

    case "OpenUrl": {
      // Opens a URL in a specific browser process, or the system default.
      // action.url     = "https://perplexity.ai"
      // action.browser = "%LOCALAPPDATA%\\Perplexity\\...\\comet.exe"  (optional)
      const resolvedBrowser = action.browser ? expandEnvVars(action.browser) : null;
      if (resolvedBrowser && fs.existsSync(resolvedBrowser)) {
        const child = spawn(resolvedBrowser, [action.url], { // NOSONAR — user-configured action
          detached: true, stdio: "ignore"
        });
        child.on("error", (err) => { captureException(err); console.error("OpenUrl spawn error:", err); });
        child.unref();
      } else {
        if (resolvedBrowser) {
          console.warn(`[RingDeck] OpenUrl: browser not found at "${resolvedBrowser}", falling back to system default.`);
        }
        shell.openExternal(action.url).catch((err) => {
          captureException(err);
          console.error("OpenUrl openExternal error:", err);
        });
      }
      break;
    }

    case "ClipboardSearch": {
      // Reads current clipboard text, URL-encodes it, and opens a search URL.
      // Replaces the old powershell copy-open-search.ps1 + SendKeys workaround.
      // action.searchUrl = "https://perplexity.ai/?q=${query}"
      // action.browser   = "%LOCALAPPDATA%\\...\\comet.exe"  (optional)
      const text = clipboard.readText().trim();
      if (!text) {
        console.warn("[RingDeck] ClipboardSearch: clipboard is empty, nothing to search.");
        break;
      }
      const encoded = encodeURIComponent(text);
      const searchUrl = (action.searchUrl || "").replace("${query}", encoded);
      const resolvedSearchBrowser = action.browser ? expandEnvVars(action.browser) : null;
      if (resolvedSearchBrowser && fs.existsSync(resolvedSearchBrowser)) {
        const child = spawn(resolvedSearchBrowser, [searchUrl], { // NOSONAR — user-configured action
          detached: true, stdio: "ignore"
        });
        child.on("error", (err) => { captureException(err); console.error("ClipboardSearch spawn error:", err); });
        child.unref();
      } else {
        if (resolvedSearchBrowser) {
          console.warn(`[RingDeck] ClipboardSearch: browser not found at "${resolvedSearchBrowser}", falling back to system default.`);
        }
        shell.openExternal(searchUrl).catch((err) => {
          captureException(err);
          console.error("ClipboardSearch openExternal error:", err);
        });
      }
      break;
    }
  }
}

module.exports = { executeAction, expandEnvVars };
