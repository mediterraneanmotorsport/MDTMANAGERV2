import electronModule from 'electron';
const { app, BrowserWindow, ipcMain, dialog } = electronModule;
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';
import os from 'os';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Force unmuted autoplay for the intro video
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

const appPath = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
const electronPath = app.isPackaged ? appPath : path.join(appPath, 'electron');

let mainWindow;
let autoUpdater = null;
let lmuShmProc = null;
let lmuEnergyProc = null;

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

    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173').catch(e => {
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
    // LOCAL NETWORK EXPRESS SERVER (For Mobile QR)
    // ─────────────────────────────────────────────────────
    const expressApp = express();
    expressApp.use(cors());
    expressApp.use(express.static(path.join(__dirname, '../dist')));

    // SSE Endpoint for Mobile Telemetry
    const sseClients = new Set();
    expressApp.get('/api/stream', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
    });

    global.broadcastToSse = function(channel, data) {
        const payload = JSON.stringify({ channel, data });
        for (const res of sseClients) {
            res.write(`data: ${payload}\n\n`);
        }
    };    


    const localPort = 8888;
    let localServer;
    try {
        localServer = expressApp.listen(localPort, () => {
            console.log(`[Express] Local server running on port ${localPort}`);
        });
    } catch(e) {
        console.error("[Express] Error starting local server:", e);
    }

    function getLocalIpAddress() {
        const interfaces = os.networkInterfaces();
        for (const devName in interfaces) {
            const iface = interfaces[devName];
            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    return alias.address;
                }
            }
        }
        return '127.0.0.1';
    }

    ipcMain.handle('get-local-url', () => {
        return `http://${getLocalIpAddress()}:${localPort}`;
    });

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
            info:  (msg) => console.log('[AutoUpdater]', msg),
            warn:  (msg) => console.warn('[AutoUpdater]', msg),
            error: (msg) => console.error('[AutoUpdater]', msg),
        };

        autoUpdater.on('checking-for-update', () => {
            if (mainWindow) mainWindow.webContents.send('update-status', { status: 'checking' });
        });
        autoUpdater.on('update-available', (info) => {
            if (mainWindow) mainWindow.webContents.send('update-status', {
                status: 'available', version: info.version,
                releaseNotes: info.releaseNotes || '',
                releaseDate: info.releaseDate || new Date().toISOString(),
            });
        });
        autoUpdater.on('update-not-available', () => {
            if (mainWindow) mainWindow.webContents.send('update-status', { status: 'up-to-date' });
        });
        autoUpdater.on('download-progress', (progress) => {
            if (mainWindow) mainWindow.webContents.send('update-status', {
                status: 'downloading', percent: progress.percent,
                bytesPerSecond: progress.bytesPerSecond,
                transferred: progress.transferred, total: progress.total,
            });
        });
        autoUpdater.on('update-downloaded', (info) => {
            if (mainWindow) mainWindow.webContents.send('update-status', { status: 'ready', version: info.version });
        });
        autoUpdater.on('error', (err) => {
            if (mainWindow) mainWindow.webContents.send('update-status', { status: 'error', error: err.message });
        });

        ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates());
        ipcMain.handle('download-update',   () => autoUpdater.downloadUpdate());
        ipcMain.handle('install-update',    () => autoUpdater.quitAndInstall(false, true));

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
        ipcMain.handle('download-update',   () => {});
        ipcMain.handle('install-update',    () => {});
    }

    // ─────────────────────────────────────────────────────
    // GAME PATH & CONFIG
    // ─────────────────────────────────────────────────────
    const configPath = path.join(app.getPath('userData'), 'config.json');

    ipcMain.handle('find-game-path', async () => {
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.gamePath && fs.existsSync(config.gamePath)) return config.gamePath;
            } catch (err) { console.error("Error reading config:", err); }
        }

        const steamPaths = [
            'C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam',
            'D:\\SteamLibrary', 'E:\\SteamLibrary'
        ];
        const gameFolderName = 'Le Mans Ultimate';

        let mainSteamPath = null;
        for (const p of steamPaths) {
            if (fs.existsSync(path.join(p, 'steamapps', 'libraryfolders.vdf'))) {
                mainSteamPath = p;
                break;
            }
        }

        if (mainSteamPath) {
            try {
                const vdfContent = fs.readFileSync(path.join(mainSteamPath, 'steamapps', 'libraryfolders.vdf'), 'utf8');
                const pathRegex = /"path"\s+"([^"]+)"/g;
                let match;
                while ((match = pathRegex.exec(vdfContent)) !== null) {
                    const potentialPath = path.join(match[1].replace(/\\\\/g, '\\'), 'steamapps', 'common', gameFolderName);
                    if (fs.existsSync(potentialPath)) return potentialPath;
                }
            } catch (err) { console.error("Error parsing libraryfolders.vdf:", err); }
        }

        for (const p of steamPaths) {
            const potentialPath = path.join(p, 'steamapps', 'common', gameFolderName);
            if (fs.existsSync(potentialPath)) return potentialPath;
        }
        return null;
    });

    ipcMain.handle('save-game-path', async (event, newPath) => {
        try {
            const config = fs.existsSync(configPath)
                ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
            config.gamePath = newPath;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            return true;
        } catch (err) { console.error("Error saving path:", err); return false; }
    });

    ipcMain.handle('test-ipc', () => "IPC_OK");

    ipcMain.handle('select-directory', async () => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Select Game Folder'
            });
            return result.canceled ? null : result.filePaths[0];
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

    // ─────────────────────────────────────────────────────
    // SETUP DOWNLOAD / MANIFEST
    // ─────────────────────────────────────────────────────
    ipcMain.handle('download-setup', async (event, { url, circuit, fileName, gamePath, version, lastUpdated }) => {
        if (!gamePath || !circuit || !fileName || !url) throw new Error('Missing arguments for download');

        const circuitDir  = path.join(gamePath, 'UserData', 'player', 'Settings', circuit);
        const targetFile  = path.join(circuitDir, fileName);
        const backupDir   = path.join(circuitDir, 'backups');
        const manifestPath = path.join(circuitDir, '.mdt_manifest.json');

        if (!fs.existsSync(circuitDir)) fs.mkdirSync(circuitDir, { recursive: true });

        if (fs.existsSync(targetFile)) {
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `${path.parse(fileName).name}_${ts}${path.parse(fileName).ext}`);
            fs.copyFileSync(targetFile, backupFile);
        }

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(targetFile);
            https.get(url, (response) => {
                if (response.statusCode !== 200) return reject(new Error(`Failed to download: ${response.statusCode}`));
                response.pipe(file);
                file.on('finish', () => {
                    file.close(() => {
                        try {
                            let manifest = {};
                            if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                            manifest[fileName] = {
                                version: version || '1.0.0',
                                installedAt: new Date().toISOString(),
                                lastUpdated: lastUpdated || new Date().toISOString()
                            };
                            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
                        } catch (e) { console.error("Error updating manifest:", e); }
                        resolve(targetFile);
                    });
                });
            }).on('error', (err) => { fs.unlink(targetFile, () => {}); reject(err); });
        });
    });

    ipcMain.handle('check-file-exists', async (event, { circuit, fileName, gamePath }) => {
        if (!gamePath || !circuit || !fileName) return false;
        return fs.existsSync(path.join(gamePath, 'UserData', 'player', 'Settings', circuit, fileName));
    });

    ipcMain.handle('get-local-manifest', async (event, { circuit, gamePath }) => {
        if (!gamePath || !circuit) return {};
        const manifestPath = path.join(gamePath, 'UserData', 'player', 'Settings', circuit, '.mdt_manifest.json');
        try {
            if (fs.existsSync(manifestPath)) return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch (e) { console.error("Error reading manifest:", e); }
        return {};
    });

    ipcMain.handle('cleanup-setups', async (event, { circuit, gamePath, whitelist }) => {
        if (!gamePath || !circuit || !whitelist) return 0;
        const circuitDir = path.join(gamePath, 'UserData', 'player', 'Settings', circuit);
        try {
            if (!fs.existsSync(circuitDir)) return 0;
            let deletedCount = 0;
            for (const file of fs.readdirSync(circuitDir)) {
                if (file.endsWith('.svm') && !whitelist.includes(file)) {
                    fs.unlinkSync(path.join(circuitDir, file));
                    deletedCount++;
                }
            }
            return deletedCount;
        } catch (error) { console.error("Cleanup failed:", error); throw error; }
    });

    ipcMain.handle('delete-setup', async (event, { circuit, fileName, gamePath }) => {
        if (!gamePath || !circuit || !fileName) return false;
        const targetFile = path.join(gamePath, 'UserData', 'player', 'Settings', circuit, fileName);
        try {
            if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
            return true;
        } catch (error) { console.error("IPC: Delete system error:", error); throw error; }
    });

    // ─────────────────────────────────────────────────────
    // MDT TELEMETRY WATCHER ENGINE
    // ─────────────────────────────────────────────────────
    let resultWatcher = null;
    let lastProcessedFile = null;

    ipcMain.handle('start-telemetry-watcher', (event, { gamePath }) => {
        if (!gamePath) return false;
        const resultsPath = path.join(gamePath, 'UserData', 'Log', 'Results');
        if (!fs.existsSync(resultsPath)) return false;

        if (resultWatcher) { resultWatcher.close(); resultWatcher = null; }

        try {
            resultWatcher = fs.watch(resultsPath, (eventType, filename) => {
                if (filename && filename.endsWith('.xml') && filename !== lastProcessedFile) {
                    lastProcessedFile = filename;
                    setTimeout(() => processResultXML(path.join(resultsPath, filename)), 1500);
                }
            });
            return true;
        } catch (err) { console.error("Telemetry Engine Error:", err); return false; }
    });

    function processResultXML(filePath) {
        try {
            if (!fs.existsSync(filePath)) return;
            const xml = fs.readFileSync(filePath, 'utf8');

            const trackVenue  = xml.match(/<TrackVenue>([^<]+)<\/TrackVenue>/i)?.[1] || "Unknown";
            const trackCourse = xml.match(/<TrackCourse>([^<]+)<\/TrackCourse>/i)?.[1] || trackVenue;
            const circuitName = trackCourse.trim();
            const trackTemp   = xml.match(/<TrackTemp>([^<]+)<\/TrackTemp>/i)?.[1] || "--";

            const driverBlocks = xml.split(/<Driver>/i);
            driverBlocks.shift();

            const driverData = driverBlocks.map(block => {
                const name         = block.match(/<Name>([^<]+)<\/Name>/i)?.[1];
                const car          = block.match(/<CarType>([^<]+)<\/CarType>/i)?.[1];
                const bestLap      = parseFloat(block.match(/<BestLapTime>([^<]+)<\/BestLapTime>/i)?.[1] || "0");
                const currentSetup = block.match(/<CurrentSetup>([^<]+)<\/CurrentSetup>/i)?.[1] || "Personalizado";

                let s1 = 0, s2 = 0, s3 = 0;
                let topSpeed = parseFloat(block.match(/<TopSpeed>([^<]+)<\/TopSpeed>/i)?.[1] || "0");

                if (bestLap > 0) {
                    const laps = block.split(/<Lap /i);
                    laps.shift();
                    for (const lapBlock of laps) {
                        const lapTime = parseFloat(lapBlock.match(/>([^<]+)<\/Lap>/)?.[1] || "0");
                        if (Math.abs(lapTime - bestLap) < 0.002) {
                            s1 = parseFloat(lapBlock.match(/s1="([^"]+)"/i)?.[1] || "0");
                            s2 = parseFloat(lapBlock.match(/s2="([^"]+)"/i)?.[1] || "0");
                            const rawS3 = lapBlock.match(/s3="([^"]+)"/i)?.[1];
                            s3 = rawS3 ? parseFloat(rawS3) : (lapTime - s1 - s2);
                            const lapSpeed = parseFloat(lapBlock.match(/speed="([^"]+)"/i)?.[1] || "0");
                            if (lapSpeed > topSpeed) topSpeed = lapSpeed;
                            break;
                        }
                    }
                }
                if (topSpeed > 0 && topSpeed < 150) topSpeed = topSpeed * 3.6;

                return { name, car, bestLap, currentSetup, sectors: { s1, s2, s3 }, topSpeed: topSpeed.toFixed(1) };
            }).filter(d => d.bestLap > 0 && d.name);

            if (mainWindow) {
                mainWindow.webContents.send('telemetry-update', {
                    circuit: circuitName, trackTemp, results: driverData,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) { console.error("Telemetry Engine: Parse error:", err); }
    }

    ipcMain.handle('scan-local-telemetry', async (event, { gamePath }) => {
        if (!gamePath) return [];
        const resultsPath = path.join(gamePath, 'UserData', 'Log', 'Results');
        if (!fs.existsSync(resultsPath)) return [];

        try {
            const files = fs.readdirSync(resultsPath)
                .filter(f => f.endsWith('.xml'))
                .sort((a, b) => b.localeCompare(a))
                .slice(0, 10);

            const allLaps = [];
            console.log(`MDT Debug: Iniciando escaneo cronológico de ${files.length} archivos...`);

            for (const filename of files) {
                const filePath = path.join(resultsPath, filename);
                const xml = fs.readFileSync(filePath, 'utf8');

                const trackVenue  = xml.match(/<TrackVenue>([^<]+)<\/TrackVenue>/i)?.[1] || "Unknown";
                const trackCourse = xml.match(/<TrackCourse>([^<]+)<\/TrackCourse>/i)?.[1] || trackVenue;
                const circuitName = trackCourse.trim();
                console.log(`MDT Debug: Procesando [${filename}] | Circuito: ${circuitName}`);

                const dateMatch = filename.match(/^(\d{4}_\d{2}_\d{2})/i);
                const fileDate  = dateMatch ? dateMatch[1].replace(/_/g, '-') : 'Reciente';

                const rawVersion = (xml.match(/<GameVersion>([^<]+)<\/GameVersion>/i)?.[1] || "").trim();
                const verMatch   = rawVersion.match(/^(\d+\.\d)/);
                let gameVersion  = verMatch ? verMatch[1] : 'Unknown';
                if (gameVersion === '1.3') gameVersion = '1.3000';

                const driverBlocks = xml.split(/<Driver>/i);
                driverBlocks.shift();

                driverBlocks.forEach(block => {
                    const name    = (block.match(/<Name>([^<]+)<\/Name>/i)?.[1] || "").trim();
                    const car     = (block.match(/<CarType>([^<]+)<\/CarType>/i)?.[1] || "").trim();
                    const bestLap = parseFloat(block.match(/<BestLapTime>([^<]+)<\/BestLapTime>/i)?.[1] || "0");

                    if (bestLap > 0 && name && car) {
                        let s1 = 0, s2 = 0, s3 = 0;
                        const lapRegex = /<Lap[^>]+s1="([\d.]+)"[^>]+s2="([\d.]+)"[^>]+s3="([\d.]+)"[^>]*>([\d.]+)<\/Lap>/gi;
                        let foundMatch = false;

                        for (const match of block.matchAll(lapRegex)) {
                            if (Math.abs(parseFloat(match[4]) - bestLap) < 0.001) {
                                s1 = parseFloat(match[1]);
                                s2 = parseFloat(match[2]);
                                s3 = parseFloat(match[3]);
                                foundMatch = true;
                                break;
                            }
                        }

                        if (!foundMatch) {
                            s1 = parseFloat(block.match(/s1="([^"]+)"/i)?.[1] || "0");
                            s2 = parseFloat(block.match(/s2="([^"]+)"/i)?.[1] || "0");
                            const rawS3 = block.match(/s3="([^"]+)"/i)?.[1];
                            s3 = rawS3 ? parseFloat(rawS3) : (bestLap - s1 - s2);
                        }

                        let topSpeed = parseFloat(block.match(/<TopSpeed>([^<]+)<\/TopSpeed>/i)?.[1] || "0");
                        if (topSpeed > 0 && topSpeed < 150) topSpeed = topSpeed * 3.6;

                        const isPlayer = block.match(/<isPlayer>([^<]+)<\/isPlayer>/i)?.[1] === '1';
                        if (isPlayer) console.log(`MDT Debug: -> Piloto: ${name} | Mejor Vuelta: ${bestLap} | Sectores OK: ${foundMatch}`);

                        allLaps.push({
                            circuit: circuitName, car, bestLap, name,
                            date: fileDate, isPlayer, gameVersion,
                            sectors: { s1, s2, s3 }, topSpeed: topSpeed.toFixed(1)
                        });
                    }
                });
            }
            return allLaps;
        } catch (err) { console.error("Local Scan Error:", err); return []; }
    });

    ipcMain.handle('read-text-file', async (event, filePath) => {
        if (!fs.existsSync(filePath)) return null;
        return fs.readFileSync(filePath, 'utf8');
    });

    ipcMain.handle('write-text-file', async (event, { path: filePath, content }) => {
        try {
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        } catch (err) { console.error("IPC: Write error:", err); throw err; }
    });

    ipcMain.handle('clear-results-folder', async (event, { gamePath }) => {
        if (!gamePath) throw new Error('gamePath no proporcionado');
        const resultsPath = path.join(gamePath, 'UserData', 'Log', 'Results');
        if (!fs.existsSync(resultsPath)) return { deleted: 0, error: 'Carpeta Results no encontrada' };
        try {
            const files = fs.readdirSync(resultsPath).filter(f => f.endsWith('.xml'));
            let deleted = 0;
            for (const file of files) { fs.unlinkSync(path.join(resultsPath, file)); deleted++; }
            return { deleted };
        } catch (err) { console.error('Clear Results Error:', err); throw err; }
    });

    ipcMain.handle('get-directory-contents', async (event, { path: dirPath, type, filter }) => {
        if (!fs.existsSync(dirPath)) return [];
        try {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            if (type === 'folders') return items.filter(i => i.isDirectory() || i.isSymbolicLink()).map(i => i.name);
            if (type === 'files') {
                let files = items.filter(i => i.isFile()).map(i => i.name);
                return filter ? files.filter(f => f.endsWith(filter)) : files;
            }
            return items.map(i => i.name);
        } catch (e) { console.error("Error listing directory:", e); return []; }
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
let lmuVehicleStatePoll = null;
let lmuLogOnce = false;
let lmuLastSession = null;         // cached session info from non-standings messages
let lmuSeenMsgTypes = new Set();   // tracks unique WS message types for diagnostics
let lmuVehicleStateMap = new Map(); // driverName → {gear,rpm,throttle,brake,inPits}

// ── Shared memory reader (gear / RPM / throttle / brake) ──────────────────
// Byte offsets from pyLMUSharedMemory struct definitions (pack=4):
//   LMUObjectOut: generic(332) + paths(1300) + scoring(126824) = 128456 → telemetry
//   vehScoringInfo[0] = 1632 + 552 = 2184, each LMUVehicleScoring = 584 bytes
//     mDriverName at +4 (char*32), mIsPlayer at +196 (bool)
//   telemInfo[0] at 128460, each LMUVehicleTelemetry = 1492 bytes
//     mGear(+352 int32), mEngineRPM(+356 double), mFilteredThrottle(+420), mFilteredBrake(+428)

const SHMEM_PS1 = `
$ErrorActionPreference = 'SilentlyContinue'

$code = @"
using System;
using System.Runtime.InteropServices;
namespace LMU {
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct rF2Vec3 { public double x, y, z; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct rF2Wheel {
        public double mSuspensionDeflection, mRideHeight, mSuspForce, mBrakeTemp, mBrakePressure;
        public double mRotation, mLateralPatchVel, mLongitudinalPatchVel, mLateralGroundVel, mLongitudinalGroundVel, mCamber, mLateralForce, mLongitudinalForce, mTireLoad;
        public double mGripFract, mPressure;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)] public double[] mTemperature;
        public double mWear;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)] public byte[] mTerrainName;
        public byte mSurfaceType, mFlat, mDetached, mStaticUndeflectedRadius;
        public double mVerticalTireDeflection, mWheelYLocation, mToe, mTireCarcassTemperature;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)] public double[] mTireInnerLayerTemperature;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 24)] public byte[] mExpansion;
    }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct rF2VehicleTelemetry {
        public int mID;
        public double mDeltaTime, mElapsedTime;
        public int mLapNumber;
        public double mLapStartET;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 64)] public byte[] mVehicleName;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 64)] public byte[] mTrackName;
        public rF2Vec3 mPos, mLocalVel, mLocalAccel;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)] public rF2Vec3[] mOri;
        public rF2Vec3 mLocalRot, mLocalRotAccel;
        public int mGear;
        public double mEngineRPM, mEngineWaterTemp, mEngineOilTemp, mClutchRPM;
        public double mUnfilteredThrottle, mUnfilteredBrake, mUnfilteredSteering, mUnfilteredClutch;
        public double mFilteredThrottle, mFilteredBrake, mFilteredSteering, mFilteredClutch;
        public double mSteeringShaftTorque, mFront3rdDeflection, mRear3rdDeflection;
        public double mFrontWingHeight, mFrontRideHeight, mRearRideHeight, mDrag, mFrontDownforce, mRearDownforce;
        public double mFuel, mEngineMaxRPM;
        public byte mScheduledStops, mOverheating, mDetached, mHeadlights;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 8)] public byte[] mDentSeverity;
        public double mLastImpactET, mLastImpactMagnitude;
        public rF2Vec3 mLastImpactPos;
        public double mEngineTorque;
        public int mCurrentSector;
        public byte mSpeedLimiter, mMaxGears, mFrontTireCompoundIndex, mRearTireCompoundIndex;
        public double mFuelCapacity;
        public byte mFrontFlapActivated, mRearFlapActivated, mRearFlapLegalStatus, mIgnitionStarter;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 18)] public byte[] mFrontTireCompoundName;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 18)] public byte[] mRearTireCompoundName;
        public byte mSpeedLimiterAvailable, mAntiStallActivated;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 2)] public byte[] mUnused;
        public float mVisualSteeringWheelRange;
        public double mRearBrakeBias, mTurboBoostPressure;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)] public float[] mPhysicsToGraphicsOffset;
        public float mPhysicalSteeringWheelRange;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 152)] public byte[] mExpansion;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)] public rF2Wheel[] mWheels;
    }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct rF2ScoringInfo {
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 64)] public byte[] mTrackName;
        public int mSession;
        public double mCurrentET, mEndET;
        public int mMaxLaps;
        public double mLapDist;
        public long pointer1;
        public int mNumVehicles;
        public byte mGamePhase;
        public sbyte mYellowFlagState;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)] public sbyte[] mSectorFlag;
        public byte mStartLight, mNumRedLights, mInRealtime;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)] public byte[] mPlayerName;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 64)] public byte[] mPlrFileName;
        public double mDarkCloud, mRaining, mAmbientTemp, mTrackTemp;
        public rF2Vec3 mWind;
        public double mMinPathWetness, mMaxPathWetness;
        public byte mGameMode, mIsPasswordProtected;
        public ushort mServerPort;
        public uint mServerPublicIP;
        public int mMaxPlayers;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)] public byte[] mServerName;
        public float mStartET;
        public double mAvgPathWetness;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 200)] public byte[] mExpansion;
        public long pointer2;
    }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct rF2VehicleScoring {
        public int mID;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)] public byte[] mDriverName;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 64)] public byte[] mVehicleName;
        public short mTotalLaps;
        public sbyte mSector, mFinishStatus;
        public double mLapDist, mPathLateral, mTrackEdge;
        public double mBestSector1, mBestSector2, mBestLapTime, mLastSector1, mLastSector2, mLastLapTime, mCurSector1, mCurSector2;
        public short mNumPitstops, mNumPenalties;
        public byte mIsPlayer;
        public sbyte mControl;
        public byte mInPits, mPlace;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)] public byte[] mVehicleClass;
        public double mTimeBehindNext;
        public int mLapsBehindNext;
        public double mTimeBehindLeader;
        public int mLapsBehindLeader;
        public int mPadding;
        public double mLapStartET;
        public rF2Vec3 mPos, mLocalVel, mLocalAccel;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)] public rF2Vec3[] mOri;
        public rF2Vec3 mLocalRot, mLocalRotAccel;
        public byte mHeadlights, mPitState, mServerScored, mIndividualPhase;
        public int mQualification;
        public double mTimeIntoLap, mEstimatedLapTime;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 24)] public byte[] mPitGroup;
        public byte mFlag, mUnderYellow, mCountLapFlag, mInGarageStall;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)] public byte[] mUpgradePack;
        public float mPitLapDist, mBestLapSector1, mBestLapSector2;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 48)] public byte[] mExpansion;
    }
}
"@
Add-Type -TypeDefinition $code

$O_Gear = [System.Runtime.InteropServices.Marshal]::OffsetOf([type][LMU.rF2VehicleTelemetry], "mGear").ToInt32()
$O_RPM  = [System.Runtime.InteropServices.Marshal]::OffsetOf([type][LMU.rF2VehicleTelemetry], "mEngineRPM").ToInt32()
$O_Thr  = [System.Runtime.InteropServices.Marshal]::OffsetOf([type][LMU.rF2VehicleTelemetry], "mFilteredThrottle").ToInt32()
$O_Brk  = [System.Runtime.InteropServices.Marshal]::OffsetOf([type][LMU.rF2VehicleTelemetry], "mFilteredBrake").ToInt32()
$T_VehSize = [System.Runtime.InteropServices.Marshal]::SizeOf([type][LMU.rF2VehicleTelemetry])
$O_IsPlayer = [System.Runtime.InteropServices.Marshal]::OffsetOf([type][LMU.rF2VehicleScoring], "mIsPlayer").ToInt32()
$O_DrvName  = [System.Runtime.InteropServices.Marshal]::OffsetOf([type][LMU.rF2VehicleScoring], "mDriverName").ToInt32()
$O_Pos = [System.Runtime.InteropServices.Marshal]::OffsetOf([type][LMU.rF2VehicleScoring], "mPos").ToInt32()
$S_VehSize  = [System.Runtime.InteropServices.Marshal]::SizeOf([type][LMU.rF2VehicleScoring])
$S_VehBase = 12 + [System.Runtime.InteropServices.Marshal]::SizeOf([type][LMU.rF2ScoringInfo])
$S_Size    = [System.Runtime.InteropServices.Marshal]::SizeOf([type][LMU.rF2ScoringInfo])

[Console]::WriteLine("SHMEM_DIAG|Offsets: Gear=$O_Gear, RPM=$O_RPM, IsPlr=$O_IsPlayer, SBase=$S_VehBase, SISize=$S_Size, VSize=$S_VehSize")

$TargetName = ($args -join " ").Trim()
if ($TargetName) { $TargetName = $TargetName.Replace(" ", "").ToUpper() }

[Console]::WriteLine("SHMEM_INIT|Searching for Target: $TargetName")

while ($true) {
    try {
        $fS = $null
        try { $fS = [System.IO.MemoryMappedFiles.MemoryMappedFile]::OpenExisting('Global\$rFactor2SMMP_Scoring$') } catch { }
        if (!$fS) { try { $fS = [System.IO.MemoryMappedFiles.MemoryMappedFile]::OpenExisting('$rFactor2SMMP_Scoring$') } catch { } }
        if (!$fS) { [System.Threading.Thread]::Sleep(1000); continue }
        
        $vS = $fS.CreateViewAccessor()
        $idx = -1; $name = "Unknown"
        
        # Get global player name from scoring header
        $gnb = [byte[]]::new(32); $vS.ReadArray(116, $gnb, 0, 32)
        $gname = [System.Text.Encoding]::ASCII.GetString($gnb).Trim().Replace(" ", "").Replace("\0", "")
        
        $posStr = ""
        for ($i = 0; $i -lt 128; $i++) {
            $sb = $S_VehBase + ($i * $S_VehSize)
            $nb = [byte[]]::new(32); $vS.ReadArray($sb + $O_DrvName, $nb, 0, 32)
            $vname = [System.Text.Encoding]::ASCII.GetString($nb).Trim().Replace(" ", "").Replace("\0", "").ToUpper()
            
            if ($vname) {
                $px = [math]::Round($vS.ReadDouble($sb + $O_Pos), 2)
                $pz = [math]::Round($vS.ReadDouble($sb + $O_Pos + 16), 2)
                $posStr += "$vname:$px,$pz|"
                
                $isTarget = ($TargetName -and $vname -eq $TargetName)
                $isMe = ($vS.ReadByte($sb + $O_IsPlayer) -ne 0)

                if ($isTarget -or $isMe) {
                    $idx = $i
                    $name = $vname
                }
            }
        }
        
        if ($idx -ge 0) {
            $fT = $null
            try { $fT = [System.IO.MemoryMappedFiles.MemoryMappedFile]::OpenExisting('Global\$rFactor2SMMP_Telemetry$') } catch { }
            if (!$fT) { try { $fT = [System.IO.MemoryMappedFiles.MemoryMappedFile]::OpenExisting('$rFactor2SMMP_Telemetry$') } catch { } }
            if ($fT) {
                $vT = $fT.CreateViewAccessor()
                $tb = 16 + ($idx * $T_VehSize)
                $g = $vT.ReadInt32($tb + $O_Gear)
                $r = [int]$vT.ReadDouble($tb + $O_RPM)
                $t = [math]::Round($vT.ReadDouble($tb + $O_Thr), 4)
                $k = [math]::Round($vT.ReadDouble($tb + $O_Brk), 4)
                [Console]::WriteLine("$name|$g,$r,$t,$k")
                $vT.Dispose(); $fT.Dispose()
            }
        }
        if ($posStr) { [Console]::WriteLine("POS|$posStr") }
        $vS.Dispose(); $fS.Dispose()
        [System.Threading.Thread]::Sleep(16)
    } catch { 
        [System.Threading.Thread]::Sleep(100)
    }
}`.trim();

let lmuPlayerTelemetry = null;  // {gear, rpm, throttle, brake} for local player
let lmuPlayerName     = null;  // driver name read from shared memory scoring section

function startLmuSharedMemory() {
    if (lmuShmProc) return;
    try {
        // We use python to read the native LMU_Data mapped file instead of legacy powershell
        lmuShmProc = spawn('python', [path.join(electronPath, 'lmu_telemetry.py')]);
        
        lmuShmProc.stdout.on('data', (data) => {
            const str = data.toString();
            const lines = str.split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.type === 'telemetry' && parsed.data) {
                        for (const v of parsed.data) {
                            const safeName = String(v.name).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                            const existing = lmuVehicleStateMap.get(safeName) || {};
                            
                            lmuVehicleStateMap.set(safeName, { 
                                ...existing, 
                                virtualEnergy: v.energy, 
                                fuelFraction: v.fuel,
                                gear: v.gear,
                                rpm: v.rpm,
                                maxRpm: v.maxRpm,
                                throttle: v.throttle,
                                brake: v.brake,
                                mgukState: v.mgukState,
                                wheels: v.wheels
                            });
                            
                            // Send fast updates for the local player directly!
                            if (v.isPlayer && mainWindow) {
                                lmuPlayerName = safeName;
                                const payload = { 
                                    driverName: safeName, 
                                    gear: v.gear, 
                                    rpm: v.rpm, 
                                    maxRpm: v.maxRpm,
                                    throttle: v.throttle, 
                                    brake: v.brake,
                                    mgukState: v.mgukState,
                                    wheels: v.wheels 
                                };
                                mainWindow.webContents.send('lmu-local-telemetry', payload);
                                if (global.broadcastToSse) global.broadcastToSse('lmu-local-telemetry', payload);
                            }
                        }
                    }
                } catch(e) {}
            }
        });
        
        lmuShmProc.on('exit', () => { lmuShmProc = null; });
    } catch (e) {
        console.warn('[LMU] Shared memory reader failed to start:', e.message);
    }
}



function stopLmuSharedMemory(preserveName = false) {
    if (lmuShmProc) { try { lmuShmProc.kill(); } catch {} lmuShmProc = null; }
    if (lmuEnergyProc) { try { lmuEnergyProc.kill(); } catch {} lmuEnergyProc = null; }
    lmuPlayerTelemetry = null;
    if (!preserveName) lmuPlayerName = null;
}

function lmuRestGet(lmuPath) {
    return new Promise((resolve) => {
        const req = http.get({ hostname: 'localhost', port: 6397, path: lmuPath, timeout: 2000 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

function lmuRestPost(lmuPath, body) {
    return new Promise((resolve) => {
        const bodyStr = JSON.stringify(body || {});
        const req = http.request({
            hostname: 'localhost', port: 6397, path: lmuPath, method: 'POST', timeout: 2000,
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
    // Speed from carVelocity.velocity (m/s) → km/h
    const velocityMs = v.carVelocity?.velocity ?? v.speed ?? v.Speed ?? 0;
    const speedKmh = Math.round(Math.abs(velocityMs) * 3.6);

    // bestLapTime / lastLapTime: LMU sends -1 when no lap done
    const best = (v.bestLapTime > 0) ? v.bestLapTime : 0;
    const last = (v.lastLapTime > 0) ? v.lastLapTime : 0;

    const driverName = v.driverName || v.DriverName || v.name || 'Unknown';
    // isPlayer flag in LMU standings is often 0 — also match by name read from shared memory
    const isPlayer   = !!(v.focus ?? v.hasFocus ?? v.isPlayer ?? false)
                    || (!!lmuPlayerName && driverName.replace(/\s+/g, '') === lmuPlayerName);

    // Priority for gear/rpm/throttle/brake:
    //   1. Shared memory (lmuPlayerTelemetry) — only for the local player, real-time
    //   2. REST endpoint poll (lmuVehicleStateMap) — if any endpoint returned data
    //   3. WebSocket standings fields — usually absent, fallback to 0
    const pm = (isPlayer && lmuPlayerTelemetry) ? lmuPlayerTelemetry : null;
    const safeDriverName = String(driverName).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const rs = lmuVehicleStateMap.get(safeDriverName) || lmuVehicleStateMap.get(driverName) || {};

    return {
        driverName,
        car:         v.vehicleName || v.vehicle || v.car || '',
        carClass:    v.carClass || v.vehicleClass || '',
        livery:      v.liveryName || '',
        speedKmh,
        rpm:         pm?.rpm      ?? rs.rpm      ?? Math.round(v.rpm ?? v.engineRpm ?? 0),
        maxRpm:      pm?.maxRpm   ?? rs.maxRpm   ?? v.maxRpm  ?? 8500,
        gear:        pm?.gear     ?? rs.gear     ?? v.gear    ?? 0,
        throttle:    pm?.throttle ?? rs.throttle ?? v.throttle ?? 0,
        brake:       pm?.brake    ?? rs.brake    ?? v.brake    ?? 0,
        mgukState:   pm?.mgukState ?? rs.mgukState ?? v.mgukState ?? 0,
        wheels:      pm?.wheels   ?? rs.wheels   ?? v.wheels   ?? null,
        lap:         v.lapsCompleted ?? v.lap ?? v.laps ?? 0,
        lastLapTime: last,
        bestLapTime: best,
        // Sector times — LMU/rF2 REST + WebSocket use many naming conventions;
        // S3 is usually absent and must be derived from total − S1 − S2.
        // LMU sends -1 for invalid times, so we treat anything ≤ 0 as missing.
        ...(() => {
            const pos = (x) => (x != null && x > 0 ? x : 0);
            
            const bS1 = pos(v.bestLapS1 ?? v.bestLapSectorTime1 ?? v.bestSectorTime1 ?? v.bestSector1 ?? v.bestSector1Time ?? v.sBestSector1 ?? v.mBestSector1 ?? v.sector1Best ?? v.best_sector1);
            const rawBS2 = pos(v.bestLapS2 ?? v.bestLapSectorTime2 ?? v.bestSectorTime2 ?? v.bestSector2 ?? v.bestSector2Time ?? v.sBestSector2 ?? v.mBestSector2 ?? v.sector2Best ?? v.best_sector2);
            // In LMU/rF2, Sector 2 is usually sent as a cumulative split time from the start line.
            const bS2 = (rawBS2 > bS1 && bS1 > 0) ? (rawBS2 - bS1) : rawBS2;
            
            const rawBS3 = pos(v.bestLapS3 ?? v.bestLapSectorTime3 ?? v.bestSectorTime3 ?? v.bestSector3 ?? v.bestSector3Time ?? v.sBestSector3 ?? v.mBestSector3 ?? v.sector3Best ?? v.best_sector3);
            const bS3 = rawBS3 > 0 ? rawBS3 : (best > 0 && rawBS2 > 0) ? Math.max(0, best - rawBS2) : 0;

            const lS1 = pos(v.lastLapS1 ?? v.lastSectorTime1 ?? v.currentSectorTime1 ?? v.lastSector1 ?? v.lastSector1Time ?? v.sLastSector1 ?? v.mLastSector1 ?? v.curSector1 ?? v.mCurSector1 ?? v.sector1Time ?? v.split1);
            const rawLS2 = pos(v.lastLapS2 ?? v.lastSectorTime2 ?? v.currentSectorTime2 ?? v.lastSector2 ?? v.lastSector2Time ?? v.sLastSector2 ?? v.mLastSector2 ?? v.curSector2 ?? v.mCurSector2 ?? v.sector2Time ?? v.split2);
            const lS2 = (rawLS2 > lS1 && lS1 > 0) ? (rawLS2 - lS1) : rawLS2;
            
            const rawLS3 = pos(v.lastLapS3 ?? v.lastSectorTime3 ?? v.currentSectorTime3 ?? v.lastSector3 ?? v.lastSector3Time ?? v.sLastSector3 ?? v.mLastSector3 ?? v.sector3Time ?? v.split3);
            const lS3 = rawLS3 > 0 ? rawLS3 : (last > 0 && rawLS2 > 0) ? Math.max(0, last - rawLS2) : 0;

            return { bestLapS1: bS1, bestLapS2: bS2, bestLapS3: bS3, lastLapS1: lS1, lastLapS2: lS2, lastLapS3: lS3 };
        })(),
        place:       v.position ?? v.place ?? 0,
        inPits:      !!(v.pitting ?? v.inPits ?? false),
        worldPosX:   rs.worldPosX ?? v.worldPosX ?? v.x ?? v.posX ?? v.worldPositionX ?? 0,
        worldPosZ:   rs.worldPosZ ?? v.worldPosZ ?? v.z ?? v.posZ ?? v.worldPositionZ ?? 0,
        virtualEnergy: rs.virtualEnergy,
        fuelFraction: rs.fuelFraction,
        lapDistance: v.lapDistance ?? 0,
        category:    v.category ?? v.carClass ?? v.class ?? '',
        isPlayer,
    };
}

function buildLmuPayload(rawVehicles, sessionRaw) {
    if (!rawVehicles || rawVehicles.length === 0) return null;
    const s = sessionRaw || {};
    return {
        session: {
            track:       s.track || s.trackName || s.TrackName || s.name || s.sTrackName || s.trackLayout || '',
            sessionName: s.sessionName ?? s.session ?? s.Session ?? s.mSession ?? '',
            type:        s.sessionType ?? s.type ?? s.Type ?? s.mSession ?? -1,
            numVehicles: rawVehicles.length,
        },
        vehicles: rawVehicles.map(normalizeVehicle),
    };
}

function processWsMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Log every unique message type so we can discover available data channels
    const msgType = msg?.type ?? (Array.isArray(msg) ? 'array' : 'unknown');
    if (!lmuSeenMsgTypes.has(msgType)) {
        lmuSeenMsgTypes.add(msgType);
        console.log('[LMU WS] New message type:', msgType, '| keys:', Object.keys(msg || {}).join(', '));
        if (msgType !== 'standings') {
            console.log('[LMU WS] Sample:', JSON.stringify(msg).slice(0, 600));
        }
    }

    if (!lmuLogOnce && (msgType === 'standings' || msgType === 'array')) {
        lmuLogOnce = true;
        const firstVehicle = msg?.body?.[0] || (Array.isArray(msg) ? msg[0] : null);
        if (firstVehicle) {
            console.log('[LMU WS] First vehicle FULL:', JSON.stringify(firstVehicle, null, 2));
            const sKeys = Object.keys(firstVehicle).filter(k => /sector|split|s1|s2|s3/i.test(k));
            console.log('[LMU WS] Sector-related keys:', sKeys.length ? sKeys.join(', ') : '(none — sectors unavailable from this endpoint)');
            sKeys.forEach(k => console.log(`  [sector] ${k}:`, firstVehicle[k]));
        }
    }

    let vehicles = [];
    let session  = null;

    if (Array.isArray(msg)) {
        vehicles = msg;
    } else if (msg?.type === 'standings' && Array.isArray(msg.body)) {
        // Primary LMU WebSocket format: {type: "standings", body: [...]}
        vehicles = msg.body;
        session  = lmuLastSession;
    } else if (msg.type === 'sessionInfo' && msg.body) {
        if (msg.body.playerName) {
            const normPlr = String(msg.body.playerName).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const normCurr = String(lmuPlayerName || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (normPlr !== normCurr) {
                console.log(`[LMU WS] Player name detected/changed: ${msg.body.playerName} (parsed: ${normPlr})`);
                lmuPlayerName = normPlr;
                stopLmuSharedMemory(true);
                startLmuSharedMemory();
            }
        }
        lmuLastSession = msg.body || msg.data || msg;
        return; // no vehicles to render
    } else if (msg && Array.isArray(msg.body)) {
        vehicles = msg.body;
        session  = lmuLastSession;
    } else if (msg && Array.isArray(msg.vehicles)) {
        vehicles = msg.vehicles;
        session  = msg.session || msg.sessionInfo || lmuLastSession;
    } else if (msg && Array.isArray(msg.entries)) {
        vehicles = msg.entries;
    } else if (msg && msg.drivers && typeof msg.drivers === 'object') {
        vehicles = Object.values(msg.drivers);
        session  = msg.session || lmuLastSession;
    } else if (msg && msg.type && msg.data) {
        const d = msg.data;
        vehicles = Array.isArray(d) ? d : (d && typeof d === 'object' ? [d] : []);
    }

    const payload = buildLmuPayload(vehicles, session);
    if (mainWindow) mainWindow.webContents.send('lmu-update', payload);
    if (global.broadcastToSse) global.broadcastToSse('lmu-update', payload);
}

// ---------------------------------------------------------
// REST poll for real-time vehicle state (gear, rpm, throttle, brake, pitting)
// These fields are NOT in the WebSocket "standings" message — they come from
// a separate vehicle-state endpoint that returns live telemetry per car.
// ---------------------------------------------------------
const LMU_VEHICLE_STATE_ENDPOINTS = [
    '/rest/sessions/vehicledata',
    '/rest/watch/vehicledata',
    '/rest/vehicle/vehicledata',
];
let vehicleStateEndpoint = null; // discovered at runtime

async function discoverAndPollVehicleState() {
    // Discover which endpoint works (run once, then keep using it)
    if (!vehicleStateEndpoint) {
        for (const ep of LMU_VEHICLE_STATE_ENDPOINTS) {
            const data = await lmuRestGet(ep);
            if (data !== null) {
                vehicleStateEndpoint = ep;
                console.log('[LMU REST] Vehicle state endpoint found:', ep, '| sample:', JSON.stringify(data).slice(0, 300));
                break;
            }
        }
        if (!vehicleStateEndpoint) return; // none work — skip
    }

    const data = await lmuRestGet(vehicleStateEndpoint);
    if (!data) return;

    const vehicles = Array.isArray(data) ? data
        : (data.vehicles ? data.vehicles : (data.body ? data.body : []));

    for (const v of vehicles) {
        const name = v.driverName || v.name || v.DriverName;
        if (!name) continue;
        const safeName = String(name).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const existing = lmuVehicleStateMap.get(safeName) || {};
        lmuVehicleStateMap.set(safeName, {
            ...existing,
            gear:     v.gear     ?? v.mGear     ?? 0,
            rpm:      Math.round(v.rpm ?? v.engineRpm ?? v.mEngineRPM ?? 0),
            throttle: v.throttle ?? v.mThrottle ?? 0,
            brake:    v.brake    ?? v.mBrake    ?? 0,
            inPits:   !!(v.pitting ?? v.inPits ?? v.mInPits ?? false),
        });
    }
}

function startLmuVehicleStatePoll() {
    if (lmuVehicleStatePoll) return;
    lmuVehicleStatePoll = setInterval(discoverAndPollVehicleState, 500);
}

function stopLmuVehicleStatePoll() {
    clearInterval(lmuVehicleStatePoll);
    lmuVehicleStatePoll = null;
    lmuVehicleStateMap.clear();
    vehicleStateEndpoint = null;
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
        if (Array.isArray(allVehicles) && allVehicles.length > 0) {
            rawVehicles = allVehicles;
        } else if (teams && teams.drivers && typeof teams.drivers === 'object') {
            rawVehicles = Object.values(teams.drivers);
        } else if (teams && teams.teams && typeof teams.teams === 'object') {
            rawVehicles = Object.values(teams.teams).flatMap(t =>
                t.drivers ? Object.values(t.drivers) : [t]
            );
        }

        const payload = buildLmuPayload(rawVehicles, null);
        if (mainWindow) mainWindow.webContents.send('lmu-update', payload);
    }, 1000);
}

function connectLmuWs() {
    if (lmuWs) return;
    clearTimeout(lmuReconnectTimer);

    const wsUrl = 'ws://localhost:6398/websocket/controlpanel';
    console.log('[LMU] Connecting WebSocket:', wsUrl);
    lmuLogOnce = false;

    try {
        lmuWs = new WebSocket(wsUrl);
    } catch (e) {
        console.error('[LMU] WS failed:', e.message);
        lmuWs = null;
        startLmuRestFallback();
        return;
    }

    lmuWs.onopen  = () => { console.log('[LMU] WebSocket open'); startLmuVehicleStatePoll(); startLmuSharedMemory(); };
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
    lmuLastSession  = null;
    lmuSeenMsgTypes.clear();
    stopLmuVehicleStatePoll();
    stopLmuSharedMemory();
    if (lmuWs) {
        lmuWs.onclose = null;
        lmuWs.close();
        lmuWs = null;
    }
}

ipcMain.handle('start-lmu-polling', () => connectLmuWs());
ipcMain.handle('stop-lmu-polling',  () => disconnectLmu());

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
