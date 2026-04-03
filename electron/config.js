const { app } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { captureException } = require("./telemetry");

// ─── Config ───

// Detect portable mode via electron-builder env var
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;
const CONFIG_PATH = isPortable
  ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, "config.json")
  : path.join(app.getPath("userData"), "config.json");

let config = null;
let activeProfileIndex = 0;

function getDefaultConfig() {
  const platform = process.platform;
  let slices;

  if (platform === "win32") {
    slices = [
      {
        label: "Play / Pause",
        icon: "play-pause",
        action: { type: "MediaKey", key: "play-pause" }
      },
      {
        label: "SnapCodex Quick",
        icon: "bolt",
        action: { type: "Program", path: "C:\\APP-Portable\\snapcodex\\snapcodex.exe", args: ["--quick"] }
      },
      {
        label: "Next Track",
        icon: "forward",
        action: { type: "MediaKey", key: "next" }
      },
      {
        label: "Brain",
        icon: "beaker",
        action: { type: "Script", command: "powershell -WindowStyle Hidden -Command \"cd 'C:\\Documentos-mm\\Work-git\\BIG-BRAIN-GIT'; Start-Process pwsh -ArgumentList '-NoExit', '-Command', 'cd C:\\Documentos-mm\\Work-git\\BIG-BRAIN-GIT; gemini'\"" }
      },
      {
        label: "Hub de IA",
        icon: "sparkles",
        action: {
          type: "Submenu",
          slices: [
            {
              label: "Comet Perplexity",
              icon: "magnifying-glass-circle",
              action: { type: "OpenUrl", url: "https://www.perplexity.ai/", browser: "%LOCALAPPDATA%\\Perplexity\\Comet\\Application\\comet.exe" }
            },
            {
              label: "Comet Manus",
              icon: "cpu-chip",
              action: { type: "OpenUrl", url: "https://manus.im/", browser: "%LOCALAPPDATA%\\Perplexity\\Comet\\Application\\comet.exe" }
            },
            {
              label: "Comet Gemini",
              icon: "chat-bubble-left-ellipsis",
              action: { type: "OpenUrl", url: "https://gemini.google.com/app", browser: "%LOCALAPPDATA%\\Perplexity\\Comet\\Application\\comet.exe" }
            }
          ]
        }
      },
      {
        label: "Jezebel CLI",
        icon: "terminal",
        action: { type: "Program", path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe", args: [] }
      },
      {
        label: "Previous Track",
        icon: "backward",
        action: { type: "MediaKey", key: "prev" }
      },
      {
        label: "Mute Mic",
        icon: "microphone",
        action: { type: "MediaKey", key: "mute" }
      }
    ];
  } else if (platform === "linux") {
    slices = [
      { label: "Terminal", icon: "terminal", action: { type: "Script", command: "x-terminal-emulator" } },
      { label: "Browser", icon: "globe", action: { type: "Script", command: "xdg-open https://google.com" } }
    ];
  } else {
    slices = [
      { label: "Terminal", icon: "terminal", action: { type: "Program", path: "/System/Applications/Utilities/Terminal.app", args: [] } },
      { label: "Browser", icon: "globe", action: { type: "Program", path: "/Applications/Safari.app", args: [] } }
    ];
  }

  return {
    mouseBindings: [
      { button: 4, profileId: "hellring" }
    ],
    profiles: [
      {
        id: "hellring",
        name: "HellRing 🔥",
        shortcut: "Alt+Space",
        slices,
      },
    ],
  };
}

function migrateConfig(cfg) {
  // Migrate legacy format (shortcut + slices) to profiles format
  if (cfg.slices && !cfg.profiles) {
    const migrated = {
      profiles: [
        {
          id: "default",
          name: "Default",
          shortcut: cfg.shortcut || "Alt+Space",
          slices: cfg.slices,
        },
      ],
    };
    saveConfigToDisk(migrated);
    return migrated;
  }

  // Migrate configs that lack a settings field
  if (cfg.profiles && !cfg.settings) {
    cfg.settings = {
      ringColor: "#0A84FF",
      ringSize: "medium",
      activePreset: "nebula",
      launchAtStartup: false,
      closeToTray: true,
      sendErrorReports: false,
      customPresets: [],
    };
    saveConfigToDisk(cfg);
  }

  // Migrate configs that lack a mouseBindings field (optional — empty array = no mouse triggers)
  if (cfg.profiles && !cfg.mouseBindings) {
    cfg.mouseBindings = [];
    // No disk save here — only persist when user explicitly configures mouse buttons
  }

  return cfg;
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      return migrateConfig(raw);
    }
  } catch (e) {
    captureException(e);
    console.error("[RingDeck] Config load error:", e);
  }
  const defaults = getDefaultConfig();
  saveConfigToDisk(defaults);
  return structuredClone(defaults);
}

async function saveConfigToDisk(cfg) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.promises.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  } catch (e) {
    captureException(e);
    console.error("[RingDeck] Config save error:", e);
  }
}

// Initialize config
config = loadConfig();

function getConfig() {
  return config;
}

function setConfig(newConfig) {
  config = newConfig;
}

function getActiveProfileIndex() {
  return activeProfileIndex;
}

function setActiveProfileIndex(index) {
  activeProfileIndex = index;
}

module.exports = {
  CONFIG_PATH,
  loadConfig,
  saveConfigToDisk,
  getDefaultConfig,
  migrateConfig,
  getConfig,
  setConfig,
  getActiveProfileIndex,
  setActiveProfileIndex,
};
