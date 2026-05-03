import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, set, onValue, off } from 'firebase/database';
import { rtdb, auth } from '../firebase/config';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SESSION_TYPES = { 0: 'PRUEBA', 1: 'PRÁCTICA', 2: 'CLASIFICACIÓN', 3: 'CARRERA', 4: 'WARMUP' };

function fmtTime(s) {
    if (!s || s <= 0) return '--:--.---';
    const m = Math.floor(s / 60);
    const rem = (s % 60).toFixed(3).padStart(6, '0');
    return `${m}:${rem}`;
}

function GearBadge({ gear }) {
    const label = gear === -1 ? 'R' : gear === 0 ? 'N' : String(gear);
    return (
        <div className="w-8 h-8 rounded border border-wec-cyan/30 bg-wec-cyan/5 flex items-center justify-center">
            <span className="text-wec-display text-sm font-bold text-wec-cyan">{label}</span>
        </div>
    );
}

function Bar({ value, color = 'bg-wec-cyan' }) {
    return (
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all duration-100`} style={{ width: `${Math.min(100, value * 100)}%` }} />
        </div>
    );
}

// ─── Pilot card (compact row) ─────────────────────────────────────────────────

function PilotRow({ pilot, selected, onClick, isOnline }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
                ${selected
                    ? 'bg-wec-blue/10 border-wec-blue/40'
                    : 'bg-white/[0.01] border-white/5 hover:border-white/10'}`}
        >
            {/* Status dot */}
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-wec-green animate-pulse' : 'bg-white/20'}`} />

            {/* Name + car */}
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">{pilot.driverName}</div>
                <div className="text-[8px] text-white/30 truncate">{pilot.car || '—'}</div>
            </div>

            {/* Speed */}
            <div className="shrink-0 text-right">
                <div className="text-wec-display text-xs font-bold text-wec-cyan">{pilot.speedKmh ?? '—'}</div>
                <div className="text-wec-display text-[7px] text-white/20">km/h</div>
            </div>

            {/* Gear */}
            <GearBadge gear={pilot.gear ?? 0} />
        </button>
    );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function PilotDetail({ pilot }) {
    if (!pilot) return (
        <div className="flex items-center justify-center h-full text-white/20 text-[10px] uppercase tracking-widest">
            Selecciona un piloto
        </div>
    );

    return (
        <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
            {/* Header */}
            <div>
                <div className="text-wec-display text-[8px] text-wec-cyan/50 font-bold uppercase tracking-[0.4em] mb-1">Piloto activo</div>
                <div className="text-base font-bold text-white uppercase tracking-wider">{pilot.driverName}</div>
                <div className="text-[10px] text-white/40">{pilot.car}</div>
            </div>

            {/* Speed + RPM */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                    <div className="text-wec-display text-[7px] text-white/30 uppercase tracking-widest mb-1">Velocidad</div>
                    <div className="text-2xl font-bold text-wec-cyan tabular-nums">{pilot.speedKmh ?? 0}</div>
                    <div className="text-wec-display text-[7px] text-white/30">km/h</div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                    <div className="text-wec-display text-[7px] text-white/30 uppercase tracking-widest mb-1">RPM</div>
                    <div className="text-2xl font-bold text-wec-gold tabular-nums">{(pilot.rpm ?? 0).toLocaleString()}</div>
                    <div className="text-wec-display text-[7px] text-white/30">rev/min</div>
                </div>
            </div>

            {/* Gear */}
            <div className="flex items-center gap-3">
                <div className="text-wec-display text-[8px] text-white/30 uppercase tracking-widest w-14">Marcha</div>
                <div className="w-12 h-12 rounded-lg border border-wec-cyan/30 bg-wec-cyan/5 flex items-center justify-center">
                    <span className="text-2xl font-bold text-wec-cyan">
                        {pilot.gear === -1 ? 'R' : pilot.gear === 0 ? 'N' : pilot.gear ?? '—'}
                    </span>
                </div>
                <div className={`ml-auto text-[9px] font-bold px-2 py-1 rounded border ${pilot.inPits ? 'text-wec-gold border-wec-gold/30 bg-wec-gold/5' : 'text-wec-green border-wec-green/30 bg-wec-green/5'}`}>
                    {pilot.inPits ? 'BOXES' : 'EN PISTA'}
                </div>
            </div>

            {/* Throttle / Brake */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-wec-display text-[7px] text-wec-green/70 uppercase tracking-wider w-12">Gas</span>
                    <div className="flex-1"><Bar value={pilot.throttle ?? 0} color="bg-wec-green" /></div>
                    <span className="text-wec-display text-[8px] text-white/40 tabular-nums w-8 text-right">{Math.round((pilot.throttle ?? 0) * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-wec-display text-[7px] text-red-400/70 uppercase tracking-wider w-12">Freno</span>
                    <div className="flex-1"><Bar value={pilot.brake ?? 0} color="bg-red-500" /></div>
                    <span className="text-wec-display text-[8px] text-white/40 tabular-nums w-8 text-right">{Math.round((pilot.brake ?? 0) * 100)}%</span>
                </div>
            </div>

            {/* Lap times */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                    <div className="text-wec-display text-[7px] text-white/30 uppercase tracking-widest mb-1">Última vuelta</div>
                    <div className="text-sm font-bold text-white tabular-nums font-mono">{fmtTime(pilot.lastLapTime)}</div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                    <div className="text-wec-display text-[7px] text-white/30 uppercase tracking-widest mb-1">Mejor vuelta</div>
                    <div className="text-sm font-bold text-wec-cyan tabular-nums font-mono">{fmtTime(pilot.bestLapTime)}</div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="text-wec-display text-[7px] text-white/30 uppercase tracking-widest">Vuelta</div>
                <div className="text-sm font-bold text-white">{pilot.lap ?? 0}</div>
                {pilot.place > 0 && (
                    <>
                        <div className="w-px h-3 bg-white/10 mx-1" />
                        <div className="text-wec-display text-[7px] text-white/30 uppercase tracking-widest">Posición</div>
                        <div className="text-sm font-bold text-wec-gold">P{pilot.place}</div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

const LiveTelemetry = () => {
    const user = auth.currentUser;
    const [tab, setTab] = useState('session');          // 'session' | 'team'
    const [sessionData, setSessionData] = useState(null); // local LMU data
    const [teamData, setTeamData] = useState({});        // RTDB pilots map
    const [selectedPilot, setSelectedPilot] = useState(null);
    const [lmuOnline, setLmuOnline] = useState(false);
    const rtdbUnsub = useRef(null);

    // ── Publish own data to RTDB when in session ──────────────────────────────
    const publishSelf = useCallback((vehicles) => {
        if (!user || !vehicles) return;
        const self = vehicles.find(v =>
            v.driverName && v.driverName !== 'Unknown' && vehicles.indexOf(v) === 0
        ) || vehicles[0];
        if (!self) return;

        set(ref(rtdb, `live_sessions/${user.uid}`), {
            online: true,
            driverName: self.driverName,
            car: self.car,
            speedKmh: self.speedKmh,
            rpm: self.rpm,
            gear: self.gear,
            throttle: self.throttle,
            brake: self.brake,
            lap: self.lap,
            lastLapTime: self.lastLapTime,
            bestLapTime: self.bestLapTime,
            place: self.place,
            inPits: self.inPits,
            updatedAt: Date.now(),
        }).catch(() => {});
    }, [user]);

    // ── Start LMU polling ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!window.electronAPI) return;

        window.electronAPI.startLmuPolling();
        window.electronAPI.onLmuUpdate((data) => {
            if (data && data.vehicles && data.vehicles.length > 0) {
                setSessionData(data);
                setLmuOnline(true);
                publishSelf(data.vehicles);
            } else {
                setLmuOnline(false);
                // Mark self as offline in RTDB
                if (user) {
                    set(ref(rtdb, `live_sessions/${user.uid}/online`), false).catch(() => {});
                }
            }
        });

        return () => {
            window.electronAPI.stopLmuPolling();
            window.electronAPI.offLmuUpdate();
            if (user) {
                set(ref(rtdb, `live_sessions/${user.uid}/online`), false).catch(() => {});
            }
        };
    }, [publishSelf, user]);

    // ── Subscribe to team RTDB ────────────────────────────────────────────────
    useEffect(() => {
        const sessionsRef = ref(rtdb, 'live_sessions');
        const unsub = onValue(sessionsRef, (snapshot) => {
            const val = snapshot.val() || {};
            setTeamData(val);
        });
        rtdbUnsub.current = () => off(sessionsRef, 'value', unsub);
        return () => rtdbUnsub.current?.();
    }, []);

    // ── Pilots lists ──────────────────────────────────────────────────────────
    const sessionPilots = sessionData?.vehicles ?? [];
    const teamPilots = Object.entries(teamData)
        .map(([uid, data]) => ({ uid, ...data }))
        .filter(p => p.online);

    const activePilots = tab === 'session' ? sessionPilots : teamPilots;

    const handleSelectPilot = (p) => {
        setSelectedPilot(prev => prev?.driverName === p.driverName ? null : p);
    };

    return (
        <div className="flex h-full w-full overflow-hidden">

            {/* ── LEFT PANEL: list ─────────────────────────────────── */}
            <div className="w-72 shrink-0 flex flex-col border-r border-wec-border h-full">

                {/* Session status bar */}
                <div className="px-4 py-3 border-b border-wec-border flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${lmuOnline ? 'bg-wec-green animate-pulse' : 'bg-white/20'}`} />
                    <span className="text-wec-display text-[8px] font-bold tracking-widest text-white/50 uppercase">
                        {lmuOnline ? 'LMU conectado' : 'LMU offline'}
                    </span>
                    {sessionData?.session?.track && (
                        <span className="ml-auto text-wec-display text-[7px] text-wec-cyan/60 truncate max-w-[120px]">
                            {sessionData.session.track}
                        </span>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-wec-border">
                    {[
                        { id: 'session', label: `Sesión (${sessionPilots.length})` },
                        { id: 'team',    label: `Equipo (${teamPilots.length})` },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex-1 py-2.5 text-wec-display text-[8px] font-bold uppercase tracking-wider transition-all
                                ${tab === t.id
                                    ? 'text-wec-cyan border-b-2 border-wec-cyan -mb-px'
                                    : 'text-white/30 hover:text-white/50'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Pilot list */}
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                    {activePilots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                            <div className="w-8 h-8 rounded border border-white/5 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <span className="text-wec-display text-[8px] text-white/20 uppercase tracking-widest">
                                {tab === 'session'
                                    ? lmuOnline ? 'Sin pilotos en pista' : 'Inicia una sesión en LMU'
                                    : 'Ningún compañero online'}
                            </span>
                        </div>
                    ) : (
                        activePilots.map((p, i) => (
                            <PilotRow
                                key={p.driverName || p.uid || i}
                                pilot={p}
                                selected={selectedPilot?.driverName === p.driverName}
                                isOnline={tab === 'team' ? p.online : lmuOnline}
                                onClick={() => handleSelectPilot(p)}
                            />
                        ))
                    )}
                </div>

                {/* Session info footer */}
                {sessionData?.session && lmuOnline && (
                    <div className="px-4 py-2 border-t border-wec-border flex items-center gap-3">
                        <span className="text-wec-display text-[7px] text-white/20 uppercase tracking-wider">
                            {SESSION_TYPES[sessionData.session.type] ?? 'SESIÓN'}
                        </span>
                        <span className="ml-auto text-wec-display text-[7px] text-white/20">
                            {sessionData.session.numVehicles} coches
                        </span>
                    </div>
                )}
            </div>

            {/* ── RIGHT PANEL: detail ──────────────────────────────── */}
            <div className="flex-1 overflow-hidden">
                <PilotDetail pilot={selectedPilot} />
            </div>
        </div>
    );
};

export default LiveTelemetry;
