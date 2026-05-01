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
    readSetupFile: (path) => ipcRenderer.invoke('read-text-file', path),
    saveSetupFile: (data) => ipcRenderer.invoke('write-text-file', data),
    getDirectoryContents: (args) => ipcRenderer.invoke('get-directory-contents', args),
    toggleFullScreen: () => ipcRenderer.invoke('toggle-fullscreen'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
    onUpdateReady: (callback) => ipcRenderer.on('update-ready', (_event, info) => callback(info)),
    onTelemetryUpdate: (callback) => ipcRenderer.on('telemetry-update', (_event, value) => callback(value))
});
