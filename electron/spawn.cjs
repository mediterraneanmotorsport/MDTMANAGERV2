// Clears VS Code's ELECTRON_RUN_AS_NODE before spawning the real Electron binary.
// Without this, VS Code's environment variable causes electron.exe to run as
// plain Node.js, breaking all Electron APIs (app, BrowserWindow, etc.).
const { spawn } = require('child_process');
const electronPath = require('electron'); // npm package correctly returns binary path

const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;

const proc = spawn(electronPath, ['.'], { env, stdio: 'inherit', windowsHide: false });
proc.on('close', code => process.exit(code ?? 0));
