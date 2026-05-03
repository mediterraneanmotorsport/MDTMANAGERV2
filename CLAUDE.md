# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MDT Setup Manager v2 is a desktop application for Le Mans Ultimate racing sim management. It handles car setup distribution, local file installation, live telemetry tracking, and AI-powered setup recommendations. Built as an Electron app with a React frontend and Firebase backend.

## Commands

```bash
npm run dev          # Vite dev server (port 5173) + Electron with DevTools
npm run build        # Vite production build → /dist
npm run lint         # ESLint validation
npm run dist         # Full production build + Windows NSIS installer → /dist-electron
npm run mobile:sync  # Build + sync to Capacitor iOS/Android projects
npm run mobile:open-android  # Open Android project in Android Studio
```

No test suite is configured.

## Architecture

### Process Model (Electron)

Two separate processes communicate via IPC:

- **Renderer process**: React app in [src/](src/) — runs in a BrowserWindow, accesses Electron APIs only through the preload bridge
- **Main process**: [electron/main.cjs](electron/main.cjs) — handles all file system operations, game path detection, telemetry watching, and auto-updates
- **Preload bridge**: [electron/preload.cjs](electron/preload.cjs) — exposes `window.electronAPI` with 14 namespaced functions to the renderer; this is the only way renderer → main communication happens

When adding new Electron functionality: add an `ipcMain.handle()` in `main.cjs`, expose it via `contextBridge.exposeInMainWorld()` in `preload.cjs`, then call `window.electronAPI.yourMethod()` from React.

### React App Structure

[src/App.jsx](src/App.jsx) owns auth state and top-level routing. [src/components/Dashboard.jsx](src/components/Dashboard.jsx) is the main shell — it manages the sidebar navigation and renders the active view. All major features are sibling components under `Dashboard`.

Key components:
- `SetupList.jsx` — setup download/delete UI; calls `window.electronAPI.downloadSetup()` which writes `.svm` files to the game directory
- `SetupTweaker.jsx` — AI recommendations UI (MDT IA feature)
- `Leaderboard.jsx` — real-time lap times; populated by telemetry IPC events
- `AdminPanel.jsx` — role-gated admin tools (requires Firebase `admin` or `Pilot_Plus` role)

### Firebase Collections

All cloud data lives in Firestore (project: `race-calendar-31795`):
- `circuits` — track venues and layouts
- `cars` — vehicle models by category
- `setups` — car setups per circuit (metadata; actual `.svm` in Firebase Storage)
- `setup_comments` — community feedback per setup
- `race_events` — upcoming race calendar
- `install_requests` — remote install queue (admin → pilot)
- `users` — auth profiles, favorites, roles

Firebase config is in [src/firebase/config.js](src/firebase/config.js). Firestore is initialized with `experimentalForceLongPolling: true` for Electron compatibility (WebSocket transport doesn't work in Electron).

### File System Layout (Game Directory)

The game path is auto-detected via Steam registry or manually selected. Setups install to:
```
{GamePath}/UserData/player/Settings/{circuit}/{car}/{setup.svm}
```
Telemetry XML files are watched at:
```
{GamePath}/UserData/Log/Results/
```

The telemetry watcher (`start-telemetry-watcher` IPC) uses `fs.watch()` on the Results directory. New `.xml` files trigger parsing and a `telemetry-update` IPC push to the renderer. MDT version tracking uses `.mdt_manifest.json` in the same directory as each setup.

### Mobile (Capacitor)

The same React build deploys to iOS/Android via Capacitor 8. The `capacitor.config.json` points `webDir` to `dist`. Mobile clients do not have `window.electronAPI` — components that use it must guard with `if (window.electronAPI)`.

### Auto-Updater

`electron-updater` publishes to and fetches from GitHub Releases (repo: `mediterraneanmotorsport/MDTMANAGERV2`). Update logic is in `main.cjs`; the UI is in `UpdateNotification.jsx`.

## Tech Stack

- **React 19** + **Vite 7** (Babel-based Fast Refresh, no TypeScript)
- **Electron 40** + **electron-builder 26** (Windows NSIS target)
- **Firebase 12** (Auth, Firestore, Storage)
- **Tailwind CSS 4** — custom theme colors: `wec-black`, `wec-cyan`, `wec-blue`
- **Capacitor 8** for mobile
- **ESLint 9** (flat config in `eslint.config.js`)
