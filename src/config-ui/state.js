let sentryEnabled = false;
globalThis.api.getTelemetryConsent().then((v) => { sentryEnabled = v; }); // NOSONAR

let config = { profiles: [] };
let activeRecorder = null;
let expandedSlice = -1;
let pickerOpen = false;
let dragSrcIndex = -1;
let activeProfileIndex = 0;
let activeView = 'actions'; // 'actions' | 'settings'
let appVersion = 'v0.0.0';

export function getConfig() { return config; }
export function setConfig(c) { config = c; }

export function getActiveProfileIndex() { return activeProfileIndex; }
export function setActiveProfileIndex(i) { activeProfileIndex = i; }

export function getExpandedSlice() { return expandedSlice; }
export function setExpandedSlice(i) { expandedSlice = i; }

export function getPickerOpen() { return pickerOpen; }
export function setPickerOpen(v) { pickerOpen = v; }

export function getDragSrcIndex() { return dragSrcIndex; }
export function setDragSrcIndex(i) { dragSrcIndex = i; }

export function getActiveRecorder() { return activeRecorder; }
export function setActiveRecorder(r) { activeRecorder = r; }

export function getSentryEnabled() { return sentryEnabled; }
export function setSentryEnabled(v) { sentryEnabled = v; }

export function getActiveView() { return activeView; }
export function setActiveView(v) { activeView = v; }

export function getAppVersion() { return appVersion; }
export function setAppVersion(v) { appVersion = v; }

export function activeProfile() {
  return config.profiles[activeProfileIndex] || config.profiles[0];
}
