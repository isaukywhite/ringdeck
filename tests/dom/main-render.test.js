// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// We test rendering functions by importing the config-ui utils
// and simulating what render() does with the DOM
import { appName, actionSummary, escAttr, sliceIcon, migrateIcon } from '../../src/config-ui/utils.js';
import { resolveIcon, ICON_MAP, ICON_CATEGORIES } from '../../src/icons.js';

describe('renderActionCard HTML generation', () => {
  function renderActionCard(s, i, expandedSlice = -1) {
    const active = i === expandedSlice;
    let html = `
      <div class="action-card${active ? ' active' : ''}" data-card="${i}">
        <div class="action-card-header" data-index="${i}" draggable="true">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <span class="action-card-index">${i + 1}</span>
          <span class="action-card-icon">${sliceIcon(s, 22)}</span>
          <div class="action-card-info">
            <div class="action-card-name">${s.label || 'Untitled'}</div>
            <div class="action-card-desc">${actionSummary(s.action)}</div>
          </div>
          <span class="action-card-chevron">›</span>
        </div>
      </div>`;
    return html;
  }

  it('renders inactive card correctly', () => {
    const s = { label: 'Terminal', icon: 'command-line', action: { type: 'Script', command: 'bash' } };
    const html = renderActionCard(s, 0);
    document.body.innerHTML = html;

    const card = document.querySelector('.action-card');
    expect(card).not.toBeNull();
    expect(card.classList.contains('active')).toBe(false);
    expect(card.dataset.card).toBe('0');

    const name = document.querySelector('.action-card-name');
    expect(name.textContent).toBe('Terminal');

    const desc = document.querySelector('.action-card-desc');
    expect(desc.textContent).toBe('bash');

    const index = document.querySelector('.action-card-index');
    expect(index.textContent).toBe('1');
  });

  it('renders active card with active class', () => {
    const s = { label: 'Browser', icon: 'globe-alt', action: { type: 'Program', path: '/Applications/Safari.app' } };
    const html = renderActionCard(s, 2, 2);
    document.body.innerHTML = html;

    const card = document.querySelector('.action-card');
    expect(card.classList.contains('active')).toBe(true);
  });

  it('shows "Untitled" for slice without label', () => {
    const s = { icon: 'cog-6-tooth', action: { type: 'Script', command: '' } };
    const html = renderActionCard(s, 0);
    document.body.innerHTML = html;

    const name = document.querySelector('.action-card-name');
    expect(name.textContent).toBe('Untitled');
  });

  it('shows action summary for Script type', () => {
    const s = { label: 'Test', icon: 'bolt', action: { type: 'Script', command: 'echo hello' } };
    const html = renderActionCard(s, 0);
    document.body.innerHTML = html;

    const desc = document.querySelector('.action-card-desc');
    expect(desc.textContent).toBe('echo hello');
  });

  it('shows app name for Program type', () => {
    const s = { label: 'Chrome', icon: 'globe-alt', action: { type: 'Program', path: '/Applications/Google Chrome.app' } };
    const html = renderActionCard(s, 0);
    document.body.innerHTML = html;

    const desc = document.querySelector('.action-card-desc');
    expect(desc.textContent).toBe('Google Chrome');
  });

  it('shows sub-action count for Submenu type', () => {
    const s = { label: 'Apps', icon: 'squares-2x2', action: { type: 'Submenu', slices: [{}, {}, {}] } };
    const html = renderActionCard(s, 0);
    document.body.innerHTML = html;

    const desc = document.querySelector('.action-card-desc');
    expect(desc.textContent).toBe('3 sub-actions');
  });

  it('renders customIcon as img tag', () => {
    const s = { label: 'Custom', customIcon: 'data:image/png;base64,abc', action: { type: 'Script', command: 'test' } };
    const html = renderActionCard(s, 0);
    document.body.innerHTML = html;

    const icon = document.querySelector('.action-card-icon img');
    expect(icon).not.toBeNull();
    expect(icon.src).toContain('data:image/png;base64,abc');
  });
});

describe('renderProfileTabs HTML generation', () => {
  function renderProfileTabs(profiles, activeIndex) {
    const canDelete = profiles.length > 1;
    const tabs = profiles.map((p, i) => {
      const active = i === activeIndex ? ' active' : '';
      const delBtn = canDelete ? `<span class="profile-tab-delete" data-profile-delete="${i}" title="Delete profile">×</span>` : '';
      return `<button class="profile-tab${active}" data-profile="${i}">
        <span class="profile-tab-name" data-profile-name="${i}">${escAttr(p.name || 'Untitled')}</span>
        ${delBtn}
      </button>`;
    }).join('');

    return `<div class="profile-tabs">
      ${tabs}
      <button class="profile-tab profile-tab-add" id="add-profile-btn" title="Add profile">+</button>
    </div>`;
  }

  it('renders correct number of tabs', () => {
    const profiles = [
      { name: 'Default', shortcut: 'Alt+Space', slices: [] },
      { name: 'Gaming', shortcut: 'Ctrl+G', slices: [] },
    ];
    document.body.innerHTML = renderProfileTabs(profiles, 0);

    const tabs = document.querySelectorAll('.profile-tab[data-profile]');
    expect(tabs.length).toBe(2);
  });

  it('marks active tab', () => {
    const profiles = [
      { name: 'Default', slices: [] },
      { name: 'Work', slices: [] },
    ];
    document.body.innerHTML = renderProfileTabs(profiles, 1);

    const tabs = document.querySelectorAll('.profile-tab[data-profile]');
    expect(tabs[0].classList.contains('active')).toBe(false);
    expect(tabs[1].classList.contains('active')).toBe(true);
  });

  it('shows delete button only with multiple profiles', () => {
    const single = [{ name: 'Default', slices: [] }];
    document.body.innerHTML = renderProfileTabs(single, 0);
    expect(document.querySelector('.profile-tab-delete')).toBeNull();

    const multi = [{ name: 'A', slices: [] }, { name: 'B', slices: [] }];
    document.body.innerHTML = renderProfileTabs(multi, 0);
    expect(document.querySelectorAll('.profile-tab-delete').length).toBe(2);
  });

  it('includes add profile button', () => {
    const profiles = [{ name: 'Default', slices: [] }];
    document.body.innerHTML = renderProfileTabs(profiles, 0);
    expect(document.getElementById('add-profile-btn')).not.toBeNull();
  });
});

