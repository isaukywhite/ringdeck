import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import Module from 'node:module';

const tmpDir = os.tmpdir();

// ─── Mock electron for CJS require() ───
// vitest's vi.mock doesn't intercept CJS require('electron'), so we inject
// our mock directly into Node's require cache.

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) {
  if (request === 'electron') return 'electron';
  return originalResolveFilename.call(this, request, parent, ...args);
};

const mockNetRequest = {
  setHeader: vi.fn(),
  on: vi.fn(),
  write: vi.fn(),
  end: vi.fn(),
};

const mockElectron = {
  app: {
    getPath: vi.fn(() => tmpDir),
    getVersion: vi.fn(() => '0.2.3'),
    isPackaged: false,
  },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({})),
  },
  net: {
    request: vi.fn(() => mockNetRequest),
  },
  shell: {
    openPath: vi.fn().mockResolvedValue(''),
  },
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn(),
  },
  BrowserWindow: function BrowserWindow() {
    this.loadFile = vi.fn();
    this.on = vi.fn();
    this.show = vi.fn();
    this.hide = vi.fn();
    this.focus = vi.fn();
    this.setBounds = vi.fn();
    this.isVisible = vi.fn().mockReturnValue(false);
    this.isDestroyed = vi.fn().mockReturnValue(false);
    this.webContents = { executeJavaScript: vi.fn() };
  },
  screen: {
    getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 500 })),
  },
};

require.cache['electron'] = {
  id: 'electron',
  filename: 'electron',
  loaded: true,
  exports: mockElectron,
};

// Also mock vi.mock for ESM imports (after vi.resetModules, dynamic import uses ESM path)
vi.mock('electron', () => mockElectron);

// Helper: clear CJS require cache for electron/* modules and re-inject electron mock
function resetElectronModules() {
  vi.resetModules();
  // Clear CJS cached electron modules so they re-evaluate on next require
  const projectDir = path.resolve(__dirname, '../..');
  for (const key of Object.keys(require.cache)) {
    if (key.includes(path.join(projectDir, 'electron'))) {
      delete require.cache[key];
    }
  }
  // Re-inject electron mock
  require.cache['electron'] = { id: 'electron', filename: 'electron', loaded: true, exports: mockElectron };
}

// ─── telemetry.js ───

describe('electron/telemetry', () => {
  let telemetry;
  const telemetryPath = path.join(tmpDir, 'telemetry.json');

  beforeEach(async () => {
    try { fs.unlinkSync(telemetryPath); } catch {}
    resetElectronModules();
    telemetry = await import('../../electron/telemetry.js');
  });

  afterEach(() => {
    try { fs.unlinkSync(telemetryPath); } catch {}
  });

  it('exports expected functions and constants', () => {
    expect(typeof telemetry.getTelemetryConsent).toBe('function');
    expect(typeof telemetry.saveTelemetryConsent).toBe('function');
    expect(typeof telemetry.captureException).toBe('function');
    expect(typeof telemetry.parseStack).toBe('function');
    expect(typeof telemetry.getSentryEnabled).toBe('function');
    expect(typeof telemetry.setSentryEnabled).toBe('function');
    expect(typeof telemetry.askTelemetryConsent).toBe('function');
    expect(typeof telemetry.SENTRY_KEY).toBe('string');
    expect(typeof telemetry.SENTRY_URL).toBe('string');
    expect(typeof telemetry.TELEMETRY_PATH).toBe('string');
  });

  it('getTelemetryConsent returns null when no file', () => {
    expect(telemetry.getTelemetryConsent()).toBeNull();
  });

  it('saveTelemetryConsent writes file and getTelemetryConsent reads it', () => {
    telemetry.saveTelemetryConsent(true);
    expect(telemetry.getTelemetryConsent()).toBe(true);
  });

  it('getSentryEnabled / setSentryEnabled', () => {
    telemetry.setSentryEnabled(true);
    expect(telemetry.getSentryEnabled()).toBe(true);
    telemetry.setSentryEnabled(false);
    expect(telemetry.getSentryEnabled()).toBe(false);
  });

  it('parseStack parses stack trace lines', () => {
    const stack = `Error: test
    at myFunc (/path/to/file.js:10:5)
    at otherFunc (/path/to/other.js:20:10)`;
    const frames = telemetry.parseStack(stack);
    expect(frames.length).toBe(2);
    expect(frames[0].function).toBe('otherFunc');
    expect(frames[1].function).toBe('myFunc');
  });

  it('parseStack handles anonymous frames', () => {
    const stack = `Error: test
    at /path/to/file.js:10:5`;
    const frames = telemetry.parseStack(stack);
    expect(frames.length).toBe(1);
    expect(frames[0].function).toBe('?');
  });

  it('parseStack filters out unparseable frames', () => {
    const stack = `Error: test
    at someGarbage`;
    expect(telemetry.parseStack(stack).length).toBe(0);
  });

  it('captureException does nothing when sentry disabled', () => {
    telemetry.setSentryEnabled(false);
    mockElectron.net.request.mockClear();
    telemetry.captureException(new Error('test'));
    expect(mockElectron.net.request).not.toHaveBeenCalled();
  });

  it('captureException sends request when sentry enabled', () => {
    telemetry.setSentryEnabled(true);
    mockElectron.net.request.mockClear();
    mockNetRequest.write.mockClear();
    mockNetRequest.end.mockClear();
    telemetry.captureException(new Error('test error'));
    expect(mockElectron.net.request).toHaveBeenCalled();
    expect(mockNetRequest.write).toHaveBeenCalled();
    expect(mockNetRequest.end).toHaveBeenCalled();
    telemetry.setSentryEnabled(false);
  });

  it('captureException handles error without stack', () => {
    telemetry.setSentryEnabled(true);
    mockElectron.net.request.mockClear();
    telemetry.captureException({ name: 'TestError', message: 'no stack' });
    expect(mockElectron.net.request).toHaveBeenCalled();
    telemetry.setSentryEnabled(false);
  });

  it('askTelemetryConsent shows dialog and saves consent (yes)', async () => {
    mockElectron.dialog.showMessageBox.mockResolvedValueOnce({ response: 0 });
    const result = await telemetry.askTelemetryConsent();
    expect(result).toBe(true);
    expect(telemetry.getTelemetryConsent()).toBe(true);
  });

  it('askTelemetryConsent returns false on decline', async () => {
    mockElectron.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 });
    const result = await telemetry.askTelemetryConsent();
    expect(result).toBe(false);
  });
});

