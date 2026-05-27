const _electron = require('electron');
console.error('[DEBUG] electron module type:', typeof _electron, '| is string?', typeof _electron === 'string', '| keys:', typeof _electron === 'object' && _electron ? Object.keys(_electron).slice(0,8).join(',') : 'none');
const { app, BrowserWindow, ipcMain, shell } = (typeof _electron === 'object' && _electron) ? _electron : {};
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
let autoUpdater = null;

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
        fullscreen: true,
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

    // ─────────────────────────────────────────────────────
    // AUTO-UPDATER ENGINE
    // ─────────────────────────────────────────────────────
    try {
        autoUpdater = require('electron-updater').autoUpdater;
    } catch (e) {
        console.warn('[AutoUpdater] Could not load:', e.message);
    }

    ipcMain.handle('get-app-version', () => app.getVersion());

    if (autoUpdater) {
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.logger = {
            info: (msg) => console.log('[AutoUpdater]', msg),
            warn: (msg) => console.warn('[AutoUpdater]', msg),
            error: (msg) => console.error('[AutoUpdater]', msg),
        };

        autoUpdater.on('checking-for-update', () => {
            console.log('[AutoUpdater] Checking for updates...');
            if (mainWindow) mainWindow.webContents.send('update-status', { status: 'checking' });
        });

        autoUpdater.on('update-available', (info) => {
            console.log('[AutoUpdater] Update available:', info.version);
            if (mainWindow) {
                mainWindow.webContents.send('update-status', {
                    status: 'available',
                    version: info.version,
                    releaseNotes: info.releaseNotes || '',
                    releaseDate: info.releaseDate || new Date().toISOString(),
                });
            }
        });

        autoUpdater.on('update-not-available', () => {
            console.log('[AutoUpdater] App is up to date.');
            if (mainWindow) mainWindow.webContents.send('update-status', { status: 'up-to-date' });
        });

        autoUpdater.on('download-progress', (progress) => {
            console.log(`[AutoUpdater] Download: ${progress.percent.toFixed(1)}%`);
            if (mainWindow) {
                mainWindow.webContents.send('update-status', {
                    status: 'downloading',
                    percent: progress.percent,
                    bytesPerSecond: progress.bytesPerSecond,
                    transferred: progress.transferred,
                    total: progress.total,
                });
            }
        });

        autoUpdater.on('update-downloaded', (info) => {
            console.log('[AutoUpdater] Update downloaded. Ready to install:', info.version);
            if (mainWindow) {
                mainWindow.webContents.send('update-status', { status: 'ready', version: info.version });
            }
        });

        autoUpdater.on('error', (err) => {
            console.error('[AutoUpdater] Error:', err.message);
            if (mainWindow) {
                mainWindow.webContents.send('update-status', { status: 'error', error: err.message });
            }
        });

        ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates());
        ipcMain.handle('download-update', () => autoUpdater.downloadUpdate());
        ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true));

        if (app.isPackaged) {
            setTimeout(() => {
                autoUpdater.checkForUpdates().catch(err => {
                    console.error('[AutoUpdater] Initial check failed:', err.message);
                });
            }, 3000);
            setInterval(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 30 * 60 * 1000);
        }
    } else {
        ipcMain.handle('check-for-updates', () => {});
        ipcMain.handle('download-update', () => {});
        ipcMain.handle('install-update', () => {});
    }

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

    ipcMain.handle('toggle-fullscreen', () => {
        if (mainWindow) {
            const isFull = mainWindow.isFullScreen();
            mainWindow.setFullScreen(!isFull);
            return !isFull;
        }
        return false;
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
    const fileLastProcessedTimes = new Map(); // filename -> timestamp

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
                if (filename && filename.endsWith('.xml')) {
                    const now = Date.now();
                    const lastTime = fileLastProcessedTimes.get(filename) || 0;
                    // Debounce de 3 segundos para evitar procesamientos duplicados del mismo guardado rápido
                    if (now - lastTime > 3000) {
                        fileLastProcessedTimes.set(filename, now);
                        console.log("Telemetry Engine: New result detected:", filename);
                        
                        // Delay to ensure file is completely written by the game
                        setTimeout(() => {
                            processResultXML(path.join(resultsPath, filename));
                        }, 1500);
                    }
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

            // IMPORTANT: Use TrackCourse (layout variant) NOT TrackVenue (venue complex)
            // TrackVenue = "Sebring International Raceway" (complex name)
            // TrackCourse = "Sebring School Circuit" (specific layout - matches scan-local-telemetry)
            const trackVenue = xml.match(/<TrackVenue>([^<]+)<\/TrackVenue>/i)?.[1] || "Unknown";
            const trackCourse = xml.match(/<TrackCourse>([^<]+)<\/TrackCourse>/i)?.[1] || trackVenue;
            const circuitName = trackCourse.trim();
            const trackTemp = xml.match(/<TrackTemp>([^<]+)<\/TrackTemp>/i)?.[1] || "--";
            
            const driverBlocks = xml.split(/<Driver>/i);
            driverBlocks.shift(); 

            const driverData = driverBlocks.map(block => {
                const name = block.match(/<Name>([^<]+)<\/Name>/i)?.[1];
                const car = block.match(/<CarType>([^<]+)<\/CarType>/i)?.[1];
                const bestLap = parseFloat(block.match(/<BestLapTime>([^<]+)<\/BestLapTime>/i)?.[1] || "0");
                const currentSetup = block.match(/<CurrentSetup>([^<]+)<\/CurrentSetup>/i)?.[1] || "Personalizado";
                
                const isPlayerMatch = block.match(/<isPlayer>([^<]+)<\/isPlayer>/i);
                const isPlayer = isPlayerMatch ? isPlayerMatch[1] === '1' : false;

                // RASTREO INTELIGENTE DE SECTORES Y VELOCIDAD
                let s1 = 0, s2 = 0, s3 = 0, topSpeed = 0;
                
                // Intento 1: Velocidad global del piloto
                topSpeed = parseFloat(block.match(/<TopSpeed>([^<]+)<\/TopSpeed>/i)?.[1] || "0");

                if (bestLap > 0) {
                    const laps = block.split(/<Lap /i);
                    laps.shift(); 
                    
                    for (const lapBlock of laps) {
                        const lapTimeText = lapBlock.match(/>([^<]+)<\/Lap>/)?.[1];
                        const lapTime = parseFloat(lapTimeText || "0");
                        
                        if (Math.abs(lapTime - bestLap) < 0.002) {
                            s1 = parseFloat(lapBlock.match(/s1="([^"]+)"/i)?.[1] || lapBlock.match(/<s1>([^<]+)<\/s1>/i)?.[1] || "0");
                            s2 = parseFloat(lapBlock.match(/s2="([^"]+)"/i)?.[1] || lapBlock.match(/<s2>([^<]+)<\/s2>/i)?.[1] || "0");
                            const rawS3 = lapBlock.match(/s3="([^"]+)"/i)?.[1] || lapBlock.match(/<s3>([^<]+)<\/s3>/i)?.[1];
                            s3 = rawS3 ? parseFloat(rawS3) : (lapTime - s1 - s2);
                            
                            // Intento 2: Velocidad en el bloque de la vuelta rápida (atributo o tag)
                            const lapSpeed = parseFloat(lapBlock.match(/speed="([^"]+)"/i)?.[1] || lapBlock.match(/<Speed>([^<]+)<\/Speed>/i)?.[1] || "0");
                            if (lapSpeed > topSpeed) topSpeed = lapSpeed;
                            break; 
                        }
                    }
                }

                // Conversión: Si la velocidad es sospechosamente baja (ej. 80), probablemente esté en m/s
                if (topSpeed > 0 && topSpeed < 150) topSpeed = topSpeed * 3.6;

                return { 
                    name, car, bestLap, currentSetup, 
                    sectors: { s1, s2, s3 },
                    topSpeed: topSpeed.toFixed(1),
                    isPlayer
                };
            }).filter(d => d.bestLap > 0 && d.name);

            console.log(`Telemetry Engine: Processed ${driverData.length} drivers for ${circuitName}`);

            if (mainWindow) {
                mainWindow.webContents.send('telemetry-update', {
                    circuit: circuitName,
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
            // OPTIMIZACIÓN: Ordenar por fecha de modificación real y tomar las 10 sesiones más recientes
            const files = fs.readdirSync(resultsPath)
                .filter(f => f.endsWith('.xml'))
                .map(f => {
                    const filePath = path.join(resultsPath, f);
                    try {
                        const stats = fs.statSync(filePath);
                        return { name: f, mtime: stats.mtimeMs };
                    } catch (e) {
                        return { name: f, mtime: 0 };
                    }
                })
                .sort((a, b) => b.mtime - a.mtime)
                .slice(0, 10)
                .map(f => f.name); 

            const allLaps = [];
            console.log(`MDT Debug: Iniciando escaneo cronológico de ${files.length} archivos...`);
            
            for (const filename of files) {
                const filePath = path.join(resultsPath, filename);
                const xml = fs.readFileSync(filePath, 'utf8');
                
                const setting = xml.match(/<Setting>([^<]+)<\/Setting>/i)?.[1] || "Unknown";
                
                const trackVenue = xml.match(/<TrackVenue>([^<]+)<\/TrackVenue>/i)?.[1] || "Unknown";
                const trackCourse = xml.match(/<TrackCourse>([^<]+)<\/TrackCourse>/i)?.[1] || trackVenue;
                const circuitName = trackCourse.trim();
                
                console.log(`MDT Debug: Procesando [${filename}] | Circuito: ${circuitName} | Modo: ${setting}`);

                // Eliminamos la restricción de Multiplayer para registrar todos los récords
                // if (!isMultiplayer) continue; 

                const dateMatch = filename.match(/^(\d{4}_\d{2}_\d{2})/i);
                const fileDate = dateMatch ? dateMatch[1].replace(/_/g, '-') : 'Reciente';
                
                // Normalización de versión: Forzamos el estándar 1.3000 para la rama 1.3
                const rawVersion = (xml.match(/<GameVersion>([^<]+)<\/GameVersion>/i)?.[1] || "").trim();
                const verMatch = rawVersion.match(/^(\d+\.\d)/);
                let gameVersion = verMatch ? verMatch[1] : 'Unknown';
                if (gameVersion === '1.3') gameVersion = '1.3000';
                
                const driverBlocks = xml.split(/<Driver>/i);
                driverBlocks.shift(); 
                
                driverBlocks.forEach(block => {
                    const name = (block.match(/<Name>([^<]+)<\/Name>/i)?.[1] || "").trim();
                    const car = (block.match(/<CarType>([^<]+)<\/CarType>/i)?.[1] || "").trim();
                    const bestLap = parseFloat(block.match(/<BestLapTime>([^<]+)<\/BestLapTime>/i)?.[1] || "0");
                    
                    if (bestLap > 0 && name && car) {
                    // Búsqueda inteligente de sectores de la MEJOR VUELTA
                    let s1 = 0, s2 = 0, s3 = 0;
                    const lapRegex = /<Lap[^>]+s1="([\d.]+)"[^>]+s2="([\d.]+)"[^>]+s3="([\d.]+)"[^>]*>([\d.]+)<\/Lap>/gi;
                    let foundMatch = false;

                    for (const match of block.matchAll(lapRegex)) {
                        const lapTime = parseFloat(match[4]);
                        // Si esta vuelta coincide con el BestLapTime (margen de error mínimo)
                        if (Math.abs(lapTime - bestLap) < 0.001) {
                            s1 = parseFloat(match[1]);
                            s2 = parseFloat(match[2]);
                            s3 = parseFloat(match[3]);
                            foundMatch = true;
                            break;
                        }
                    }

                    // Fallback si no encontramos la vuelta exacta por algún motivo
                    if (!foundMatch) {
                        s1 = parseFloat(block.match(/s1="([^"]+)"/i)?.[1] || "0");
                        s2 = parseFloat(block.match(/s2="([^"]+)"/i)?.[1] || "0");
                        const rawS3 = block.match(/s3="([^"]+)"/i)?.[1];
                        s3 = rawS3 ? parseFloat(rawS3) : (bestLap - s1 - s2);
                    }
                    
                    let topSpeed = parseFloat(block.match(/<TopSpeed>([^<]+)<\/TopSpeed>/i)?.[1] || "0");
                    if (topSpeed > 0 && topSpeed < 150) topSpeed = topSpeed * 3.6;

                    const isPlayerMatch = block.match(/<isPlayer>([^<]+)<\/isPlayer>/i);
                    const isPlayer = isPlayerMatch ? isPlayerMatch[1] === '1' : false;

                    if (isPlayer) console.log(`MDT Debug: -> Piloto: ${name} | Mejor Vuelta: ${bestLap} | Sectores OK: ${foundMatch}`);

                    allLaps.push({ 
                        circuit: circuitName, car, bestLap, name, 
                        date: fileDate, isPlayer, gameVersion,
                        sectors: { s1, s2, s3 },
                        topSpeed: topSpeed.toFixed(1)
                    });
                    }
                });
            }
            return allLaps;
        } catch (err) {
            console.error("Local Scan Error:", err);
            return [];
        }
    });

    ipcMain.handle('read-text-file', async (event, filePath) => {
        if (!fs.existsSync(filePath)) return null;
        return fs.readFileSync(filePath, 'utf8');
    });

    ipcMain.handle('write-text-file', async (event, { path: filePath, content }) => {
        try {
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        } catch (err) {
            console.error("IPC: Write error:", err);
            throw err;
        }
    });

    // ---------------------------------------------------------
    // DEPURAR RESULTS: Eliminar XMLs de la carpeta Results
    // ---------------------------------------------------------
    ipcMain.handle('clear-results-folder', async (event, { gamePath }) => {
        if (!gamePath) throw new Error('gamePath no proporcionado');
        const resultsPath = path.join(gamePath, 'UserData', 'Log', 'Results');

        if (!fs.existsSync(resultsPath)) {
            return { deleted: 0, error: 'Carpeta Results no encontrada' };
        }

        try {
            const files = fs.readdirSync(resultsPath).filter(f => f.endsWith('.xml'));
            let deleted = 0;
            for (const file of files) {
                fs.unlinkSync(path.join(resultsPath, file));
                deleted++;
            }
            console.log(`Clear Results: Eliminados ${deleted} archivos XML de ${resultsPath}`);
            return { deleted };
        } catch (err) {
            console.error('Clear Results Error:', err);
            throw err;
        }
    });

    // Handler genérico para listar carpetas o archivos
    ipcMain.handle('get-directory-contents', async (event, { path: dirPath, type, filter }) => {
        if (!fs.existsSync(dirPath)) return [];
        try {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            if (type === 'folders') {
                const folders = [];
                items.forEach(item => {
                    const isDir = item.isDirectory();
                    const isSym = item.isSymbolicLink();
                    if (isDir || isSym) {
                        folders.push(item.name);
                    }
                });
                return folders;
            } else if (type === 'files') {
                let files = items.filter(i => i.isFile()).map(i => i.name);
                if (filter) files = files.filter(f => f.endsWith(filter));
                return files;
            }
            return items.map(i => i.name);
        } catch (e) {
            console.error("Error listing directory:", e);
            return [];
        }
    });
});