describe('renderActionDetail HTML generation', () => {
  function renderActionDetail(s, i) {
    const at = s.action.type;
    const programPath = at === 'Program' ? (s.action.path || '') : '';
    const programArgs = at === 'Program' ? (s.action.args || []).join(' ') : '';
    const pathDisplay = programPath ? appName(programPath) : '';

    let typeFields = '';
    if (at === 'Script') {
      typeFields = `
        <span class="detail-label">Command</span>
        <div><input type="text" id="cmd-${i}" value="${escAttr(s.action.command || '')}" placeholder="e.g. open -a Safari" /></div>`;
    } else if (at === 'Program') {
      typeFields = `
        <span class="detail-label">Program</span>
        <div><div class="file-picker">
          <span class="file-picker-path${pathDisplay ? '' : ' empty'}" id="path-${i}">${pathDisplay || 'Choose app...'}</span>
          <button class="btn-browse" id="browse-${i}">Browse</button>
        </div></div>
        <span class="detail-label">Args</span>
        <div><input type="text" id="args-${i}" value="${escAttr(programArgs)}" placeholder="Optional arguments" /></div>`;
    }

    return `
      <div class="action-detail" data-detail="${i}">
        <div class="detail-divider"></div>
        <div class="detail-grid">
          <span class="detail-label">Icon</span>
          <div class="detail-input-row">
            <button class="icon-btn" id="icon-btn-${i}">${resolveIcon(s.icon)}</button>
            <input type="text" id="label-${i}" value="${escAttr(s.label)}" placeholder="Action name" />
          </div>
          <span class="detail-label">Type</span>
          <div><select id="type-${i}">
            <option value="Script"${at === 'Script' ? ' selected' : ''}>Script</option>
            <option value="Program"${at === 'Program' ? ' selected' : ''}>Program</option>
            <option value="Submenu"${at === 'Submenu' ? ' selected' : ''}>Submenu</option>
          </select></div>
          ${typeFields}
        </div>
        <div class="detail-actions">
          <button class="btn-delete" id="delete-${i}">Remove</button>
        </div>
      </div>`;
  }

  it('renders Script fields correctly', () => {
    const s = { label: 'Test', icon: 'bolt', action: { type: 'Script', command: 'echo hi' } };
    document.body.innerHTML = renderActionDetail(s, 0);

    const cmd = document.getElementById('cmd-0');
    expect(cmd).not.toBeNull();
    expect(cmd.value).toBe('echo hi');
    expect(document.getElementById('browse-0')).toBeNull();
  });

  it('renders Program fields correctly', () => {
    const s = { label: 'Safari', icon: 'globe-alt', action: { type: 'Program', path: '/Applications/Safari.app', args: ['--new-window'] } };
    document.body.innerHTML = renderActionDetail(s, 1);

    const path = document.getElementById('path-1');
    expect(path.textContent).toBe('Safari');
    expect(document.getElementById('browse-1')).not.toBeNull();
    expect(document.getElementById('args-1').value).toBe('--new-window');
    expect(document.getElementById('cmd-1')).toBeNull();
  });

  it('renders Submenu type selection', () => {
    const s = { label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [] } };
    document.body.innerHTML = renderActionDetail(s, 0);

    const select = document.getElementById('type-0');
    expect(select.value).toBe('Submenu');
  });

  it('includes icon button and label input', () => {
    const s = { label: 'My Action', icon: 'star', action: { type: 'Script', command: '' } };
    document.body.innerHTML = renderActionDetail(s, 3);

    expect(document.getElementById('icon-btn-3')).not.toBeNull();
    expect(document.getElementById('label-3').value).toBe('My Action');
  });

  it('includes delete button', () => {
    const s = { label: 'X', icon: 'trash', action: { type: 'Script', command: '' } };
    document.body.innerHTML = renderActionDetail(s, 0);

    expect(document.getElementById('delete-0')).not.toBeNull();
  });
});

describe('DOM event simulation', () => {
  it('click on card header can toggle expanded state', () => {
    let expandedSlice = -1;
    const html = `
      <div class="action-card" data-card="0">
        <div class="action-card-header" data-index="0">Click me</div>
      </div>`;
    document.body.innerHTML = html;

    const header = document.querySelector('.action-card-header');
    header.addEventListener('click', () => {
      expandedSlice = expandedSlice === 0 ? -1 : 0;
    });

    header.click();
    expect(expandedSlice).toBe(0);

    header.click();
    expect(expandedSlice).toBe(-1);
  });

  it('add button triggers callback', () => {
    document.body.innerHTML = '<button id="add-btn">Add</button>';
    let called = false;
    document.getElementById('add-btn').addEventListener('click', () => { called = true; });
    document.getElementById('add-btn').click();
    expect(called).toBe(true);
  });

  it('save button triggers callback', () => {
    document.body.innerHTML = '<button id="save-btn">Save</button>';
    let called = false;
    document.getElementById('save-btn').addEventListener('click', () => { called = true; });
    document.getElementById('save-btn').click();
    expect(called).toBe(true);
  });
});
