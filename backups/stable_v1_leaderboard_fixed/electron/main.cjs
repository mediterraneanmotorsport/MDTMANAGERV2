const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');

// Force unmuted autoplay for the intro video
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

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
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            autoplayPolicy: 'no-user-gesture-required'
        },
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0c0c0c',
            symbolColor: '#f5f5f5'
        }
    });

    const devUrl = 'http://localhost:5173';
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

    const configPath = path.join(app.getPath('userData'), 'config.json');

    ipcMain.handle('find-game-path', async () => {
        // 1. Check saved config first
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.gamePath && fs.existsSync(config.gamePath)) {
                    return config.gamePath;
                }
            } catch (err) { console.error("Error reading config:", err); }
        }

        // 2. Advanced Steam Detection
        const steamPaths = [
            'C:\\Program Files (x86)\\Steam',
            'C:\\Program Files\\Steam',
            'D:\\SteamLibrary',
            'E:\\SteamLibrary'
        ];

        // Try to find Steam installation via common paths first to get libraryfolders.vdf
        let mainSteamPath = null;
        for (const p of steamPaths) {
            if (fs.existsSync(path.join(p, 'steamapps', 'libraryfolders.vdf'))) {
                mainSteamPath = p;
                break;
            }
        }

        const gameFolderName = 'Le Mans Ultimate';
        const appId = '2399420';

        if (mainSteamPath) {
            try {
                const vdfPath = path.join(mainSteamPath, 'steamapps', 'libraryfolders.vdf');
                const vdfContent = fs.readFileSync(vdfPath, 'utf8');

                // Very simple VDF parser for paths
                const pathRegex = /"path"\s+"([^"]+)"/g;
                let match;
                const libraries = [];
                while ((match = pathRegex.exec(vdfContent)) !== null) {
                    libraries.push(match[1].replace(/\\\\/g, '\\'));
                }

                for (const lib of libraries) {
                    const potentialPath = path.join(lib, 'steamapps', 'common', gameFolderName);
                    if (fs.existsSync(potentialPath)) {
                        console.log("Steam Detection: Found game at", potentialPath);
                        return potentialPath;
                    }
                }
            } catch (err) {
                console.error("Error parsing libraryfolders.vdf:", err);
            }
        }

        // 3. Fallback to common paths if Steam logic fails
        for (const p of steamPaths) {
            const potentialPath = path.join(p, 'steamapps', 'common', gameFolderName);
            if (fs.existsSync(potentialPath)) {
                return potentialPath;
            }
        }

        return null;
    });

    ipcMain.handle('save-game-path', async (event, newPath) => {
        try {
            const config = fs.existsSync(configPath)
                ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
                : {};
            config.gamePath = newPath;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            return true;
        } catch (err) {
            console.error("Error saving path:", err);
            return false;
        }
    });

    ipcMain.handle('test-ipc', () => {
        console.log("IPC: test-ipc received");
        return "IPC_OK";
    });

    ipcMain.handle('select-directory', async () => {
        console.log("IPC: select-directory started");
        const { dialog } = require('electron');

        try {
            // Using a simpler call first to see if it responds at all
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Select Game Folder'
            });

            if (result.canceled) {
                console.log("IPC: User canceled dialog");
                return null;
            }
            console.log("IPC: Directory selected:", result.filePaths[0]);
            return result.filePaths[0];
        } catch (error) {
            console.error("IPC ERROR in select-directory:", error);
            throw error;
        }
    });

    ipcMain.handle('download-setup', async (event, { url, circuit, fileName, gamePath, version, lastUpdated }) => {
        if (!gamePath || !circuit || !fileName || !url) {
            throw new Error('Missing arguments for download');
        }

        const circuitDir = path.join(gamePath, 'UserData', 'player', 'Settings', circuit);
        const targetFile = path.join(circuitDir, fileName);
        const backupDir = path.join(circuitDir, 'backups');
        const manifestPath = path.join(circuitDir, '.mdt_manifest.json');

        try {
            if (!fs.existsSync(circuitDir)) {
                fs.mkdirSync(circuitDir, { recursive: true });
            }

            // AUTO-BACKUP
            if (fs.existsSync(targetFile)) {
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFile = path.join(backupDir, `${path.parse(fileName).name}_${timestamp}${path.parse(fileName).ext}`);
                fs.copyFileSync(targetFile, backupFile);
                console.log("Backup created:", backupFile);
            }

            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(targetFile);
                https.get(url, (response) => {
                    if (response.statusCode !== 200) {
                        return reject(new Error(`Failed to download: ${response.statusCode}`));
                    }
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close(() => {
                            // UPDATE MANIFEST
                            try {
                                let manifest = {};
                                if (fs.existsSync(manifestPath)) {
                                    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                                }
                                manifest[fileName] = {
                                    version: version || '1.0.0',
                                    installedAt: new Date().toISOString(),
                                    lastUpdated: lastUpdated || new Date().toISOString()
                                };
                                fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
                            } catch (e) {
                                console.error("Error updating manifest:", e);
                            }
                            resolve(targetFile);
                        });
                    });
                }).on('error', (err) => {
                    fs.unlink(targetFile, () => { });
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

    ipcMain.handle('get-local-manifest', async (event, { circuit, gamePath }) => {
        if (!gamePath || !circuit) return {};
        const manifestPath = path.join(gamePath, 'UserData', 'player', 'Settings', circuit, '.mdt_manifest.json');
        try {
            if (fs.existsSync(manifestPath)) {
                return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            }
        } catch (e) { console.error("Error reading manifest:", e); }
        return {};
    });

    ipcMain.handle('cleanup-setups', async (event, { circuit, gamePath, whitelist }) => {
        if (!gamePath || !circuit || !whitelist) return 0;
        const circuitDir = path.join(gamePath, 'UserData', 'player', 'Settings', circuit);
        try {
            if (!fs.existsSync(circuitDir)) return 0;
            const files = fs.readdirSync(circuitDir);
            let deletedCount = 0;
            for (const file of files) {
                if (file.endsWith('.svm') && !whitelist.includes(file)) {
                    fs.unlinkSync(path.join(circuitDir, file));
                    deletedCount++;
                }
            }
            return deletedCount;
        } catch (error) {
            console.error("Cleanup failed:", error);
            throw error;
        }
    });

    ipcMain.handle('delete-setup', async (event, { circuit, fileName, gamePath }) => {
        if (!gamePath || !circuit || !fileName) {
            console.error("IPC: Delete failed - Missing arguments");
            return false;
        }
        const targetFile = path.join(gamePath, 'UserData', 'player', 'Settings', circuit, fileName);
        console.log("IPC: Attempting to delete file:", targetFile);
        try {
            if (fs.existsSync(targetFile)) {
                fs.unlinkSync(targetFile);
                console.log("IPC: File deleted successfully");
                return true;
            } else {
                console.warn("IPC: File not found for deletion:", targetFile);
                return true; 
            }
        } catch (error) {
            console.error("IPC: Delete system error:", error);
            throw error;
        }
    });

    // ---------------------------------------------------------
    // MDT TELEMETRY WATCHER ENGINE
    // ---------------------------------------------------------
    let resultWatcher = null;
    let lastProcessedFile = null;

    ipcMain.handle('start-telemetry-watcher', (event, { gamePath }) => {
        if (!gamePath) return false;
        const resultsPath = path.join(gamePath, 'UserData', 'Log', 'Results');
        console.log("Telemetry Engine: Monitoring results at", resultsPath);

        if (!fs.existsSync(resultsPath)) {
            console.warn("Telemetry Engine: Path not found");
            return false;
        }

        if (resultWatcher) {
            resultWatcher.close();
            resultWatcher = null;
        }

        try {
            resultWatcher = fs.watch(resultsPath, (eventType, filename) => {
                if (filename && filename.endsWith('.xml') && filename !== lastProcessedFile) {
                    console.log("Telemetry Engine: New result detected:", filename);
                    lastProcessedFile = filename;
                    
                    // Delay to ensure file is completely written by the game
                    setTimeout(() => {
                        processResultXML(path.join(resultsPath, filename));
                    }, 5000);
                }
            });
            return true;
        } catch (err) {
            console.error("Telemetry Engine Error:", err);
            return false;
        }
    });

    function processResultXML(filePath) {
        try {
            if (!fs.existsSync(filePath)) return;
            const xml = fs.readFileSync(filePath, 'utf8');

            // Extraction using regex (fast and requires no extra dependencies)
            const trackVenue = xml.match(/<TrackVenue>([^<]+)<\/TrackVenue>/)?.[1] || "Unknown";
            const trackTemp = xml.match(/<TrackTemp>([^<]+)<\/TrackTemp>/)?.[1] || "--";
            
            // Extract Driver Blocks
            const driverBlocks = xml.split('<Driver>');
            driverBlocks.shift(); // Remove content before first driver

            const driverData = driverBlocks.map(block => {
                const name = block.match(/<Name>([^<]+)<\/Name>/)?.[1];
                const car = block.match(/<CarType>([^<]+)<\/CarType>/)?.[1];
                const bestLap = parseFloat(block.match(/<BestLapTime>([^<]+)<\/BestLapTime>/)?.[1] || "0");
                const currentSetup = block.match(/<CurrentSetup>([^<]+)<\/CurrentSetup>/)?.[1] || "Personalizado";

                return { name, car, bestLap, currentSetup };
            }).filter(d => d.bestLap > 0 && d.name);

            console.log(`Telemetry Engine: Processed ${driverData.length} drivers for ${trackVenue}`);

            if (mainWindow) {
                mainWindow.webContents.send('telemetry-update', {
                    circuit: trackVenue,
                    trackTemp: trackTemp,
                    results: driverData,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error("Telemetry Engine: Parse error:", err);
        }
    }

    ipcMain.handle('scan-local-telemetry', async (event, { gamePath }) => {
        if (!gamePath) return [];
        const resultsPath = path.join(gamePath, 'UserData', 'Log', 'Results');
        if (!fs.existsSync(resultsPath)) return [];
        
        try {
            const files = fs.readdirSync(resultsPath).filter(f => f.endsWith('.xml'));
            const allLaps = [];
            
            for (const file of files) {
                const filePath = path.join(resultsPath, file);
                const xml = fs.readFileSync(filePath, 'utf8');
                
                const setting = xml.match(/<Setting>([^<]+)<\/Setting>/i)?.[1];
                if (!setting || setting.trim().toLowerCase() !== 'multiplayer') {
                    continue;
                }

                const trackVenue = xml.match(/<TrackVenue>([^<]+)<\/TrackVenue>/)?.[1] || "Unknown";
                const trackCourse = xml.match(/<TrackCourse>([^<]+)<\/TrackCourse>/)?.[1] || trackVenue;
                const circuitName = trackCourse;
                const dateMatch = file.match(/^(\d{4}_\d{2}_\d{2})/);
                const fileDate = dateMatch ? dateMatch[1].replace(/_/g, '-') : 'Reciente';
                const gameVersion = xml.match(/<GameVersion>([^<]+)<\/GameVersion>/)?.[1] || "Unknown";
                
                const driverBlocks = xml.split('<Driver>');
                driverBlocks.shift(); 
                
                driverBlocks.forEach(block => {
                    const name = block.match(/<Name>([^<]+)<\/Name>/)?.[1];
                    const car = block.match(/<CarType>([^<]+)<\/CarType>/)?.[1];
                    const bestLap = parseFloat(block.match(/<BestLapTime>([^<]+)<\/BestLapTime>/)?.[1] || "0");
                    const isPlayerMatch = block.match(/<isPlayer>([^<]+)<\/isPlayer>/i);
                    const isPlayer = isPlayerMatch ? isPlayerMatch[1] === '1' : false;
                    
                    if (bestLap > 0 && name && car) {
                        allLaps.push({ circuit: circuitName, car, bestLap, name, date: fileDate, isPlayer, gameVersion });
                    }
                });
            }
            return allLaps;
        } catch (err) {
            console.error("Local Scan Error:", err);
            return [];
        }
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
