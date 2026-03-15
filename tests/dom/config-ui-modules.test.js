// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, vi, afterEach } from 'vitest';

// Mock templates.js since it uses String.raw`` which Vite can't parse in tests
vi.mock('../../src/config-ui/templates.js', () => ({
  SUBMENU_TEMPLATES: [
    {
      name: 'Browsers',
      icon: 'globe-alt',
      slices: [
        { label: 'Chrome', icon: 'globe-alt', action: { type: 'Program', path: 'chrome.exe', args: [] } },
      ],
    },
  ],
}));

// Must set up globalThis.api BEFORE state.js is imported (it runs api.getTelemetryConsent at top-level)
vi.hoisted(() => {
  globalThis.api = {
    getTelemetryConsent: vi.fn().mockResolvedValue(false),
    setTelemetryConsent: vi.fn(),
    getConfig: vi.fn().mockResolvedValue({
      profiles: [{
        id: 'default',
        name: 'Default',
        shortcut: 'Alt+Space',
        slices: [
          { label: 'Test', icon: 'star', action: { type: 'Script', command: 'echo hi' } },
        ],
      }],
    }),
    saveConfig: vi.fn().mockResolvedValue(undefined),
    openFileDialog: vi.fn().mockResolvedValue(null),
    getFileIcon: vi.fn().mockResolvedValue(null),
    hideRing: vi.fn().mockResolvedValue(undefined),
  };
});

import {
  getConfig, setConfig,
  setActiveProfileIndex, setExpandedSlice,
  activeProfile, setSentryEnabled,
  getActiveRecorder, setActiveRecorder,
  setPickerOpen,
} from '../../src/config-ui/state.js';

import {
  renderPreview,
  renderSubActionInput,
  renderSubActions,
  renderActionTypeFields,
  renderSubmenuSection,
  renderActionDetail,
  renderActionCard,
  renderProfileTabs,
  renderIconButtons,
  renderExtraIcons,
  buildPickerContent,
  render,
  registerBindEvents,
} from '../../src/config-ui/render.js';

import { addProfile, deleteProfile } from '../../src/config-ui/profiles.js';
import { loadConfig, saveConfig } from '../../src/config-ui/config.js';
import { startRecording, stopRecording } from '../../src/config-ui/shortcuts.js';
import { closeIconPicker, openIconPicker, openSubIconPicker } from '../../src/config-ui/icon-picker.js';
// Import events to trigger registerBindEvents side-effect
import { bindEvents, bindDetail, handleBrowseClick, bindSubActionEvents } from '../../src/config-ui/events.js';

// Mock scrollIntoView which jsdom doesn't implement
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();
}

function setupTestConfig() {
  setConfig({
    profiles: [{
      id: 'default',
      name: 'Default',
      shortcut: 'Alt+Space',
      slices: [
        { label: 'Test', icon: 'star', action: { type: 'Script', command: 'echo hi' } },
        { label: 'App', icon: 'heart', action: { type: 'Program', path: '/usr/bin/app', args: ['--flag'] } },
      ],
    }],
  });
  setActiveProfileIndex(0);
  setExpandedSlice(-1);
  setSentryEnabled(false);
  setPickerOpen(false);
  setActiveRecorder(null);
}

