# 🎯 RingDeck Usage Guide — Real-World Setup

> This guide demonstrates how the author uses RingDeck as a daily driver on Windows 11, including portable deployment, AI-assisted workflows, and media control integration.

---

## 📦 Portable Deployment

RingDeck supports a **portable mode** — a single `.exe` that runs from any folder without installation.

### Directory Structure

```
C:\APP-Portable\
└── ringdeck\
    ├── RingDeck-0.3.0-portable.exe   ← The app
    └── config.json                    ← Auto-created on first run
```

When running from a portable executable, RingDeck detects the `PORTABLE_EXECUTABLE_DIR` environment variable (set automatically by electron-builder) and stores `config.json` **next to the .exe** instead of `%APPDATA%`. This means your entire setup travels with the folder — perfect for USB drives, synced folders, or dev machines.

### How it works

```js
// electron/config.js
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;
const CONFIG_PATH = isPortable
  ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, "config.json")
  : path.join(app.getPath("userData"), "config.json");
```

### Keeping multiple versions

You can keep old portable versions alongside the new one for quick rollback:

```
ringdeck\
├── RingDeck-0.2.2-portable.exe   ← Previous stable
├── RingDeck-0.3.0-portable.exe   ← Current
└── config.json                    ← Shared between both
```

---

## 💻 PowerShell 7 Integration

RingDeck is designed to work with **PowerShell 7** (`pwsh.exe`) on Windows 11. While Windows ships with PowerShell 5.1 (`powershell.exe`), we recommend PowerShell 7 for:

- Cross-platform compatibility
- Better performance
- Modern language features
- Required for tools like `gemini` CLI

### Default Path

```
C:\Program Files\PowerShell\7\pwsh.exe
```

### Terminal Mode

When a ring action needs to open an **interactive terminal** (not a background script), set `"terminal": true` in the action config. This uses the Windows `start` command to create a visible, independent console window:

```json
{
  "label": "Dev Terminal",
  "icon": "terminal",
  "action": {
    "type": "Program",
    "path": "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    "args": ["-WorkingDirectory", "C:\\Projects\\my-app"],
    "terminal": true
  }
}
```

Without `terminal: true`, the process runs detached with no visible window — ideal for background scripts, but useless for interactive CLIs.

---

## 🧠 AI CLI Integration ("Brain" Action)

