const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("get_config"),
  getActiveProfile: () => ipcRenderer.invoke("get_active_profile"),
  saveConfig: (config) => ipcRenderer.invoke("save_config", config),
  executeAction: (index) => ipcRenderer.invoke("execute_action", index),
  hideRing: () => ipcRenderer.invoke("hide_ring"),
  openFileDialog: () => ipcRenderer.invoke("open_file_dialog"),
  getFileIcon: (filePath) => ipcRenderer.invoke("get_file_icon", filePath),
  executeSubmenuAction: (parentIndex, childIndex) => ipcRenderer.invoke("execute_submenu_action", parentIndex, childIndex),
  getTelemetryConsent: () => ipcRenderer.invoke("get_telemetry_consent"),
  setTelemetryConsent: (consent) => ipcRenderer.invoke("set_telemetry_consent", consent),
  getRingColor: () => ipcRenderer.invoke("get_ring_color"),
  getRingSize: () => ipcRenderer.invoke("get_ring_size"),
  setRingColor: (hex) => ipcRenderer.invoke("set_ring_color", hex),
  setRingSize: (size) => ipcRenderer.invoke("set_ring_size", size),
  saveSettings: (settings) => ipcRenderer.invoke("save_settings", settings),
  getAppVersion: () => ipcRenderer.invoke("get_app_version"),
  onRingData: (cb) => ipcRenderer.on("ring-data", (_e, data) => cb(data)),
  // Mouse button bindings (HellRing / MX Master 4 support)
  getMouseBindings: () => ipcRenderer.invoke("get_mouse_bindings"),
  saveMouseBindings: (bindings) => ipcRenderer.invoke("save_mouse_bindings", bindings),
  startMouseCapture: () => ipcRenderer.invoke("start_mouse_capture"),
  stopMouseCapture: () => ipcRenderer.invoke("stop_mouse_capture"),
  onMouseButtonCaptured: (cb) => ipcRenderer.on("mouse_button_captured", (_e, buttonId) => cb(buttonId)),
  onHardwareTriggerReleased: (cb) => ipcRenderer.on("hardware_trigger_released", () => cb()),
  // Window controls (frameless title bar)
  windowMinimize: () => ipcRenderer.invoke("window_minimize"),
  windowMaximize: () => ipcRenderer.invoke("window_maximize"),
  windowClose: () => ipcRenderer.invoke("window_close"),
});