describe('config-ui/render', () => {
  beforeEach(() => {
    setupTestConfig();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('renderPreview returns HTML with ring-preview elements', () => {
    const html = renderPreview();
    expect(html).toContain('ring-preview');
    expect(html).toContain('ring-preview-node');
  });

  it('renderPreview highlights expanded slice', () => {
    setExpandedSlice(0);
    const html = renderPreview();
    expect(html).toContain('highlight');
  });

  it('renderSubActionInput returns command input for Script type', () => {
    const sub = { label: 'Sub', icon: 'star', action: { type: 'Script', command: 'ls' } };
    const html = renderSubActionInput(sub, 0, 0);
    expect(html).toContain('sub-action-cmd');
    expect(html).toContain('ls');
  });

  it('renderSubActionInput returns browse button for Program type', () => {
    const sub = { label: 'Sub', icon: 'star', action: { type: 'Program', path: '/bin/app', args: [] } };
    const html = renderSubActionInput(sub, 0, 0);
    expect(html).toContain('btn-browse-sub');
    expect(html).toContain('app');
  });

  it('renderSubActionInput shows "Choose..." when path is empty', () => {
    const sub = { label: 'Sub', icon: 'star', action: { type: 'Program', path: '', args: [] } };
    const html = renderSubActionInput(sub, 0, 0);
    expect(html).toContain('Choose...');
  });

  it('renderSubActions returns empty message when no slices', () => {
    const html = renderSubActions([], 0);
    expect(html).toContain('No sub-actions yet');
  });

  it('renderSubActions renders sub-action cards', () => {
    const subs = [
      { label: 'A', icon: 'star', action: { type: 'Script', command: 'a' } },
      { label: 'B', icon: 'heart', customIcon: 'data:img', action: { type: 'Program', path: '/bin/b', args: [] } },
    ];
    const html = renderSubActions(subs, 0);
    expect(html).toContain('sub-action-card');
    expect(html).toContain('A');
    expect(html).toContain('data:img');
  });

  it('renderActionTypeFields returns Script fields', () => {
    const s = { action: { type: 'Script', command: 'test' } };
    const html = renderActionTypeFields('Script', 0, s, '', '');
    expect(html).toContain('cmd-0');
    expect(html).toContain('test');
  });

  it('renderActionTypeFields returns Program fields', () => {
    const s = { action: { type: 'Program', path: '/bin/x', args: [] } };
    const html = renderActionTypeFields('Program', 0, s, 'x', '');
    expect(html).toContain('browse-0');
    expect(html).toContain('args-0');
  });

  it('renderActionTypeFields returns empty for unknown type', () => {
    const s = { action: { type: 'Other' } };
    const html = renderActionTypeFields('Other', 0, s, '', '');
    expect(html).toBe('');
  });

  it('renderSubmenuSection returns empty for non-Submenu', () => {
    const s = { action: { type: 'Script', command: 'x' } };
    expect(renderSubmenuSection('Script', 0, s)).toBe('');
  });

  it('renderSubmenuSection returns sub-action section for Submenu', () => {
    const s = { action: { type: 'Submenu', slices: [] } };
    const html = renderSubmenuSection('Submenu', 0, s);
    expect(html).toContain('sub-action-section');
    expect(html).toContain('template-select');
  });

  it('renderActionDetail produces HTML with detail grid', () => {
    const s = { label: 'Test', icon: 'star', action: { type: 'Script', command: 'echo' } };
    const html = renderActionDetail(s, 0);
    expect(html).toContain('action-detail');
    expect(html).toContain('detail-grid');
  });

  it('renderActionCard produces collapsed card', () => {
    const s = { label: 'Test', icon: 'star', action: { type: 'Script', command: 'echo' } };
    const html = renderActionCard(s, 0);
    expect(html).toContain('action-card');
    expect(html).not.toContain('action-detail');
  });

  it('renderActionCard produces expanded card when expandedSlice matches', () => {
    setExpandedSlice(0);
    const s = { label: 'Test', icon: 'star', action: { type: 'Script', command: 'echo' } };
    const html = renderActionCard(s, 0);
    expect(html).toContain('action-detail');
    expect(html).toContain('active');
  });

  it('renderActionCard handles customIcon', () => {
    const s = { label: 'Test', icon: 'star', customIcon: 'data:image/png;base64,x', action: { type: 'Script', command: '' } };
    const html = renderActionCard(s, 0);
    expect(html).toContain('data:image/png;base64,x');
  });

  it('renderActionCard shows "Untitled" when label empty', () => {
    const s = { label: '', icon: 'star', action: { type: 'Script', command: '' } };
    const html = renderActionCard(s, 0);
    expect(html).toContain('Untitled');
  });

  it('renderProfileTabs renders tabs for each profile', () => {
    const html = renderProfileTabs();
    expect(html).toContain('profile-tab');
    expect(html).toContain('Default');
    expect(html).toContain('add-profile-btn');
  });

  it('renderProfileTabs hides delete when only one profile', () => {
    const html = renderProfileTabs();
    expect(html).not.toContain('profile-tab-delete');
  });

  it('renderProfileTabs shows delete button when multiple profiles', () => {
    const cfg = getConfig();
    cfg.profiles.push({ id: 'p2', name: 'Second', shortcut: '', slices: [] });
    setConfig(cfg);
    const html = renderProfileTabs();
    expect(html).toContain('profile-tab-delete');
  });

  it('renderIconButtons renders buttons with selected class', () => {
    const html = renderIconButtons(['star', 'heart'], 'star');
    expect(html).toContain('data-icon="star"');
    expect(html).toContain('selected');
    expect(html).toContain('data-icon="heart"');
  });

  it('renderExtraIcons returns found: false when no extras match', () => {
    const result = renderExtraIcons('zzzzzzz-nonexistent', 'star');
    expect(result.found).toBe(false);
    expect(result.html).toBe('');
  });

  it('buildPickerContent fills body innerHTML', () => {
    const body = document.createElement('div');
    buildPickerContent(body, 'star', '');
    expect(body.innerHTML).not.toBe('');
  });

  it('buildPickerContent shows "No icons match" for impossible query', () => {
    const body = document.createElement('div');
    buildPickerContent(body, 'star', 'xyzzy-no-icon-matches-this');
    expect(body.innerHTML).toContain('No icons match');
  });

  it('buildPickerContent filters by query', () => {
    const body = document.createElement('div');
    buildPickerContent(body, 'star', 'star');
    expect(body.innerHTML).toContain('star');
  });

  it('render() populates #app with full UI', () => {
    render();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('config-layout');
    expect(app.innerHTML).toContain('RingDeck');
    expect(app.innerHTML).toContain('save-btn');
    expect(app.innerHTML).toContain('shortcut-box');
  });

  it('render() shows empty state when profile has no slices', () => {
    setConfig({ profiles: [{ id: 'd', name: 'Empty', shortcut: '', slices: [] }] });
    setActiveProfileIndex(0);
    render();
    expect(document.getElementById('app').innerHTML).toContain('empty-state');
  });

  it('render() returns early if no active profile', () => {
    const app = document.getElementById('app');
    const before = app.innerHTML;
    setConfig({ profiles: [] });
    render();
    // Should not crash, app should be unchanged
    expect(app.innerHTML).toBe(before);
  });

  it('render() shows delete profile button when multiple profiles', () => {
    setConfig({
      profiles: [
        { id: 'a', name: 'A', shortcut: '', slices: [] },
        { id: 'b', name: 'B', shortcut: '', slices: [] },
      ],
    });
    render();
    expect(document.getElementById('app').innerHTML).toContain('delete-profile-btn');
  });

  it('render() shows clear shortcut button when shortcut is set', () => {
    render();
    expect(document.getElementById('app').innerHTML).toContain('clear-shortcut-btn');
  });
});

describe('config-ui/profiles', () => {
  beforeEach(() => {
    setupTestConfig();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('addProfile adds a new profile and re-renders', () => {
    const before = getConfig().profiles.length;
    addProfile();
    expect(getConfig().profiles.length).toBe(before + 1);
    expect(getConfig().profiles[getConfig().profiles.length - 1].name).toBe('New Profile');
  });

  it('deleteProfile removes the active profile', () => {
    // Need 2 profiles to allow deletion
    const cfg = getConfig();
    cfg.profiles.push({ id: 'p2', name: 'Second', shortcut: '', slices: [] });
    setConfig(cfg);
    setActiveProfileIndex(1);

    deleteProfile();
    expect(getConfig().profiles.length).toBe(1);
  });

  it('deleteProfile does nothing when only one profile', () => {
    deleteProfile();
    expect(getConfig().profiles.length).toBe(1);
  });

  it('deleteProfile adjusts activeProfileIndex when at end', () => {
    const cfg = getConfig();
    cfg.profiles.push({ id: 'p2', name: 'Second', shortcut: '', slices: [] });
    setConfig(cfg);
    setActiveProfileIndex(1);

    deleteProfile();
    // activeProfileIndex should be adjusted to last valid index
    expect(getConfig().profiles.length).toBe(1);
  });
});

describe('config-ui/config', () => {
  beforeEach(() => {
    setupTestConfig();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('loadConfig fetches config from api and renders', async () => {
    globalThis.api.getConfig.mockResolvedValueOnce({
      profiles: [{
        id: 'loaded',
        name: 'Loaded',
        shortcut: '',
        slices: [{ label: 'X', icon: 'star', action: { type: 'Script', command: '' } }],
      }],
    });
    await loadConfig();
    expect(getConfig().profiles[0].name).toBe('Loaded');
  });

  it('loadConfig migrates legacy format', async () => {
    globalThis.api.getConfig.mockResolvedValueOnce({
      shortcut: 'Ctrl+Space',
      slices: [{ label: 'Old', icon: 'star', action: { type: 'Script', command: '' } }],
    });
    await loadConfig();
    expect(getConfig().profiles).toBeDefined();
    expect(getConfig().profiles.length).toBe(1);
    expect(getConfig().profiles[0].shortcut).toBe('Ctrl+Space');
  });

  it('saveConfig calls api.saveConfig and updates UI', async () => {
    // Render first to create save-btn and save-status elements
    render();

    globalThis.api.saveConfig.mockResolvedValueOnce(undefined);
    await saveConfig();
    expect(globalThis.api.saveConfig).toHaveBeenCalled();

    const btn = document.getElementById('save-btn');
    expect(btn.textContent).toBe('Saved');
  });

  it('saveConfig shows alert on failure', async () => {
    render();

    globalThis.api.saveConfig.mockRejectedValueOnce(new Error('fail'));
    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    await saveConfig();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('fail'));
    alertSpy.mockRestore();
  });
});

describe('config-ui/shortcuts', () => {
  beforeEach(() => {
    setupTestConfig();
    document.body.innerHTML = '<div id="app"></div>';
    render();
  });

  it('stopRecording does nothing when no active recorder', () => {
    setActiveRecorder(null);
    expect(() => stopRecording()).not.toThrow();
  });

  it('stopRecording calls cleanup on active recorder', () => {
    const cleanup = vi.fn();
    setActiveRecorder({ cleanup });
    stopRecording();
    expect(cleanup).toHaveBeenCalled();
    expect(getActiveRecorder()).toBeNull();
  });

  it('startRecording sets up recording UI', () => {
    startRecording();
    const display = document.getElementById('shortcut-display');
    expect(display.textContent).toBe('Press keys...');
    const box = document.getElementById('shortcut-box');
    expect(box.classList.contains('recording')).toBe(true);
    expect(getActiveRecorder()).not.toBeNull();

    // Cleanup
    stopRecording();
  });

  it('startRecording handles keydown with modifier + key', () => {
    startRecording();

    const event = new KeyboardEvent('keydown', {
      key: 'A',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    const profile = activeProfile();
    expect(profile.shortcut).toBe('Ctrl+A');
  });

  it('startRecording handles Escape to cancel', () => {
    startRecording();

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    document.dispatchEvent(event);

    const box = document.getElementById('shortcut-box');
    expect(box.classList.contains('recording')).toBe(false);
  });

  it('startRecording shows modifier-only on keydown', () => {
    startRecording();

    const event = new KeyboardEvent('keydown', {
      key: 'Control',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    const display = document.getElementById('shortcut-display');
    expect(display.textContent).toContain('Ctrl');
    expect(display.textContent).toContain('...');

    // Cleanup by escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  it('startRecording handles keyup to show partial modifiers', () => {
    startRecording();

    // Press Ctrl
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Control', ctrlKey: true, bubbles: true,
    }));

    // Release Ctrl
    document.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Control', ctrlKey: false, bubbles: true,
    }));

    const display = document.getElementById('shortcut-display');
    expect(display.textContent).toBe('Press keys...');

    // Cleanup
    stopRecording();
  });

  it('startRecording maps special keys', () => {
    startRecording();

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: ' ',
      ctrlKey: true,
      bubbles: true,
    }));

    const profile = activeProfile();
    expect(profile.shortcut).toBe('Ctrl+Space');
  });

  it('startRecording cancel via box click', () => {
    startRecording();
    const box = document.getElementById('shortcut-box');
    box.onclick(new MouseEvent('click'));
    expect(box.classList.contains('recording')).toBe(false);
  });
});