// ─── config.js ───

describe('electron/config', () => {
  let config;
  const configPath = path.join(tmpDir, 'config.json');

  beforeEach(async () => {
    try { fs.unlinkSync(configPath); } catch {}
    resetElectronModules();
    config = await import('../../electron/config.js');
  });

  afterEach(() => {
    try { fs.unlinkSync(configPath); } catch {}
  });

  it('exports expected functions and CONFIG_PATH', () => {
    expect(typeof config.loadConfig).toBe('function');
    expect(typeof config.saveConfigToDisk).toBe('function');
    expect(typeof config.getDefaultConfig).toBe('function');
    expect(typeof config.migrateConfig).toBe('function');
    expect(typeof config.getConfig).toBe('function');
    expect(typeof config.setConfig).toBe('function');
    expect(typeof config.getActiveProfileIndex).toBe('function');
    expect(typeof config.setActiveProfileIndex).toBe('function');
    expect(typeof config.CONFIG_PATH).toBe('string');
  });

  it('getDefaultConfig returns config with profiles array', () => {
    const cfg = config.getDefaultConfig();
    expect(cfg.profiles.length).toBe(1);
    expect(cfg.profiles[0].name).toBe('Default');
    expect(cfg.profiles[0].slices.length).toBeGreaterThan(0);
  });

  it('migrateConfig converts legacy format', () => {
    const legacy = { shortcut: 'Ctrl+Space', slices: [{ label: 'X' }] };
    const migrated = config.migrateConfig(legacy);
    expect(migrated.profiles[0].shortcut).toBe('Ctrl+Space');
  });

  it('migrateConfig passes through already-migrated config', () => {
    const modern = { profiles: [{ id: 'x', name: 'X', shortcut: '', slices: [] }] };
    expect(config.migrateConfig(modern)).toBe(modern);
  });

  it('getConfig returns loaded config', () => {
    expect(config.getConfig().profiles).toBeDefined();
  });

  it('setConfig / getConfig round-trips', () => {
    const newCfg = { profiles: [{ id: 'test', name: 'Test', shortcut: '', slices: [] }] };
    config.setConfig(newCfg);
    expect(config.getConfig()).toBe(newCfg);
  });

  it('getActiveProfileIndex / setActiveProfileIndex', () => {
    config.setActiveProfileIndex(3);
    expect(config.getActiveProfileIndex()).toBe(3);
  });

  it('saveConfigToDisk writes file', () => {
    config.saveConfigToDisk({ profiles: [{ id: 'x', name: 'X', shortcut: '', slices: [] }] });
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(raw.profiles[0].name).toBe('X');
  });

  it('loadConfig reads from disk when file exists', () => {
    fs.writeFileSync(configPath, JSON.stringify({ profiles: [{ id: 'disk', name: 'Disk', shortcut: '', slices: [] }] }));
    const loaded = config.loadConfig();
    expect(loaded.profiles[0].name).toBe('Disk');
  });

  it('loadConfig creates default config when no file', () => {
    try { fs.unlinkSync(configPath); } catch {}
    const loaded = config.loadConfig();
    expect(loaded.profiles[0].name).toBe('Default');
  });
});

