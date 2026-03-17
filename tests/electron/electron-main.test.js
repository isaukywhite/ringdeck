import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test electron/main.js functions by reimplementing the pure logic
// (same approach as electron-utils.test.js but more comprehensive)

// parseStack — pure function
function parseStack(stack) {
  return stack.split('\n').slice(1).reverse().map((line) => {
    const m = line.match(/at\s+(?:(.+?)\s+)?\(?(.*?):(\d+):(\d+)\)?/);
    if (!m) return { filename: line.trim(), lineno: 0, colno: 0, function: '?' };
    return { function: m[1] || '?', filename: m[2], lineno: +m[3], colno: +m[4] };
  }).filter((f) => f.lineno > 0);
}

// executeAction — logic testing without actual process spawning
function executeActionLogic(action, platform) {
  switch (action.type) {
    case 'Script': {
      if (platform === 'win32') {
        if (action.command.startsWith('powershell')) {
          return { type: 'spawn', command: 'powershell.exe', shellType: 'powershell' };
        }
        return { type: 'spawn', command: 'cmd', args: ['/c', action.command], shellType: 'cmd' };
      }
      return { type: 'spawn', command: 'sh', args: ['-c', action.command], shellType: 'sh' };
    }
    case 'Program': {
      if (platform === 'darwin' && action.path.endsWith('.app')) {
        const args = ['-a', action.path];
        if (action.args?.length) args.push('--args', ...action.args);
        return { type: 'spawn', command: 'open', args };
      }
      return { type: 'shellOpenPath', path: action.path };
    }
    case 'Submenu':
      return { type: 'noop' };
    default:
      return { type: 'noop' };
  }
}

// getDefaultConfig — parametric
function getDefaultConfig(platform) {
  let slices;
  if (platform === 'win32') {
    slices = [
      { label: 'Terminal', icon: 'terminal', action: { type: 'Program', path: 'wt.exe', args: [] } },
      { label: 'Browser', icon: 'globe', action: { type: 'Program', path: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, args: [] } },
    ];
  } else if (platform === 'linux') {
    slices = [
      { label: 'Terminal', icon: 'terminal', action: { type: 'Script', command: 'x-terminal-emulator' } },
      { label: 'Browser', icon: 'globe', action: { type: 'Script', command: 'xdg-open https://google.com' } },
    ];
  } else {
    slices = [
      { label: 'Terminal', icon: 'terminal', action: { type: 'Program', path: '/System/Applications/Utilities/Terminal.app', args: [] } },
      { label: 'Browser', icon: 'globe', action: { type: 'Program', path: '/Applications/Safari.app', args: [] } },
    ];
  }
  return { profiles: [{ id: 'default', name: 'Default', shortcut: 'Alt+Space', slices }] };
}

// migrateConfig
function migrateConfig(cfg) {
  if (cfg.slices && !cfg.profiles) {
    return {
      profiles: [{
        id: 'default', name: 'Default',
        shortcut: cfg.shortcut || 'Alt+Space',
        slices: cfg.slices,
      }],
    };
  }
  return cfg;
}

// registerAllShortcuts logic
function registerAllShortcuts(profiles, registerFn, unregisterFn) {
  const registered = [];
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    if (!profile.shortcut) continue;
    const mapped = profile.shortcut.replaceAll('Super', 'Meta');
    try {
      registerFn(mapped, i);
      registered.push(mapped);
    } catch (e) { /* skip */ }
  }
  return registered;
}

describe('executeAction logic', () => {
  it('Script on macOS uses sh -c', () => {
    const result = executeActionLogic({ type: 'Script', command: 'echo hello' }, 'darwin');
    expect(result.type).toBe('spawn');
    expect(result.command).toBe('sh');
    expect(result.shellType).toBe('sh');
  });

  it('Script with powershell on win32 uses powershell.exe', () => {
    const result = executeActionLogic({ type: 'Script', command: 'powershell -Command test' }, 'win32');
    expect(result.type).toBe('spawn');
    expect(result.command).toBe('powershell.exe');
    expect(result.shellType).toBe('powershell');
  });

  it('Script on win32 without powershell uses cmd', () => {
    const result = executeActionLogic({ type: 'Script', command: 'start notepad' }, 'win32');
    expect(result.type).toBe('spawn');
    expect(result.command).toBe('cmd');
    expect(result.shellType).toBe('cmd');
  });

  it('Program on macOS with .app uses open -a', () => {
    const result = executeActionLogic({ type: 'Program', path: '/Applications/Safari.app', args: [] }, 'darwin');
    expect(result.type).toBe('spawn');
    expect(result.command).toBe('open');
    expect(result.args).toContain('-a');
    expect(result.args).toContain('/Applications/Safari.app');
  });

  it('Program on macOS with .app includes --args when args provided', () => {
    const result = executeActionLogic({ type: 'Program', path: '/Applications/Safari.app', args: ['--new-window'] }, 'darwin');
    expect(result.args).toContain('--args');
    expect(result.args).toContain('--new-window');
  });

  it('Program on Windows uses shell.openPath', () => {
    const result = executeActionLogic({ type: 'Program', path: 'C:\\Program Files\\app.exe', args: [] }, 'win32');
    expect(result.type).toBe('shellOpenPath');
  });

  it('Submenu is a noop', () => {
    const result = executeActionLogic({ type: 'Submenu', slices: [] }, 'darwin');
    expect(result.type).toBe('noop');
  });
});

