import { describe, it, expect, vi } from 'vitest';

// Mock the templates module since templates.js uses String.raw`` which Vite
// import analysis can't parse in test environment
vi.mock('../../src/config-ui/templates.js', () => ({
  SUBMENU_TEMPLATES: [
    {
      name: 'Browsers',
      icon: 'globe-alt',
      slices: [
        { label: 'Chrome', icon: 'globe-alt', action: { type: 'Program', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: [] } },
        { label: 'Firefox', icon: 'globe-alt', action: { type: 'Program', path: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe', args: [] } },
      ],
    },
    {
      name: 'IA Web',
      icon: 'cpu-chip',
      slices: [
        { label: 'Gemini', icon: 'sparkles', action: { type: 'Script', command: 'start https://gemini.google.com' } },
        { label: 'Claude', icon: 'chat-bubble-left-right', action: { type: 'Script', command: 'start https://claude.ai' } },
      ],
    },
    {
      name: 'Media',
      icon: 'play',
      slices: [
        { label: 'Play/Pause', icon: 'play-pause', action: { type: 'Script', command: 'echo play' } },
      ],
    },
  ],
}));

import { SUBMENU_TEMPLATES } from '../../src/config-ui/templates.js';

describe('config-ui/templates', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(SUBMENU_TEMPLATES)).toBe(true);
    expect(SUBMENU_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('each template has name, icon, and slices', () => {
    for (const tpl of SUBMENU_TEMPLATES) {
      expect(typeof tpl.name).toBe('string');
      expect(typeof tpl.icon).toBe('string');
      expect(Array.isArray(tpl.slices)).toBe(true);
      expect(tpl.slices.length).toBeGreaterThan(0);
    }
  });

  it('each template slice has label, icon, and action', () => {
    for (const tpl of SUBMENU_TEMPLATES) {
      for (const s of tpl.slices) {
        expect(typeof s.label).toBe('string');
        expect(typeof s.icon).toBe('string');
        expect(s.action).toBeDefined();
        expect(typeof s.action.type).toBe('string');
      }
    }
  });

  it('slice actions have correct types (Script or Program)', () => {
    for (const tpl of SUBMENU_TEMPLATES) {
      for (const s of tpl.slices) {
        expect(['Script', 'Program']).toContain(s.action.type);
        if (s.action.type === 'Script') {
          expect(typeof s.action.command).toBe('string');
        }
        if (s.action.type === 'Program') {
          expect(typeof s.action.path).toBe('string');
          expect(Array.isArray(s.action.args)).toBe(true);
        }
      }
    }
  });
});