// ─── actions.js ───

describe('electron/actions', () => {
  let actions;

  beforeEach(async () => {
    resetElectronModules();
    actions = await import('../../electron/actions.js');
  });

  it('exports executeAction function', () => {
    expect(typeof actions.executeAction).toBe('function');
  });

  it('executeAction handles System type', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    actions.executeAction({ type: 'System', action: 'test' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('System action'), 'test');
    consoleSpy.mockRestore();
  });

  it('executeAction handles Submenu type (no-op)', () => {
    expect(() => actions.executeAction({ type: 'Submenu', slices: [] })).not.toThrow();
  });

  it('executeAction handles Script type', () => {
    expect(() => actions.executeAction({ type: 'Script', command: 'echo test' })).not.toThrow();
  });

  it('executeAction handles Program type with .app on darwin', () => {
    if (process.platform === 'darwin') {
      expect(() => actions.executeAction({
        type: 'Program', path: '/Applications/Safari.app', args: [],
      })).not.toThrow();
    }
  });

  it('executeAction handles Program type with args on darwin', () => {
    if (process.platform === 'darwin') {
      expect(() => actions.executeAction({
        type: 'Program', path: '/Applications/Safari.app', args: ['--url', 'https://example.com'],
      })).not.toThrow();
    }
  });

  it('executeAction handles Program type non-.app', () => {
    mockElectron.shell.openPath.mockClear();
    if (process.platform !== 'darwin') {
      actions.executeAction({ type: 'Program', path: '/usr/bin/test', args: [] });
      expect(mockElectron.shell.openPath).toHaveBeenCalled();
    } else {
      actions.executeAction({ type: 'Program', path: '/usr/bin/test', args: [] });
      expect(mockElectron.shell.openPath).toHaveBeenCalled();
    }
  });
});

// ─── shortcuts.js ───

describe('electron/shortcuts', () => {
  let shortcuts;

  beforeEach(async () => {
    resetElectronModules();
    mockElectron.globalShortcut.register.mockClear();
    mockElectron.globalShortcut.unregister.mockClear();
    shortcuts = await import('../../electron/shortcuts.js');
  });

  it('exports registerAllShortcuts and getRegisteredShortcuts', () => {
    expect(typeof shortcuts.registerAllShortcuts).toBe('function');
    expect(typeof shortcuts.getRegisteredShortcuts).toBe('function');
  });

  it('getRegisteredShortcuts returns empty array initially', () => {
    expect(shortcuts.getRegisteredShortcuts()).toEqual([]);
  });

  it('registerAllShortcuts registers shortcuts from config', () => {
    shortcuts.registerAllShortcuts();
    // Default config has Alt+Space
    expect(mockElectron.globalShortcut.register).toHaveBeenCalled();
  });

  it('registerAllShortcuts maps Super to Meta', async () => {
    resetElectronModules();
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      profiles: [{ id: 'x', name: 'X', shortcut: 'Super+Space', slices: [] }],
    }));
    mockElectron.globalShortcut.register.mockClear();
    shortcuts = await import('../../electron/shortcuts.js');
    shortcuts.registerAllShortcuts();
    expect(mockElectron.globalShortcut.register).toHaveBeenCalledWith('Meta+Space', expect.any(Function));
    try { fs.unlinkSync(configPath); } catch {}
  });

  it('registerAllShortcuts skips profiles without shortcuts', async () => {
    resetElectronModules();
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      profiles: [
        { id: 'a', name: 'A', shortcut: '', slices: [] },
        { id: 'b', name: 'B', shortcut: 'Ctrl+Space', slices: [] },
      ],
    }));
    mockElectron.globalShortcut.register.mockClear();
    shortcuts = await import('../../electron/shortcuts.js');
    shortcuts.registerAllShortcuts();
    expect(mockElectron.globalShortcut.register).toHaveBeenCalledTimes(1);
    try { fs.unlinkSync(configPath); } catch {}
  });

  it('registerAllShortcuts unregisters previous shortcuts first', async () => {
    resetElectronModules();
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      profiles: [{ id: 'x', name: 'X', shortcut: 'Alt+Space', slices: [] }],
    }));
    shortcuts = await import('../../electron/shortcuts.js');
    shortcuts.registerAllShortcuts();
    mockElectron.globalShortcut.unregister.mockClear();
    shortcuts.registerAllShortcuts();
    expect(mockElectron.globalShortcut.unregister).toHaveBeenCalled();
    try { fs.unlinkSync(configPath); } catch {}
  });

  it('registerAllShortcuts handles register failure gracefully', async () => {
    resetElectronModules();
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      profiles: [{ id: 'x', name: 'X', shortcut: 'Invalid+Key', slices: [] }],
    }));
    mockElectron.globalShortcut.register.mockImplementationOnce(() => { throw new Error('bad'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    shortcuts = await import('../../electron/shortcuts.js');
    expect(() => shortcuts.registerAllShortcuts()).not.toThrow();
    consoleSpy.mockRestore();
    try { fs.unlinkSync(configPath); } catch {}
  });
});