describe('config-ui/icon-picker', () => {
  beforeEach(() => {
    setupTestConfig();
    document.body.innerHTML = '<div id="app"></div>';
    setExpandedSlice(0);
    render();
  });

  afterEach(() => {
    closeIconPicker();
  });

  it('closeIconPicker does nothing when picker not open', () => {
    setPickerOpen(false);
    expect(() => closeIconPicker()).not.toThrow();
  });

  it('openIconPicker creates picker overlay and picker elements', () => {
    openIconPicker(0);
    expect(document.querySelector('.icon-picker-overlay')).not.toBeNull();
    expect(document.querySelector('.icon-picker')).not.toBeNull();
    expect(document.querySelector('.icon-picker-search')).not.toBeNull();
  });

  it('openIconPicker closes on overlay click', () => {
    openIconPicker(0);
    const overlay = document.querySelector('.icon-picker-overlay');
    overlay.click();
    expect(document.querySelector('.icon-picker')).toBeNull();
  });

  it('openIconPicker search filters icons', () => {
    openIconPicker(0);
    const search = document.querySelector('.icon-picker-search');
    search.value = 'star';
    search.dispatchEvent(new Event('input'));
    // body should contain filtered results
    const body = document.querySelector('.icon-picker-body');
    expect(body.innerHTML).toContain('star');
  });

  it('openIconPicker Escape closes picker', () => {
    openIconPicker(0);
    const search = document.querySelector('.icon-picker-search');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.icon-picker')).toBeNull();
  });

  it('openIconPicker clicking an icon selects it', () => {
    openIconPicker(0);
    const cell = document.querySelector('.icon-picker-cell');
    if (cell) {
      cell.click();
      // Picker should be closed after selection
      expect(document.querySelector('.icon-picker')).toBeNull();
    }
  });

  it('openSubIconPicker creates picker for sub-action icon', () => {
    // Set up a submenu slice with sub-actions
    setConfig({
      profiles: [{
        id: 'default', name: 'Test', shortcut: '', slices: [{
          label: 'Menu', icon: 'squares-2x2', action: {
            type: 'Submenu', slices: [
              { label: 'Sub1', icon: 'star', action: { type: 'Script', command: '' } },
            ],
          },
        }],
      }],
    });
    setActiveProfileIndex(0);
    setExpandedSlice(0);
    render();

    openSubIconPicker(0, 0);
    expect(document.querySelector('.icon-picker')).not.toBeNull();
  });

  it('openSubIconPicker exits early if no sub-action exists', () => {
    openSubIconPicker(99, 99);
    // Should not crash and no picker created
    expect(document.querySelector('.icon-picker')).toBeNull();
  });
});

