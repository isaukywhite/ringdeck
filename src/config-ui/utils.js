import { ICON_MAP, resolveIcon } from '../icons.js';

export function sliceIcon(s, size = 20) {
  if (s.customIcon) {
    return `<img src="${s.customIcon}" style="width:${size}px;height:${size}px;" />`;
  }
  return resolveIcon(s.icon);
}

export function appName(path) {
  if (!path) return '';
  const base = path.split(/[/\\]/).pop() || '';
  return base.replace(/\.(app|exe)$/i, '');
}

export function actionSummary(action) {
  if (action.type === 'Script') return action.command || 'No command';
  if (action.type === 'Program') return appName(action.path) || 'No program';
  if (action.type === 'Submenu') {
    const count = (action.slices || []).length;
    return `${count} sub-action${count === 1 ? '' : 's'}`;
  }
  return '';
}

export function migrateLegacyProgram(s) {
  if (s.action.type !== 'Program') return;
  if (s.action.path === 'open' && s.action.args?.length >= 2 && s.action.args[0] === '-a') {
    const name = s.action.args[1];
    s.action.path = `/Applications/${name}.app`;
    s.action.args = [];
  }
}

export function migrateIcon(s) {
  const EMOJI_TO_HERO = {
    '🖥️': 'computer-desktop',
    '🌐': 'globe-alt',
    '⚙️': 'cog-6-tooth',
    '📁': 'folder',
    '📂': 'folder-open',
    '📝': 'document-text',
    '💬': 'chat-bubble-left',
    '📧': 'envelope',
    '📷': 'camera',
    '🎵': 'musical-note',
    '🎬': 'film',
    '🎮': 'puzzle-piece',
    '🔧': 'wrench',
    '🔒': 'lock-closed',
    '🔓': 'lock-open',
    '💡': 'light-bulb',
    '📡': 'signal',
    '🖨️': 'printer',
    '🐛': 'bug-ant',
    '🧪': 'beaker',
    '📦': 'cube',
    '🚀': 'rocket-launch',
    '🔥': 'fire',
    '⚡': 'bolt',
    '👤': 'user',
    '👥': 'user-group',
    '⭐': 'star',
    '❤️': 'heart',
    '🔔': 'bell',
    '📌': 'map-pin',
    '📄': 'document',
    '📊': 'chart-bar',
    '🗑️': 'trash',
    '🔍': 'magnifying-glass',
    '🌙': 'moon',
    '☀️': 'sun',
    '🎯': 'cursor-arrow-rays',
    '🛡️': 'shield-check',
  };
  if (s.icon && EMOJI_TO_HERO[s.icon]) {
    s.icon = EMOJI_TO_HERO[s.icon];
  }
  if (!s.icon || !ICON_MAP[s.icon]) {
    s.icon = 'cog-6-tooth';
  }
}

export function escAttr(str) {
  return (str || '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}