// ---------------------------------------------------------
// LIVE TELEMETRY — LMU WebSocket + REST fallback
// WS:   ws://localhost:6398/websocket/controlpanel  (real-time)
// REST: http://localhost:6397/rest/multiplayer/teams (supplementary)
// ---------------------------------------------------------

let lmuWs = null;
let lmuReconnectTimer = null;
let lmuRestInterval = null;
let lmuLogOnce = false;

function lmuRestGet(path) {
    return new Promise((resolve) => {
        const req = http.get({ hostname: 'localhost', port: 6397, path, timeout: 2000 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

function lmuRestPost(path, body) {
    return new Promise((resolve) => {
        const bodyStr = JSON.stringify(body || {});
        const req = http.request({
            hostname: 'localhost', port: 6397, path, method: 'POST', timeout: 2000,
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(bodyStr);
        req.end();
    });
}

function normalizeVehicle(v) {
    const rawSpeed = v.speed ?? v.Speed ?? v.mSpeed ?? v.speedKmh ?? 0;
    const speedKmh = rawSpeed > 100 ? Math.round(rawSpeed) : Math.round(rawSpeed * 3.6);
    const d = v.driver || v.Driver || {};
    const driverName = v.driverName || v.DriverName || v.name || v.Name ||
        (typeof d === 'string' ? d : d.name || d.Name || d.fullName || '') || 'Unknown';
    return {
        driverName,
        car:         v.car || v.Car || v.vehicleName || v.vehicle || v.carName || '',
        speedKmh,
        rpm:         Math.round(v.rpm ?? v.RPM ?? v.mEngineRPM ?? 0),
        gear:        v.gear ?? v.Gear ?? v.mGear ?? 0,
        throttle:    v.throttle ?? v.Throttle ?? v.mThrottle ?? 0,
        brake:       v.brake ?? v.Brake ?? v.mBrake ?? 0,
        lap:         v.lap ?? v.laps ?? v.totalLaps ?? v.mTotalLaps ?? 0,
        lastLapTime: v.lastLapTime ?? v.lastLap ?? v.mLastLapTime ?? 0,
        bestLapTime: v.bestLapTime ?? v.bestLap ?? v.mBestLapTime ?? 0,
        place:       v.position ?? v.place ?? v.Place ?? v.mPlace ?? 0,
        inPits:      !!(v.inPits ?? v.InPits ?? v.mInPits ?? false),
    };
}

function buildLmuPayload(rawVehicles, sessionRaw) {
    if (!rawVehicles || rawVehicles.length === 0) return null;
    const s = sessionRaw || {};
    return {
        session: {
            track:       s.track || s.trackName || s.TrackName || s.name || s.sTrackName || '',
            type:        s.sessionType ?? s.type ?? s.Type ?? s.mSession ?? -1,
            numVehicles: rawVehicles.length,
        },
        vehicles: rawVehicles.map(normalizeVehicle),
    };
}

function processWsMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (!lmuLogOnce) {
        lmuLogOnce = true;
        console.log('[LMU WS] First message keys:', Object.keys(msg || {}));
        console.log('[LMU WS] Sample:', JSON.stringify(msg).slice(0, 600));
    }

    let vehicles = [];
    let session = null;

    if (Array.isArray(msg)) {
        vehicles = msg;
    } else if (msg && Array.isArray(msg.vehicles)) {
        vehicles = msg.vehicles;
        session = msg.session || msg.sessionInfo || null;
    } else if (msg && Array.isArray(msg.entries)) {
        vehicles = msg.entries;
    } else if (msg && msg.drivers && typeof msg.drivers === 'object') {
        vehicles = Object.values(msg.drivers);
        session = msg.session || null;
    } else if (msg && msg.type && msg.data) {
        const d = msg.data;
        vehicles = Array.isArray(d) ? d : (d && typeof d === 'object' ? [d] : []);
    }

    const payload = buildLmuPayload(vehicles, session);
    if (mainWindow) mainWindow.webContents.send('lmu-update', payload);
}

function startLmuRestFallback() {
    if (lmuRestInterval) return;
    console.log('[LMU] Starting REST fallback polling');
    lmuLogOnce = false;
    lmuRestInterval = setInterval(async () => {
        const [teams, allVehicles] = await Promise.all([
            lmuRestGet('/rest/multiplayer/teams'),
            lmuRestPost('/rest/sessions/getAllVehicles', {}),
        ]);

        if (!lmuLogOnce) {
            lmuLogOnce = true;
            console.log('[LMU REST] /rest/multiplayer/teams:', JSON.stringify(teams).slice(0, 400));
            console.log('[LMU REST] /rest/sessions/getAllVehicles:', JSON.stringify(allVehicles).slice(0, 400));
        }

        let rawVehicles = [];
        let sessionRaw = null;

        if (Array.isArray(allVehicles) && allVehicles.length > 0) {
            rawVehicles = allVehicles;
        } else if (teams && teams.drivers && typeof teams.drivers === 'object') {
            rawVehicles = Object.values(teams.drivers);
        } else if (teams && teams.teams && typeof teams.teams === 'object') {
            rawVehicles = Object.values(teams.teams).flatMap(t => t.drivers ? Object.values(t.drivers) : [t]);
        }

        const payload = buildLmuPayload(rawVehicles, sessionRaw);
        if (mainWindow) mainWindow.webContents.send('lmu-update', payload);
    }, 1000);
}

function connectLmuWs() {
    if (lmuWs) return;
    clearTimeout(lmuReconnectTimer);

    const WS = globalThis.WebSocket;
    if (!WS) {
        console.warn('[LMU] Native WebSocket unavailable (requires Node.js 22+). Using REST fallback.');
        startLmuRestFallback();
        return;
    }

    const wsUrl = 'ws://localhost:6398/websocket/controlpanel';
    console.log('[LMU] Connecting WebSocket:', wsUrl);
    lmuLogOnce = false;

    try {
        lmuWs = new WS(wsUrl);
    } catch (e) {
        console.error('[LMU] WS failed to create:', e.message);
        lmuWs = null;
        startLmuRestFallback();
        return;
    }

    lmuWs.onopen = () => console.log('[LMU] WebSocket open');

    lmuWs.onmessage = (ev) => processWsMessage(ev.data);

    lmuWs.onerror = () => {};

    lmuWs.onclose = () => {
        console.log('[LMU] WebSocket closed — retry in 5s');
        lmuWs = null;
        if (mainWindow) mainWindow.webContents.send('lmu-update', null);
        lmuReconnectTimer = setTimeout(connectLmuWs, 5000);
    };
}

function disconnectLmu() {
    clearTimeout(lmuReconnectTimer);
    clearInterval(lmuRestInterval);
    lmuRestInterval = null;
    if (lmuWs) {
        lmuWs.onclose = null;
        lmuWs.close();
        lmuWs = null;
    }
}

ipcMain.handle('start-lmu-polling', () => connectLmuWs());
ipcMain.handle('stop-lmu-polling', () => disconnectLmu());

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
