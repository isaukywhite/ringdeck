import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import Module from 'node:module';

// Store IPC handlers registered via ipcMain.handle
const ipcHandlers = {};

const mockElectron = {
  ipcMain: {
    handle: vi.fn((channel, handler) => {
      ipcHandlers[channel] = handler;
    }),
  },
  app: {
    getPath: vi.fn(() => '/tmp'),
    getVersion: vi.fn(() => '0.2.2'),
    getFileIcon: vi.fn().mockResolvedValue({ isEmpty: () => false, toDataURL: () => 'data:image/png;base64,icon' }),
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/Applications/Test.app'] }),
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({
      isEmpty: () => false,
      resize: () => ({ toDataURL: () => 'data:image/png;base64,resized' }),
    })),
  },
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  Tray: vi.fn(),
  Menu: { buildFromTemplate: vi.fn() },
  screen: { getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 300 })) },
  shell: { openPath: vi.fn().mockResolvedValue('') },
};

// Override require('electron') and other deps
const origResolveFilename = Module._resolveFilename;
beforeAll(() => {
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'electron') return 'electron';
    return origResolveFilename.call(this, request, parent, isMain, options);
  };
  require.cache['electron'] = {
    id: 'electron', filename: 'electron', loaded: true,
    exports: mockElectron,
  };
});

