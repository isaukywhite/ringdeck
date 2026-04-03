/**
 * mouse-triggers.js
 * UI module for configuring mouse button → profile bindings (HellRing / MX Master 4).
 * Renders inline in the left pane alongside "Activation shortcut".
 */

let _captureActive = false;
let _captureCleanup = null;

// Buttons that must never be used as ring triggers
const BLOCKED_BUTTONS_UI = new Set([1, 2]);

/**
 * Human-friendly label for a mouse button ID.
 */
function buttonLabel(id) {
  const map = {
    1: 'Left click',
    2: 'Right click',
    3: 'Middle / Scroll',
    4: 'Side button (Thumb)',
    5: 'Side button (Forward)',
  };
  return map[id] || `Button ${id}`;
}

/**
 * Returns the mouse button currently bound to a given profile ID, or null.
 */
function boundButtonForProfile(profileId, mouseBindings) {
  return (mouseBindings || []).find(b => b.profileId === profileId) || null;
}

/**
 * Renders the inline mouse trigger area for the LEFT PANE —
 * same visual language as the "Activation shortcut" shortcut-box.
 * Returns an HTML string (static) — call bindMouseTriggerAreaEvents() after DOM insert.
 */
export function renderMouseTriggerArea(profile, config) {
  const binding = boundButtonForProfile(profile.id, config.mouseBindings);
  const label = binding ? buttonLabel(binding.button) : 'Not set';
  const hasBinding = !!binding;

  return `
    <div class="shortcut-area mouse-trigger-area" id="mouse-trigger-area">
      <div class="shortcut-box mouse-trigger-box" id="mouse-trigger-box">
        <span class="shortcut-keys" id="mouse-trigger-display">${label}</span>
        <span class="shortcut-action" id="mouse-trigger-action">Capture</span>
      </div>
      <span id="mouse-trigger-status" class="mouse-capture-status"></span>
      ${hasBinding ? `<button class="btn-clear-shortcut" id="clear-mouse-trigger-btn">Clear trigger</button>` : ''}
    </div>
  `;
}

export function renderMouseTriggersPanel(container, config, profiles) {
  const bindings = config.mouseBindings || [];

  const rows = bindings.map((b, i) => `
    <div class="mouse-trigger-row" data-binding="${i}">
      <span class="mouse-trigger-btn-label">${buttonLabel(b.button)}</span>
      <span class="mouse-trigger-arrow">→</span>
      <select class="mouse-trigger-profile-select" data-binding="${i}">
        ${profiles.map(p => `
          <option value="${p.id}" ${p.id === b.profileId ? 'selected' : ''}>${p.name}</option>
        `).join('')}
      </select>
      <button class="mouse-trigger-delete" data-binding="${i}" title="Remove binding">✕</button>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="mouse-triggers-section">
      <div class="mouse-triggers-header">
        <span class="mouse-triggers-title">🖱️ Mouse Triggers</span>
        <span class="mouse-triggers-hint">Map hardware mouse buttons to ring profiles</span>
      </div>
      <div class="mouse-triggers-list" id="mouse-triggers-list">
        ${bindings.length === 0
          ? '<p class="mouse-triggers-empty">No mouse triggers configured. Try capturing a button below.</p>'
          : rows
        }
      </div>
      <div class="mouse-triggers-actions">
        <button id="mouse-capture-btn" class="mouse-capture-btn">
          🎯 Capture button
        </button>
        <span id="mouse-capture-status" class="mouse-capture-status"></span>
      </div>
      <p class="mouse-triggers-tip">
        💡 <strong>Tip:</strong> On MX Master 4, the lateral thumb button is typically <em>Side button (Back / Thumb)</em>.
        Click "Capture button" then press the physical mouse button to detect it automatically.
      </p>
    </div>
  `;

  bindMouseTriggerEvents(container, config, profiles);
}

function bindMouseTriggerEvents(container, config, profiles) {
  const captureBtn = container.querySelector('#mouse-capture-btn');
  const captureStatus = container.querySelector('#mouse-capture-status');

  // Delete a binding
  container.querySelectorAll('.mouse-trigger-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const i = +btn.dataset.binding;
      config.mouseBindings.splice(i, 1);
      await globalThis.api.saveMouseBindings(config.mouseBindings);
      renderMouseTriggersPanel(container, config, profiles);
    });
  });

  // Change profile for binding
  container.querySelectorAll('.mouse-trigger-profile-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const i = +sel.dataset.binding;
      config.mouseBindings[i].profileId = e.target.value;
      await globalThis.api.saveMouseBindings(config.mouseBindings);
    });
  });

  // Capture mode
  if (captureBtn) {
    captureBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      if (_captureActive) {
        // Cancel capture
        _captureActive = false;
        captureBtn.textContent = '🎯 Capture button';
        captureStatus.textContent = '';
        captureStatus.className = 'mouse-capture-status';
        if (_captureCleanup) { _captureCleanup(); _captureCleanup = null; }
        await globalThis.api.stopMouseCapture();
        return;
      }

      _captureActive = true;
      captureBtn.textContent = '⏹ Cancel';
      captureStatus.textContent = 'Press any mouse button now…';
      captureStatus.className = 'mouse-capture-status capturing';

      await globalThis.api.startMouseCapture();

      // Buttons that cannot be used as ring triggers
      const BLOCKED = new Set([1, 2]);

      // Listen for the captured button ID from the main process
      const handler = async (buttonId) => {
        // Left/Right click are blocked — give feedback and keep capture mode active
        if (BLOCKED.has(buttonId)) {
          captureStatus.textContent = '⚠️ Left/Right click cannot be used — press a side button';
          captureStatus.className = 'mouse-capture-status';
          // Re-arm capture for the next press
          await globalThis.api.startMouseCapture();
          if (globalThis.api.onMouseButtonCaptured) {
            globalThis.api.onMouseButtonCaptured(handler);
          }
          return;
        }

        _captureActive = false;
        captureBtn.textContent = '🎯 Capture button';
        captureStatus.textContent = `✓ Detectado: ${buttonLabel(buttonId)}`;
        captureStatus.className = 'mouse-capture-status captured';

        // Add new binding if not already mapped
        if (!config.mouseBindings) config.mouseBindings = [];
        const existing = config.mouseBindings.find(b => b.button === buttonId);
        if (!existing) {
          // Default to first available profile
          const defaultProfileId = profiles[0]?.id || 'default';
          config.mouseBindings.push({ button: buttonId, profileId: defaultProfileId });
          await globalThis.api.saveMouseBindings(config.mouseBindings);
        }

        setTimeout(() => {
          renderMouseTriggersPanel(container, config, profiles);
        }, 800);

        if (_captureCleanup) { _captureCleanup(); _captureCleanup = null; }
      };

      // Register one-shot listener via preload API
      if (globalThis.api.onMouseButtonCaptured) {
        globalThis.api.onMouseButtonCaptured(handler);
        // Cleanup fn (removes listener if user cancels)
        _captureCleanup = () => {
          // IPC listeners can't be easily removed one-shot via ipcRenderer.on,
          // so we just ignore future calls by guard-flagging _captureActive=false above.
        };
      }
    });
  }
}