One of the most powerful use cases is launching an **AI coding assistant** directly from the ring. The author uses [Gemini CLI](https://github.com/google-gemini/gemini-cli) as the AI backend, configured to open in a specific project workspace.

### Example: "Brain" Button

```json
{
  "label": "Brain",
  "icon": "beaker",
  "action": {
    "type": "Program",
    "path": "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    "args": [
      "-NoExit",
      "-Command",
      "Set-Location 'C:\\Projects\\my-workspace'; gemini"
    ],
    "terminal": true
  }
}
```

**How it works:**
1. Opens PowerShell 7 in a new window (`terminal: true`)
2. Navigates to your project directory (`Set-Location`)
3. Launches the Gemini CLI (`gemini`)
4. `-NoExit` keeps the terminal alive after Gemini exits

> **Tip:** The author names this button "Brain" and uses the 🧪 beaker icon. You can also add a shortcut alias in your PowerShell profile (e.g., `Set-Alias brain gemini`) for even faster access.

### Naming Convention: "Jezebel"

In the author's setup, the Gemini CLI session is nicknamed **"Jezebel"** — a codename for the AI assistant persona. This is a personal naming convention used across the development workflow. The `"Jezebel CLI"` button simply opens a PowerShell 7 terminal in the project directory:

```json
{
  "label": "Jezebel CLI",
  "icon": "terminal",
  "action": {
    "type": "Program",
    "path": "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    "args": ["-WorkingDirectory", "C:\\Projects\\my-app"],
    "terminal": true
  }
}
```

---

## 🔥 The "HellRing" Profile

RingDeck supports **multiple profiles** — each with its own set of ring actions and trigger shortcut. The author's primary profile is called **"HellRing"**, a power-user configuration that combines:

| Slot | Action | Type |
|:---|:---|:---|
| 12:00 | Play / Pause | MediaKey |
| 01:30 | SnapCodex Quick Search | Program |
| 03:00 | Next Track | MediaKey |
| 04:30 | Brain (AI CLI) | Program + Terminal |
| 06:00 | AI Hub (Submenu) | Submenu → OpenUrl |
| 07:30 | Dev Terminal | Program + Terminal |
| 09:00 | Previous Track | MediaKey |
| 10:30 | Voice Input | Program |

### Mouse Trigger

The HellRing profile is activated via **mouse side button** (button 4 or 5 on mice like the Logitech MX Master series). This replaces the need for heavy vendor software like Logi Options+:

```json
{
  "mouseBindings": [
    { "button": 4, "profileId": "hellring" },
    { "button": 5, "profileId": "hellring" }
  ]
}
```

---

## 🎵 Media Key Actions

RingDeck v0.3.0 introduces the `MediaKey` action type for **native media control** on Windows. Instead of spawning PowerShell scripts, it uses the Win32 `keybd_event` API via P/Invoke for near-instant response:

```json
{ "type": "MediaKey", "key": "play-pause" }
{ "type": "MediaKey", "key": "next" }
{ "type": "MediaKey", "key": "prev" }
{ "type": "MediaKey", "key": "mute" }
{ "type": "MediaKey", "key": "vol-up" }
{ "type": "MediaKey", "key": "vol-down" }
{ "type": "MediaKey", "key": "stop" }
```

These work with any media player that responds to Windows media key events (Spotify, YouTube in browser, VLC, Windows Media Player, etc.).

### Why not SendKeys?

Previous versions used `WScript.Shell.SendKeys` via PowerShell, but this approach:
- Requires spawning a PowerShell process (~200ms latency)
- Fails silently when run with `-WindowStyle Hidden`
- Depends on COM object initialization

The `keybd_event` P/Invoke works at the Windows kernel level and is the same approach used by hardware keyboard drivers.

---

## 🌐 AI Hub Submenu

The ring supports **nested submenus** for organizing related actions. The author uses an "AI Hub" submenu to quick-launch different AI services in a dedicated browser:

```json
{
  "label": "AI Hub",
  "icon": "sparkles",
  "action": {
    "type": "Submenu",
    "slices": [
      {
        "label": "Perplexity",
        "icon": "magnifying-glass-circle",
        "action": {
          "type": "OpenUrl",
          "url": "https://www.perplexity.ai/",
          "browser": "%LOCALAPPDATA%\\Perplexity\\Comet\\Application\\comet.exe"
        }
      },
      {
        "label": "Gemini Web",
        "icon": "chat-bubble-left-ellipsis",
        "action": {
          "type": "OpenUrl",
          "url": "https://gemini.google.com/app"
        }
      }
    ]
  }
}
```

The `browser` field is optional — if omitted or not found, RingDeck falls back to the system default browser. The `%LOCALAPPDATA%` environment variable is expanded automatically.

---

## 🏛️ Council Lumina — AI Governance Rules

The `.cursorignore` file may reference **"Council Lumina"** — this is the author's personal AI governance ruleset used across projects. It defines:

- Persona routing (which AI "personality" handles which task)
- Code quality mandates (anti-placeholder rules, full-read requirements)
- Security boundaries (prompt injection prevention)
- Context management protocols

It's referenced in `.cursorignore` to prevent the AI editor from indexing internal rule files. If you're forking RingDeck, you can safely replace this with your own ignore patterns.

---

## 🔧 Building from Source

```bash
# Install dependencies
npm install

# Development mode (build + launch Electron)
npm run dev

# Production build (Vite + electron-builder)
npm run build

# Portable only
npx electron-builder --win portable --publish never
```

The portable `.exe` is output to `out/RingDeck-{version}-portable.exe`.

---

## 📁 Git Workflow

The author maintains RingDeck as a **public repository** with a branch-based workflow:

```
main          ← Stable releases
└── develop   ← Integration branch
    └── feat/v0.3-ux-and-media   ← Feature branches
```

- Feature branches are created from `develop`
- PRs target `develop` with atomic, descriptive commits
- Releases are merged from `develop` → `main` with version tags
- The portable config (`config.json`) is **never committed** — it lives only on your machine

---

## 🎮 Full Example: config.json

Here's a complete example configuration showcasing all action types:

```json
{
  "mouseBindings": [
    { "button": 4, "profileId": "myprofile" }
  ],
  "profiles": [
    {
      "id": "myprofile",
      "name": "My Profile 🚀",
      "shortcut": "Ctrl+Alt+Space",
      "slices": [
        {
          "label": "Play / Pause",
          "icon": "play-pause",
          "action": { "type": "MediaKey", "key": "play-pause" }
        },
        {
          "label": "Terminal",
          "icon": "terminal",
          "action": {
            "type": "Program",
            "path": "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
            "args": ["-WorkingDirectory", "C:\\Projects"],
            "terminal": true
          }
        },
        {
          "label": "AI Assistant",
          "icon": "beaker",
          "action": {
            "type": "Program",
            "path": "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
            "args": ["-NoExit", "-Command", "Set-Location 'C:\\Projects'; gemini"],
            "terminal": true
          }
        },
        {
          "label": "Next Track",
          "icon": "forward",
          "action": { "type": "MediaKey", "key": "next" }
        },
        {
          "label": "Browser",
          "icon": "globe",
          "action": {
            "type": "OpenUrl",
            "url": "https://google.com"
          }
        },
        {
          "label": "Previous Track",
          "icon": "backward",
          "action": { "type": "MediaKey", "key": "prev" }
        }
      ]
    }
  ],
  "settings": {
    "ringColor": "#0A84FF",
    "ringSize": "medium",
    "activePreset": "nebula",
    "launchAtStartup": false,
    "closeToTray": true,
    "performanceMode": false
  }
}
```

---

*RingDeck v0.3.0 — Built with ❤️ for power users who hate reaching for the mouse.*
