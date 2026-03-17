const { app } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { captureException } = require("./telemetry");

// ─── Config ───

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

let config = null;
let activeProfileIndex = 0;

function getDefaultConfig() {
  const platform = process.platform;
  let slices;

  if (platform === "win32") {
    slices = [
      {
        label: "Terminal",
        icon: "terminal",
        action: {
          type: "Program",
          path: "wt.exe",
          args: [],
        },
      },
      {
        label: "Browser",
        icon: "globe",
        action: {
          type: "Program",
          path: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
          args: [],
        },
      },
    ];
  } else if (platform === "linux") {
    slices = [
      {
        label: "Terminal",
        icon: "terminal",
        action: {
          type: "Script",
          command: "x-terminal-emulator",
        },
      },
      {
        label: "Browser",
        icon: "globe",
        action: {
          type: "Script",
          command: "xdg-open https://google.com",
        },
      },
    ];
  } else {
    // macOS
    slices = [
      {
        label: "Terminal",
        icon: "terminal",
        action: {
          type: "Program",
          path: "/System/Applications/Utilities/Terminal.app",
          args: [],
        },
      },
      {
        label: "Browser",
        icon: "globe",
        action: {
          type: "Program",
          path: "/Applications/Safari.app",
          args: [],
        },
      },
    ];
  }

  return {
    profiles: [
      {
        id: "default",
        name: "Default",
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

function saveConfigToDisk(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
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