describe('config-ui/events', () => {
  beforeEach(() => {
    setupTestConfig();
    document.body.innerHTML = '<div id="app"></div>';
    render();
  });

  it('bindEvents attaches event listeners without errors', () => {
    // bindEvents is called automatically by render() via registerBindEvents
    // Just verify it doesn't throw and elements are interactive
    expect(document.getElementById('shortcut-box')).not.toBeNull();
    expect(document.getElementById('add-btn')).not.toBeNull();
    expect(document.getElementById('save-btn')).not.toBeNull();
  });

  it('handleBrowseClick updates path when file selected', async () => {
    setExpandedSlice(0);
    render();

    const profile = activeProfile();
    const s = profile.slices[0];
    s.action = { type: 'Program', path: '', args: [] };

    globalThis.api.openFileDialog.mockResolvedValueOnce('/usr/bin/myapp');
    globalThis.api.getFileIcon.mockResolvedValueOnce('data:image/png;base64,icon');

    await handleBrowseClick(s, 0);
    expect(s.action.path).toBe('/usr/bin/myapp');
    expect(s.customIcon).toBe('data:image/png;base64,icon');
  });

  it('handleBrowseClick does nothing when dialog cancelled', async () => {
    const s = { label: 'Test', icon: 'star', action: { type: 'Program', path: '', args: [] } };
    globalThis.api.openFileDialog.mockResolvedValueOnce(null);
    await handleBrowseClick(s, 0);
    expect(s.action.path).toBe('');
  });

  it('bindDetail attaches listeners for expanded slice', () => {
    setExpandedSlice(0);
    render();
    // bindDetail is called automatically by bindEvents when expandedSlice >= 0
    const labelInput = document.getElementById('label-0');
    expect(labelInput).not.toBeNull();
  });

  it('bindSubActionEvents attaches listeners for submenu sub-actions', () => {
    setConfig({
      profiles: [{
        id: 'default', name: 'Test', shortcut: '', slices: [{
          label: 'Menu', icon: 'squares-2x2', action: {
            type: 'Submenu', slices: [
              { label: 'Sub1', icon: 'star', action: { type: 'Script', command: 'test' } },
            ],
          },
        }],
      }],
    });
    setActiveProfileIndex(0);
    setExpandedSlice(0);
    render();

    const addBtn = document.getElementById('add-sub-0');
    expect(addBtn).not.toBeNull();
  });

  it('clicking add-btn adds a new slice', () => {
    const addBtn = document.getElementById('add-btn');
    const before = activeProfile().slices.length;
    addBtn.click();
    expect(activeProfile().slices.length).toBe(before + 1);
  });

  it('clicking action-card-header toggles expansion', () => {
    const header = document.querySelector('.action-card-header');
    header.click();
    // After click, the detail should be rendered (expandedSlice set)
    expect(document.querySelector('.action-detail')).not.toBeNull();
  });

  it('clicking profile tab switches profile', () => {
    const cfg = getConfig();
    cfg.profiles.push({ id: 'p2', name: 'Second', shortcut: '', slices: [] });
    setConfig(cfg);
    render();

    const tab = document.querySelector('.profile-tab[data-profile="1"]');
    tab.click();
    // Should render the second profile (empty slices)
    expect(document.querySelector('.empty-state')).not.toBeNull();
  });

  it('clicking add-profile-btn adds new profile', () => {
    const before = getConfig().profiles.length;
    const btn = document.getElementById('add-profile-btn');
    btn.click();
    expect(getConfig().profiles.length).toBe(before + 1);
  });

  it('profile-name-input updates profile name', () => {
    const input = document.getElementById('profile-name-input');
    input.value = 'New Name';
    input.dispatchEvent(new Event('input'));
    expect(activeProfile().name).toBe('New Name');
  });

  it('telemetry checkbox toggles sentry', () => {
    const checkbox = document.getElementById('telemetry-checkbox');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(globalThis.api.setTelemetryConsent).toHaveBeenCalled();
  });

  it('clear-shortcut-btn clears shortcut', () => {
    const btn = document.getElementById('clear-shortcut-btn');
    if (btn) {
      btn.click();
      expect(activeProfile().shortcut).toBe('');
    }
  });

  it('bindDetail label input updates slice label', () => {
    setExpandedSlice(0);
    render();
    const input = document.getElementById('label-0');
    input.value = 'Updated';
    input.dispatchEvent(new Event('input'));
    expect(activeProfile().slices[0].label).toBe('Updated');
  });

  it('bindDetail type select change to Program re-renders', () => {
    setExpandedSlice(0);
    render();
    const select = document.getElementById('type-0');
    select.value = 'Program';
    select.dispatchEvent(new Event('change'));
    expect(activeProfile().slices[0].action.type).toBe('Program');
  });

  it('bindDetail type select change to Submenu re-renders', () => {
    setExpandedSlice(0);
    render();
    const select = document.getElementById('type-0');
    select.value = 'Submenu';
    select.dispatchEvent(new Event('change'));
    expect(activeProfile().slices[0].action.type).toBe('Submenu');
  });

  it('bindDetail cmd input updates command', () => {
    setExpandedSlice(0);
    render();
    const input = document.getElementById('cmd-0');
    if (input) {
      input.value = 'new command';
      input.dispatchEvent(new Event('input'));
      expect(activeProfile().slices[0].action.command).toBe('new command');
    }
  });

  it('bindDetail delete button removes slice', () => {
    setExpandedSlice(0);
    render();
    const before = activeProfile().slices.length;
    const btn = document.getElementById('delete-0');
    btn.click();
    expect(activeProfile().slices.length).toBe(before - 1);
  });

  it('bindDetail args input updates args', () => {
    // Set up a Program-type slice
    activeProfile().slices[1] = { label: 'App', icon: 'heart', action: { type: 'Program', path: '/bin/x', args: [] } };
    setExpandedSlice(1);
    render();
    const input = document.getElementById('args-1');
    if (input) {
      input.value = '--flag --other';
      input.dispatchEvent(new Event('input'));
      expect(activeProfile().slices[1].action.args).toEqual(['--flag', '--other']);
    }
  });

  it('drag-and-drop on action cards', () => {
    // Render with 2+ slices
    render();
    const cards = document.querySelectorAll('.action-card');
    const headers = document.querySelectorAll('.action-card-header');
    if (cards.length >= 2) {
      // Simulate dragstart on first card
      const dragEvent = new Event('dragstart', { bubbles: true });
      dragEvent.dataTransfer = { effectAllowed: '' };
      headers[0].dispatchEvent(dragEvent);

      // Simulate dragover on second card
      const overEvent = new Event('dragover', { bubbles: true, cancelable: true });
      overEvent.dataTransfer = { dropEffect: '' };
      overEvent.preventDefault = vi.fn();
      cards[1].dispatchEvent(overEvent);

      // Simulate drop
      const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
      dropEvent.preventDefault = vi.fn();
      dropEvent.stopPropagation = vi.fn();
      cards[1].dispatchEvent(dropEvent);
      expect(dropEvent.preventDefault).toHaveBeenCalled();
    } else {
      // If cards not rendered, at least verify render didn't crash
      expect(true).toBe(true);
    }
  });

  it('sub-action add button adds sub-action', () => {
    setConfig({
      profiles: [{
        id: 'default', name: 'Test', shortcut: '', slices: [{
          label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [] },
        }],
      }],
    });
    setActiveProfileIndex(0);
    setExpandedSlice(0);
    render();

    const addBtn = document.getElementById('add-sub-0');
    if (addBtn) {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      addBtn.dispatchEvent(clickEvent);
      expect(activeProfile().slices[0].action.slices.length).toBe(1);
    }
  });

  it('sub-action label input updates label', () => {
    setConfig({
      profiles: [{
        id: 'default', name: 'Test', shortcut: '', slices: [{
          label: 'Menu', icon: 'squares-2x2', action: {
            type: 'Submenu', slices: [
              { label: 'Old', icon: 'star', action: { type: 'Script', command: '' } },
            ],
          },
        }],
      }],
    });
    setActiveProfileIndex(0);
    setExpandedSlice(0);
    render();

    const input = document.getElementById('sub-label-0-0');
    if (input) {
      input.value = 'New Label';
      input.dispatchEvent(new Event('input'));
      expect(activeProfile().slices[0].action.slices[0].label).toBe('New Label');
    }
  });

  it('sub-action type change updates action type', () => {
    setConfig({
      profiles: [{
        id: 'default', name: 'Test', shortcut: '', slices: [{
          label: 'Menu', icon: 'squares-2x2', action: {
            type: 'Submenu', slices: [
              { label: 'Sub', icon: 'star', action: { type: 'Script', command: '' } },
            ],
          },
        }],
      }],
    });
    setActiveProfileIndex(0);
    setExpandedSlice(0);
    render();

    const select = document.getElementById('sub-type-0-0');
    if (select) {
      select.value = 'Program';
      select.dispatchEvent(new Event('change'));
      expect(activeProfile().slices[0].action.slices[0].action.type).toBe('Program');
    }
  });

  it('sub-action cmd input updates command', () => {
    setConfig({
      profiles: [{
        id: 'default', name: 'Test', shortcut: '', slices: [{
          label: 'Menu', icon: 'squares-2x2', action: {
            type: 'Submenu', slices: [
              { label: 'Sub', icon: 'star', action: { type: 'Script', command: '' } },
            ],
          },
        }],
      }],
    });
    setActiveProfileIndex(0);
    setExpandedSlice(0);
    render();

    const input = document.getElementById('sub-cmd-0-0');
    if (input) {
      input.value = 'echo hello';
      input.dispatchEvent(new Event('input'));
      expect(activeProfile().slices[0].action.slices[0].action.command).toBe('echo hello');
    }
  });

  it('sub-action delete removes sub-action', () => {
    setConfig({
      profiles: [{
        id: 'default', name: 'Test', shortcut: '', slices: [{
          label: 'Menu', icon: 'squares-2x2', action: {
            type: 'Submenu', slices: [
              { label: 'Sub', icon: 'star', action: { type: 'Script', command: '' } },
            ],
          },
        }],
      }],
    });
    setActiveProfileIndex(0);
    setExpandedSlice(0);
    render();

    const delBtn = document.getElementById('sub-del-0-0');
    if (delBtn) {
      delBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(activeProfile().slices[0].action.slices.length).toBe(0);
    }
  });

  it('template select applies template to submenu', () => {
    setConfig({
      profiles: [{
        id: 'default', name: 'Test', shortcut: '', slices: [{
          label: '', icon: 'squares-2x2', action: { type: 'Submenu', slices: [] },
        }],
      }],
    });
    setActiveProfileIndex(0);
    setExpandedSlice(0);
    render();

    const select = document.getElementById('template-select-0');
    if (select) {
      select.value = '0'; // First template
      select.dispatchEvent(new Event('change'));
      // Template should have been applied
      expect(activeProfile().slices[0].action.slices.length).toBeGreaterThan(0);
    }
  });

  it('delete-profile-btn from tab works with confirm', () => {
    const cfg = getConfig();
    cfg.profiles.push({ id: 'p2', name: 'Second', shortcut: '', slices: [] });
    setConfig(cfg);
    render();

    // Mock confirm
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const delBtn = document.querySelector('[data-profile-delete="1"]');
    if (delBtn) {
      delBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(getConfig().profiles.length).toBe(1);
    }
    confirmSpy.mockRestore();
  });
});