// Clear and re-require modules
function loadIpc() {
  // Clear relevant cache entries
  for (const key of Object.keys(require.cache)) {
    if (key.includes('/electron/') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  }
  Object.keys(ipcHandlers).forEach(k => delete ipcHandlers[k]);
  mockElectron.ipcMain.handle.mockClear();

  // Pre-load dependencies that ipc.js requires
  const telemetryPath = require.resolve('../../electron/telemetry.js');
  delete require.cache[telemetryPath];
  require('../../electron/telemetry.js');

  const configPath = require.resolve('../../electron/config.js');
  delete require.cache[configPath];
  const configModule = require('../../electron/config.js');
  configModule.setConfig({
    profiles: [{
      id: 'default', name: 'Default', shortcut: 'Alt+Space',
      slices: [
        { label: 'Term', action: { type: 'Script', command: 'echo hi' } },
        { label: 'Menu', action: { type: 'Submenu', slices: [
          { label: 'Sub', action: { type: 'Script', command: 'echo sub' } }
        ] } },
      ],
    }],
  });

  const actionsPath = require.resolve('../../electron/actions.js');
  delete require.cache[actionsPath];
  require('../../electron/actions.js');

  const windowsPath = require.resolve('../../electron/windows.js');
  delete require.cache[windowsPath];
  require('../../electron/windows.js');

  const shortcutsPath = require.resolve('../../electron/shortcuts.js');
  delete require.cache[shortcutsPath];
  require('../../electron/shortcuts.js');

  // Now load ipc.js
  const ipcPath = require.resolve('../../electron/ipc.js');
  delete require.cache[ipcPath];
  require('../../electron/ipc.js');
}

describe('electron/ipc.js handlers', () => {
  beforeEach(() => {
    loadIpc();
  });

  it('registers all IPC handlers', () => {
    const channels = Object.keys(ipcHandlers);
    expect(channels).toContain('get_telemetry_consent');
    expect(channels).toContain('set_telemetry_consent');
    expect(channels).toContain('get_config');
    expect(channels).toContain('get_active_profile');
    expect(channels).toContain('save_config');
    expect(channels).toContain('execute_action');
    expect(channels).toContain('hide_ring');
    expect(channels).toContain('get_file_icon');
    expect(channels).toContain('execute_submenu_action');
    expect(channels).toContain('open_file_dialog');
    expect(channels).toContain('get_ring_color');
    expect(channels).toContain('get_ring_size');
    expect(channels).toContain('set_ring_color');
    expect(channels).toContain('set_ring_size');
    expect(channels).toContain('save_settings');
    expect(channels).toContain('get_app_version');
  });

  it('get_config returns config object', () => {
    const result = ipcHandlers['get_config']();
    expect(result).toHaveProperty('profiles');
    expect(result.profiles.length).toBeGreaterThan(0);
  });

  it('get_active_profile returns profile with index', () => {
    const result = ipcHandlers['get_active_profile']();
    expect(result).toHaveProperty('profileIndex');
    expect(result).toHaveProperty('profile');
    expect(result.profile.name).toBe('Default');
  });

  it('get_telemetry_consent returns boolean', () => {
    const result = ipcHandlers['get_telemetry_consent']();
    expect(typeof result).toBe('boolean');
  });

  it('set_telemetry_consent updates state', () => {
    ipcHandlers['set_telemetry_consent'](null, true);
    expect(ipcHandlers['get_telemetry_consent']()).toBe(true);
    ipcHandlers['set_telemetry_consent'](null, false);
    expect(ipcHandlers['get_telemetry_consent']()).toBe(false);
  });

  it('save_config updates config and re-registers shortcuts', () => {
    const newConfig = {
      profiles: [{ id: 'new', name: 'New', shortcut: 'Ctrl+N', slices: [] }],
    };
    ipcHandlers['save_config'](null, newConfig);
    const result = ipcHandlers['get_config']();
    expect(result.profiles[0].name).toBe('New');
  });

  it('execute_action runs action for valid index', () => {
    expect(() => ipcHandlers['execute_action'](null, 0)).not.toThrow();
  });

  it('execute_action throws for invalid index', () => {
    expect(() => ipcHandlers['execute_action'](null, 99)).toThrow('Invalid slice index');
  });

  it('execute_submenu_action runs sub-action', () => {
    expect(() => ipcHandlers['execute_submenu_action'](null, 1, 0)).not.toThrow();
  });

  it('execute_submenu_action throws for invalid child', () => {
    expect(() => ipcHandlers['execute_submenu_action'](null, 1, 99)).toThrow('Invalid child slice index');
  });

  it('execute_submenu_action throws for non-submenu parent', () => {
    expect(() => ipcHandlers['execute_submenu_action'](null, 0, 0)).toThrow('Invalid parent slice');
  });

  it('hide_ring hides the ring window', () => {
    // No ring window exists, should not throw
    expect(() => ipcHandlers['hide_ring']()).not.toThrow();
  });

  it('open_file_dialog returns file path', async () => {
    const result = await ipcHandlers['open_file_dialog']();
    expect(result).toBe('/Applications/Test.app');
  });

  it('open_file_dialog returns null when canceled', async () => {
    mockElectron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    const result = await ipcHandlers['open_file_dialog']();
    expect(result).toBeNull();
  });

  it('get_file_icon returns icon data URL', async () => {
    const result = await ipcHandlers['get_file_icon'](null, '/usr/bin/node');
    expect(result).toContain('data:image');
  });

  it('get_ring_color returns default blue when no settings', () => {
    const result = ipcHandlers['get_ring_color']();
    expect(result).toBe('#0A84FF');
  });

  it('get_ring_size returns default medium when no settings', () => {
    const result = ipcHandlers['get_ring_size']();
    expect(result).toBe('medium');
  });

  it('set_ring_color updates the ring color', () => {
    ipcHandlers['set_ring_color'](null, '#FF4D94');
    expect(ipcHandlers['get_ring_color']()).toBe('#FF4D94');
  });

  it('set_ring_size updates the ring size', () => {
    ipcHandlers['set_ring_size'](null, 'small');
    expect(ipcHandlers['get_ring_size']()).toBe('small');
  });

  it('save_settings persists settings to config', () => {
    const settings = {
      ringColor: '#34D058',
      ringSize: 'large',
      launchAtStartup: false,
      closeToTray: true,
      sendErrorReports: false,
    };
    ipcHandlers['save_settings'](null, settings);
    const config = ipcHandlers['get_config']();
    expect(config.settings).toEqual(settings);
  });

  it('get_app_version returns a version string', () => {
    const result = ipcHandlers['get_app_version']();
    expect(result).toBe('0.2.2');
  });
});