// ─── windows.js ───

describe('electron/windows', () => {
  let windows;

  beforeEach(async () => {
    resetElectronModules();
    // BrowserWindow is a regular constructor function, no mockClear needed
    windows = await import('../../electron/windows.js');
  });

  it('exports expected functions', () => {
    expect(typeof windows.createMainWindow).toBe('function');
    expect(typeof windows.createRingWindow).toBe('function');
    expect(typeof windows.showRingAtCursor).toBe('function');
    expect(typeof windows.getMainWindow).toBe('function');
    expect(typeof windows.getRingWindow).toBe('function');
    expect(typeof windows.getTray).toBe('function');
    expect(typeof windows.setTray).toBe('function');
  });

  it('getMainWindow returns null initially', () => {
    expect(windows.getMainWindow()).toBeNull();
  });

  it('getRingWindow returns null initially', () => {
    expect(windows.getRingWindow()).toBeNull();
  });

  it('getTray / setTray round-trips', () => {
    const mockTray = { id: 'tray' };
    windows.setTray(mockTray);
    expect(windows.getTray()).toBe(mockTray);
    windows.setTray(null);
  });

  it('createMainWindow creates a BrowserWindow', () => {
    windows.createMainWindow();
    expect(windows.getMainWindow()).not.toBeNull();
  });

  it('createRingWindow creates a BrowserWindow', () => {
    windows.createRingWindow();
    expect(windows.getRingWindow()).not.toBeNull();
  });

  it('showRingAtCursor creates ring window and shows it', () => {
    windows.showRingAtCursor(0);
    expect(windows.getRingWindow()).not.toBeNull();
  });

  it('showRingAtCursor does nothing if ring already visible', () => {
    windows.showRingAtCursor(0);
    const ringWin = windows.getRingWindow();
    ringWin.isVisible.mockReturnValue(true);
    const showCallCount = ringWin.show.mock.calls.length;
    windows.showRingAtCursor(0);
    // Guard returns early — show() should not be called again
    expect(ringWin.show.mock.calls.length).toBe(showCallCount);
  });

  it('createMainWindow registers close handler that hides window', () => {
    windows.createMainWindow();
    const mainWin = windows.getMainWindow();
    // Find the 'close' event handler
    const closeCall = mainWin.on.mock.calls.find(c => c[0] === 'close');
    expect(closeCall).toBeDefined();
    const handler = closeCall[1];
    const fakeEvent = { preventDefault: vi.fn() };
    handler(fakeEvent);
    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(mainWin.hide).toHaveBeenCalled();
  });

  it('createRingWindow registers blur handler that hides window', () => {
    windows.createRingWindow();
    const ringWin = windows.getRingWindow();
    const blurCall = ringWin.on.mock.calls.find(c => c[0] === 'blur');
    expect(blurCall).toBeDefined();
    const handler = blurCall[1];
    ringWin.isDestroyed.mockReturnValue(false);
    handler();
    expect(ringWin.hide).toHaveBeenCalled();
  });

  it('showRingAtCursor sends slices to ring window via executeJavaScript', () => {
    windows.showRingAtCursor(0);
    const ringWin = windows.getRingWindow();
    expect(ringWin.webContents.executeJavaScript).toHaveBeenCalled();
    expect(ringWin.show).toHaveBeenCalled();
    expect(ringWin.focus).toHaveBeenCalled();
    expect(ringWin.setBounds).toHaveBeenCalledWith(expect.objectContaining({
      width: 550, height: 550,
    }));
  });
});

// ─── config.js additional coverage ───

describe('electron/config (additional coverage)', () => {
  let config;
  const configPath = path.join(tmpDir, 'config.json');

  beforeEach(async () => {
    try { fs.unlinkSync(configPath); } catch {}
    resetElectronModules();
    config = await import('../../electron/config.js');
  });

  afterEach(() => {
    try { fs.unlinkSync(configPath); } catch {}
  });

  it('loadConfig handles corrupted JSON file gracefully', () => {
    fs.writeFileSync(configPath, '{ invalid json !!!');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loaded = config.loadConfig();
    // Falls back to default config
    expect(loaded.profiles[0].name).toBe('Default');
    consoleSpy.mockRestore();
  });

  it('migrateConfig uses default shortcut when legacy config has no shortcut', () => {
    const legacy = { slices: [{ label: 'X' }] };
    const migrated = config.migrateConfig(legacy);
    expect(migrated.profiles[0].shortcut).toBe('Alt+Space');
  });
});
