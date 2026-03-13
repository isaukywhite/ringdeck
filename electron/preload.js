const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("get_config"),
  getActiveProfile: () => ipcRenderer.invoke("get_active_profile"),
  saveConfig: (config) => ipcRenderer.invoke("save_config", config),
  executeAction: (index) => ipcRenderer.invoke("execute_action", index),
  hideRing: () => ipcRenderer.invoke("hide_ring"),
  openFileDialog: () => ipcRenderer.invoke("open_file_dialog"),
  getFileIcon: (filePath) => ipcRenderer.invoke("get_file_icon", filePath),
});
