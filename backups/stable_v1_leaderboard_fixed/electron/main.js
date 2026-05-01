const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: '#0c0c0c',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: 'hidden', // Custom title bar potential
        titleBarOverlay: {
            color: '#0c0c0c',
            symbolColor: '#f5f5f5'
        }
    });

    // Check if we are in dev mode (VITE_DEV_SERVER_URL is usually passed via env in some setups, 
    // but for simple concurrently setup we might just assume localhost:5173)
    // We'll rely on an env var usually set by the runner, or default to dev port.
    const devUrl = 'http://localhost:5173';

    // In a real prod build step this logic is often more complex or uses electron-is-dev
    // For this scaffold, we'll try to load the dev URL first.

    // A simple way to detect development:
    const isDev = !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL(devUrl).catch(e => {
            console.error("Failed to load dev url, is vite running?", e);
        });
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};

app.on('ready', () => {
    createWindow();

    // IPC Handlers
    ipcMain.handle('find-game-path', async () => {
        // Common paths for Le Mans Ultimate
        const commonPaths = [
            'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Le Mans Ultimate',
            'C:\\Program Files\\Steam\\steamapps\\common\\Le Mans Ultimate',
            'D:\\SteamLibrary\\steamapps\\common\\Le Mans Ultimate',
            'E:\\SteamLibrary\\steamapps\\common\\Le Mans Ultimate'
        ];

        for (const p of commonPaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
        return null;
    });

    ipcMain.handle('download-setup', async (event, { url, circuit, fileName, gamePath }) => {
        if (!gamePath || !circuit || !fileName || !url) {
            throw new Error('Missing arguments for download');
        }

        // Target: [GamePath]/UserData/player/Settings/[CircuitName]/[fileName]
        const targetDir = path.join(gamePath, 'UserData', 'player', 'Settings', circuit);
        const targetFile = path.join(targetDir, fileName);

        try {
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Simple file download using https (nodes native) specific to the URL provided
            // Assuming the URL is a direct download link (e.g. from Firebase Storage)

            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(targetFile);
                https.get(url, (response) => {
                    if (response.statusCode !== 200) {
                        return reject(new Error(`Failed to download: ${response.statusCode}`));
                    }
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close(() => resolve(targetFile));
                    });
                }).on('error', (err) => {
                    fs.unlink(targetFile, () => { }); // Delete partial file
                    reject(err);
                });
            });

        } catch (error) {
            console.error("Download failed:", error);
            throw error;
        }
    });

    ipcMain.handle('check-file-exists', async (event, { circuit, fileName, gamePath }) => {
        if (!gamePath || !circuit || !fileName) return false;
        const targetFile = path.join(gamePath, 'UserData', 'player', 'Settings', circuit, fileName);
        return fs.existsSync(targetFile);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
