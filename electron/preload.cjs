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
    clearResultsFolder: (data) => ipcRenderer.invoke('clear-results-folder', data),
    getLocalUrl: () => ipcRenderer.invoke('get-local-url'),
    onTelemetryUpdate: (callback) => ipcRenderer.on('telemetry-update', (_event, value) => callback(value)),
    offTelemetryUpdate: () => ipcRenderer.removeAllListeners('telemetry-update'),

    // Live Telemetry — LMU REST API
    startLmuPolling: () => ipcRenderer.invoke('start-lmu-polling'),
    stopLmuPolling:  () => ipcRenderer.invoke('stop-lmu-polling'),
    onLmuUpdate: (cb) => ipcRenderer.on('lmu-update', (_e, d) => cb(d)),
    offLmuUpdate: () => ipcRenderer.removeAllListeners('lmu-update'),
    onLmuLocalTelemetry: (cb) => ipcRenderer.on('lmu-local-telemetry', (_e, d) => cb(d)),
    offLmuLocalTelemetry: () => ipcRenderer.removeAllListeners('lmu-local-telemetry'),

    // Auto-Updater API
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value)),
});
