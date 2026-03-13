<p align="center">
  <img src="logo_ring_2_1.png" alt="RingDeck" width="120" />
</p>

<h1 align="center">RingDeck</h1>

<p align="center">
  <strong>A radial action launcher for power users.</strong><br />
  Hold the shortcut, pick an action, release. Done.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" />
  <img src="https://img.shields.io/badge/electron-v35-47848F?logo=electron" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

## ✨ Features

- **Radial action ring** — A beautiful circular launcher that appears at your cursor
- **Multiple profiles** — Create separate rings for different workflows (AI tools, navigation, dev tools, etc.)
- **Independent shortcuts** — Each profile has its own keyboard shortcut
- **Release-to-activate** — Hold the shortcut, hover over an action, release to launch
- **Cross-platform** — Works on Windows, macOS, and Linux
- **Drag & drop reorder** — Rearrange actions with drag and drop
- **Heroicons built-in** — 200+ beautiful icons to choose from
- **Portable mode** — Run without installing (Windows)
- **Lightweight** — Built with Electron + vanilla JS, no heavy frameworks

## 🚀 Quick Start

### Download

Head to the [Releases](../../releases) page and grab:

| Platform | File | Type |
|----------|------|------|
| Windows | `RingDeck-x.x.x-portable.exe` | Portable (no install) |
| Windows | `RingDeck-Setup-x.x.x.exe` | Installer |
| macOS | `RingDeck-x.x.x.dmg` | Disk image |
| Linux | `RingDeck-x.x.x.AppImage` | AppImage |
| Linux | `ringdeck_x.x.x_amd64.deb` | Debian package |

### Build from source

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for your platform
npm run build

# Build portable only (no installer)
npm run pack
```

## 🎯 How It Works

1. **Press** your shortcut (default: `Alt+Space`) — the ring appears at your cursor
2. **Hold** the modifier key(s) and move your mouse to hover over an action
3. **Release** the modifier — the hovered action is launched
4. Or just **click** any action directly

### Multiple Profiles

Create different rings for different contexts:

- **AI Tools** (`Ctrl+Shift+Space`) → ChatGPT, Copilot, Perplexity
- **Dev Tools** (`Ctrl+Alt+Space`) → Terminal, VS Code, Browser
- **Media** (`Ctrl+Shift+M`) → Spotify, VLC, OBS

Each profile has its own shortcut and set of actions.

## ⚙️ Configuration

Click the system tray icon or launch the app to open the config window:

- **Left panel** — Ring preview + shortcut recorder
- **Right panel** — Profile tabs + action list
- **Add Profile** — Click the `+` tab to create a new profile
- **Record Shortcut** — Click "Record" and press your desired key combo
- **Add Action** — Choose between Script (shell command) or Program (executable)

### Action Types

| Type | Description | Example |
|------|-------------|---------|
| **Script** | Run a shell command | `code .`, `open -a Safari` |
| **Program** | Launch an executable | `chrome.exe`, `Terminal.app` |

## 🏗️ Tech Stack

- **[Electron](https://www.electronjs.org/)** — Cross-platform desktop runtime
- **[Vite](https://vitejs.dev/)** — Fast build tool
- **[Heroicons](https://heroicons.com/)** — Beautiful hand-crafted SVG icons
- **Vanilla JS + CSS** — No frameworks, fast and lightweight

## 📁 Project Structure

```
ringdeck/
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # Context bridge API
├── src/
│   ├── main.js          # Config UI logic
│   ├── ring.js          # Radial ring logic
│   ├── icons.js         # Heroicons SVG map
│   ├── style.css        # Config UI styles
│   └── ring.css         # Ring styles
├── index.html           # Config window
├── ring.html            # Ring overlay window
├── package.json
└── vite.config.js
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## 📄 License

[MIT](LICENSE) — do whatever you want with it.
