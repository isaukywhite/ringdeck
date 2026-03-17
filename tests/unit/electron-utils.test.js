import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll test the functions from electron/main.js by extracting them.
// Since electron/main.js uses require() and has heavy side-effects (Electron app lifecycle),
// we test the pure functions by reimplementing them here from source,
// or by creating a testable module.

// parseStack is a pure function — let's extract and test it directly
function parseStack(stack) {
  return stack.split('\n').slice(1).reverse().map((line) => {
    const m = line.match(/at\s+(?:(.+?)\s+)?\(?(.*?):(\d+):(\d+)\)?/);
    if (!m) return { filename: line.trim(), lineno: 0, colno: 0, function: '?' };
    return { function: m[1] || '?', filename: m[2], lineno: +m[3], colno: +m[4] };
  }).filter((f) => f.lineno > 0);
}

// getDefaultConfig is platform-dependent — test its logic
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

  return {
    profiles: [{ id: 'default', name: 'Default', shortcut: 'Alt+Space', slices }],
  };
}

// migrateConfig — test its logic
function migrateConfig(cfg) {
  if (cfg.slices && !cfg.profiles) {
    return {
      profiles: [{
        id: 'default',
        name: 'Default',
        shortcut: cfg.shortcut || 'Alt+Space',
        slices: cfg.slices,
      }],
    };
  }
  return cfg;
}

describe('parseStack', () => {
  it('parses a real stack trace', () => {
    const stack = `Error: test
    at Object.<anonymous> (/app/main.js:10:15)
    at Module._compile (internal/modules/cjs/loader.js:999:30)`;
    const frames = parseStack(stack);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[frames.length - 1].filename).toBe('/app/main.js');
    expect(frames[frames.length - 1].lineno).toBe(10);
    expect(frames[frames.length - 1].colno).toBe(15);
  });

  it('reverses frame order (bottom-up)', () => {
    const stack = `Error: test
    at foo (/a.js:1:1)
    at bar (/b.js:2:2)`;
    const frames = parseStack(stack);
    expect(frames[0].filename).toBe('/b.js');
    expect(frames[1].filename).toBe('/a.js');
  });

  it('filters out lines without valid line numbers', () => {
    const stack = `Error: test
    at something invalid
    at foo (/a.js:5:10)`;
    const frames = parseStack(stack);
    expect(frames.length).toBe(1);
    expect(frames[0].lineno).toBe(5);
  });

  it('handles anonymous functions', () => {
    const stack = `Error: test
    at /app/main.js:10:15`;
    const frames = parseStack(stack);
    expect(frames.length).toBe(1);
    expect(frames[0].function).toBe('?');
  });
});

describe('getDefaultConfig', () => {
  it('returns Windows config for win32', () => {
    const cfg = getDefaultConfig('win32');
    expect(cfg.profiles).toHaveLength(1);
    expect(cfg.profiles[0].slices[0].action.type).toBe('Program');
    expect(cfg.profiles[0].slices[0].action.path).toBe('wt.exe');
  });

  it('returns macOS config for darwin', () => {
    const cfg = getDefaultConfig('darwin');
    expect(cfg.profiles[0].slices[0].action.path).toContain('Terminal.app');
  });

  it('returns Linux config for linux', () => {
    const cfg = getDefaultConfig('linux');
    expect(cfg.profiles[0].slices[0].action.type).toBe('Script');
    expect(cfg.profiles[0].slices[0].action.command).toBe('x-terminal-emulator');
  });

  it('all platforms have 2 default slices', () => {
    for (const platform of ['win32', 'darwin', 'linux']) {
      const cfg = getDefaultConfig(platform);
      expect(cfg.profiles[0].slices).toHaveLength(2);
    }
  });
});

describe('migrateConfig', () => {
  it('migrates legacy format (slices at root) to profiles format', () => {
    const legacy = {
      shortcut: 'Ctrl+Space',
      slices: [{ label: 'Test', icon: 'star', action: { type: 'Script', command: 'echo' } }],
    };
    const result = migrateConfig(legacy);
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0].shortcut).toBe('Ctrl+Space');
    expect(result.profiles[0].slices).toEqual(legacy.slices);
  });

  it('uses default shortcut when legacy has none', () => {
    const legacy = { slices: [] };
    const result = migrateConfig(legacy);
    expect(result.profiles[0].shortcut).toBe('Alt+Space');
  });

  it('returns modern format unchanged', () => {
    const modern = {
      profiles: [{ id: 'p1', name: 'My Profile', shortcut: 'Alt+X', slices: [] }],
    };
    const result = migrateConfig(modern);
    expect(result).toBe(modern); // same reference
  });
});
