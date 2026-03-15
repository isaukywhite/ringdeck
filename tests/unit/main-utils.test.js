import { describe, it, expect } from 'vitest';
import { appName, actionSummary, escAttr, migrateLegacyProgram, migrateIcon, sliceIcon } from '../../src/config-ui/utils.js';

describe('appName', () => {
  it('extracts name from Windows path', () => {
    expect(appName(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`)).toBe('chrome');
  });

  it('extracts name from Unix path', () => {
    expect(appName('/Applications/Safari.app')).toBe('Safari');
  });

  it('extracts name from macOS .app bundle', () => {
    expect(appName('/Applications/Visual Studio Code.app')).toBe('Visual Studio Code');
  });

  it('handles path without extension', () => {
    expect(appName('/usr/bin/node')).toBe('node');
  });

  it('returns empty string for empty/null input', () => {
    expect(appName('')).toBe('');
    expect(appName(null)).toBe('');
    expect(appName(undefined)).toBe('');
  });
});

describe('actionSummary', () => {
  it('returns command for Script type', () => {
    expect(actionSummary({ type: 'Script', command: 'echo hello' })).toBe('echo hello');
  });

  it('returns "No command" for Script without command', () => {
    expect(actionSummary({ type: 'Script', command: '' })).toBe('No command');
  });

  it('returns app name for Program type', () => {
    expect(actionSummary({ type: 'Program', path: '/Applications/Safari.app' })).toBe('Safari');
  });

  it('returns "No program" for Program without path', () => {
    expect(actionSummary({ type: 'Program', path: '' })).toBe('No program');
  });

  it('returns sub-action count for Submenu type', () => {
    expect(actionSummary({ type: 'Submenu', slices: [{}, {}, {}] })).toBe('3 sub-actions');
  });

  it('handles singular sub-action', () => {
    expect(actionSummary({ type: 'Submenu', slices: [{}] })).toBe('1 sub-action');
  });

  it('handles Submenu with no slices', () => {
    expect(actionSummary({ type: 'Submenu' })).toBe('0 sub-actions');
  });

  it('returns empty string for unknown type', () => {
    expect(actionSummary({ type: 'Unknown' })).toBe('');
  });
});

describe('escAttr', () => {
  it('escapes ampersand', () => {
    expect(escAttr('a&b')).toBe('a&amp;b');
  });

  it('escapes double quotes', () => {
    expect(escAttr('a"b')).toBe('a&quot;b');
  });

  it('escapes less-than', () => {
    expect(escAttr('a<b')).toBe('a&lt;b');
  });

  it('handles null/undefined', () => {
    expect(escAttr(null)).toBe('');
    expect(escAttr(undefined)).toBe('');
  });

  it('escapes multiple special chars', () => {
    expect(escAttr('<"&')).toBe('&lt;&quot;&amp;');
  });
});

describe('migrateLegacyProgram', () => {
  it('migrates open -a format to direct .app path', () => {
    const s = { action: { type: 'Program', path: 'open', args: ['-a', 'Safari'] } };
    migrateLegacyProgram(s);
    expect(s.action.path).toBe('/Applications/Safari.app');
    expect(s.action.args).toEqual([]);
  });

  it('does not modify non-Program types', () => {
    const s = { action: { type: 'Script', command: 'echo test' } };
    migrateLegacyProgram(s);
    expect(s.action.type).toBe('Script');
  });

  it('does not modify already correct Program paths', () => {
    const s = { action: { type: 'Program', path: '/Applications/Safari.app', args: [] } };
    migrateLegacyProgram(s);
    expect(s.action.path).toBe('/Applications/Safari.app');
  });
});

describe('migrateIcon', () => {
  it('migrates emoji to heroicon name', () => {
    const s = { icon: '🖥️' };
    migrateIcon(s);
    expect(s.icon).toBe('computer-desktop');
  });

  it('keeps valid heroicon name unchanged', () => {
    const s = { icon: 'globe-alt' };
    migrateIcon(s);
    expect(s.icon).toBe('globe-alt');
  });

  it('falls back to cog-6-tooth for unknown icon', () => {
    const s = { icon: 'nonexistent-icon' };
    migrateIcon(s);
    expect(s.icon).toBe('cog-6-tooth');
  });

  it('falls back to cog-6-tooth for missing icon', () => {
    const s = {};
    migrateIcon(s);
    expect(s.icon).toBe('cog-6-tooth');
  });
});

describe('sliceIcon', () => {
  it('returns img tag for customIcon', () => {
    const s = { customIcon: 'data:image/png;base64,abc' };
    const result = sliceIcon(s, 20);
    expect(result).toContain('<img');
    expect(result).toContain('data:image/png;base64,abc');
    expect(result).toContain('20px');
  });

  it('returns resolved icon for icon name', () => {
    const s = { icon: 'globe-alt' };
    const result = sliceIcon(s);
    expect(result).toContain('svg');
  });

  it('uses custom size', () => {
    const s = { customIcon: 'data:image/png;base64,abc' };
    const result = sliceIcon(s, 32);
    expect(result).toContain('32px');
  });
});
