const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    findGamePath: () => ipcRenderer.invoke('find-game-path'),
    downloadSetup: (data) => ipcRenderer.invoke('download-setup', data),
    checkFileExists: (data) => ipcRenderer.invoke('check-file-exists', data)
});