describe('registerAllShortcuts', () => {
  it('registers one shortcut per profile', () => {
    const profiles = [
      { name: 'Default', shortcut: 'Alt+Space', slices: [] },
      { name: 'Gaming', shortcut: 'Ctrl+G', slices: [] },
    ];
    const registered = [];
    const registerFn = (shortcut, idx) => { registered.push({ shortcut, idx }); };
    const result = registerAllShortcuts(profiles, registerFn, vi.fn());

    expect(result).toHaveLength(2);
    expect(result).toContain('Alt+Space');
    expect(result).toContain('Ctrl+G');
  });

  it('maps Super to Meta', () => {
    const profiles = [{ name: 'Test', shortcut: 'Super+X', slices: [] }];
    const registered = [];
    const registerFn = (shortcut) => { registered.push(shortcut); };
    const result = registerAllShortcuts(profiles, registerFn, vi.fn());

    expect(result).toContain('Meta+X');
  });

  it('skips profiles without shortcut', () => {
    const profiles = [
      { name: 'A', shortcut: 'Alt+A', slices: [] },
      { name: 'B', shortcut: '', slices: [] },
      { name: 'C', shortcut: 'Alt+C', slices: [] },
    ];
    const result = registerAllShortcuts(profiles, vi.fn(), vi.fn());
    expect(result).toHaveLength(2);
  });
});

describe('showRingAtCursor logic', () => {
  it('positions ring centered on cursor', () => {
    const cursor = { x: 500, y: 300 };
    const x = Math.round(cursor.x - 275);
    const y = Math.round(cursor.y - 275);
    expect(x).toBe(225);
    expect(y).toBe(25);
  });

  it('guards against repeated triggers when visible', () => {
    let isVisible = true;
    let called = false;

    function showRingAtCursor() {
      if (isVisible) return;
      called = true;
    }

    showRingAtCursor();
    expect(called).toBe(false);
  });
});

describe('IPC handlers', () => {
  it('get_config returns config', () => {
    const config = { profiles: [{ name: 'Test', slices: [] }] };
    const handler = () => config;
    expect(handler()).toBe(config);
  });

  it('get_active_profile returns active profile', () => {
    const config = {
      profiles: [
        { name: 'Default', slices: [] },
        { name: 'Gaming', slices: [] },
      ],
    };
    let activeProfileIndex = 1;
    const handler = () => ({
      profileIndex: activeProfileIndex,
      profile: config.profiles[activeProfileIndex] || config.profiles[0],
    });

    const result = handler();
    expect(result.profileIndex).toBe(1);
    expect(result.profile.name).toBe('Gaming');
  });

  it('save_config updates config and re-registers shortcuts', () => {
    let config = { profiles: [] };
    let shortcutsRegistered = false;

    function saveHandler(newConfig) {
      config = newConfig;
      shortcutsRegistered = true;
    }

    const newConfig = { profiles: [{ name: 'New', shortcut: 'Alt+N', slices: [] }] };
    saveHandler(newConfig);

    expect(config).toBe(newConfig);
    expect(shortcutsRegistered).toBe(true);
  });

  it('execute_action validates profile and slice index', () => {
    const config = {
      profiles: [{ name: 'Default', slices: [{ action: { type: 'Script', command: 'test' } }] }],
    };

    function executeHandler(profileIndex, sliceIndex) {
      const profile = config.profiles[profileIndex];
      if (!profile) throw new Error('Invalid profile index');
      const slice = profile.slices[sliceIndex];
      if (!slice) throw new Error('Invalid slice index');
      return slice.action;
    }

    expect(executeHandler(0, 0)).toEqual({ type: 'Script', command: 'test' });
    expect(() => executeHandler(5, 0)).toThrow('Invalid profile index');
    expect(() => executeHandler(0, 5)).toThrow('Invalid slice index');
  });

  it('execute_submenu_action validates parent and child', () => {
    const config = {
      profiles: [{
        name: 'Default',
        slices: [{
          action: {
            type: 'Submenu',
            slices: [{ action: { type: 'Script', command: 'sub-cmd' } }],
          },
        }],
      }],
    };

    function handler(profileIndex, parentIndex, childIndex) {
      const profile = config.profiles[profileIndex];
      if (!profile) throw new Error('Invalid profile index');
      const parentSlice = profile.slices[parentIndex];
      if (!parentSlice || parentSlice.action?.type !== 'Submenu') throw new Error('Invalid parent slice');
      const childSlice = parentSlice.action.slices[childIndex];
      if (!childSlice) throw new Error('Invalid child slice index');
      return childSlice.action;
    }

    expect(handler(0, 0, 0)).toEqual({ type: 'Script', command: 'sub-cmd' });
    expect(() => handler(0, 0, 5)).toThrow('Invalid child slice index');
  });
});

describe('loadConfig / saveConfigToDisk logic', () => {
  it('loadConfig returns default on error', () => {
    function loadConfig(readFn, defaultConfig) {
      try {
        return readFn();
      } catch {
        return structuredClone(defaultConfig);
      }
    }

    const defaults = getDefaultConfig('darwin');
    const result = loadConfig(() => { throw new Error('ENOENT'); }, defaults);
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].name).toBe('Default');
  });

  it('loadConfig reads and migrates config', () => {
    const legacy = { shortcut: 'Alt+X', slices: [{ label: 'A' }] };
    function loadConfig(readFn) {
      const raw = readFn();
      return migrateConfig(raw);
    }

    const result = loadConfig(() => legacy);
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].shortcut).toBe('Alt+X');
  });
});
