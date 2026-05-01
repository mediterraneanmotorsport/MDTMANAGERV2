const { contextBridge, ipcRenderer } = require('electron');

console.log("Preload script loaded successfully");

contextBridge.exposeInMainWorld('electronAPI', {
    testIPC: () => ipcRenderer.invoke('test-ipc'),
    findGamePath: () => ipcRenderer.invoke('find-game-path'),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    saveGamePath: (path) => ipcRenderer.invoke('save-game-path', path),
    downloadSetup: (data) => ipcRenderer.invoke('download-setup', data),
    deleteSetup: (data) => ipcRenderer.invoke('delete-setup', data),
    checkFileExists: (data) => ipcRenderer.invoke('check-file-exists', data),
    getLocalManifest: (data) => ipcRenderer.invoke('get-local-manifest', data),
    cleanupSetups: (data) => ipcRenderer.invoke('cleanup-setups', data),
    startTelemetryWatcher: (data) => ipcRenderer.invoke('start-telemetry-watcher', data),
    scanLocalTelemetry: (data) => ipcRenderer.invoke('scan-local-telemetry', data),
    onTelemetryUpdate: (callback) => ipcRenderer.on('telemetry-update', (_event, value) => callback(value))
});
