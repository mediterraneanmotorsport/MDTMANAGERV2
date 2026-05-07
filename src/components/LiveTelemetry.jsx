import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ref, set, onValue, off } from 'firebase/database';
import { rtdb, auth } from '../firebase/config';
import { QRCodeSVG } from 'qrcode.react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SESSION_TYPES = { 
    0: 'PRUEBA', 1: 'PRÁCTICA', 2: 'CLASIFICACIÓN', 3: 'CARRERA', 4: 'WARMUP',
    '-1': 'SESIÓN'
};

function fmtTime(s) {
    if (!s || s <= 0) return '--:--.---';
    const m = Math.floor(s / 60);
    const rem = (s % 60).toFixed(3).padStart(6, '0');
    return `${m}:${rem}`;
}

// ─── Car / Category helpers ───────────────────────────────────────────────────
// LMU vehicleName uses underscores (Porsche_963_GTP) — normalise before matching
const normCar = (raw = '') => raw.toLowerCase().replace(/[_\-]/g, ' ');

const getCarLogo = (v = {}) => {
    const s = normCar(`${v.car || ''} ${v.carClass || ''} ${v.vehicleName || ''}`);

    if (s.includes('ferrari'))                                                      return 'assets/logos/cars/Ferrari.png';
    if (s.includes('porsche'))                                                      return 'assets/logos/cars/Porsche.png';
    if (s.includes('toyota'))                                                       return 'assets/logos/cars/Toyota.png';
    if (s.includes('cadillac'))                                                     return 'assets/logos/cars/Cadillac.png';
    if (s.includes('bmw'))                                                          return 'assets/logos/cars/BMW.png';
    if (s.includes('peugeot'))                                                      return 'assets/logos/cars/Peugeot.png';
    if (s.includes('alpine'))                                                       return 'assets/logos/cars/Alpine.png';
    if (s.includes('lamborghini'))                                                  return 'assets/logos/cars/Lamborghini.png';
    if (s.includes('isotta') || s.includes('fraschini'))                            return 'assets/logos/cars/Isotta Fraschini.png';
    if (s.includes('vanwall') || s.includes('vandervell'))                          return 'assets/logos/cars/Vanwall.png';
    if (s.includes('glickenhaus'))                                                  return 'assets/logos/cars/Glickenhaus.png';
    if (s.includes('aston'))                                                        return 'assets/logos/cars/Aston Martin.png';
    if (s.includes('corvette'))                                                     return 'assets/logos/cars/Corvette.png';
    if (s.includes('ford'))                                                         return 'assets/logos/cars/Ford.png';
    if (s.includes('mclaren'))                                                      return 'assets/logos/cars/McLaren.png';
    if (s.includes('mercedes') || s.includes('amg'))                                return 'assets/logos/cars/Mercedes-AMG.png';
    if (s.includes('lexus'))                                                        return 'assets/logos/cars/Lexus.png';
    if (s.includes('genesis'))                                                      return 'assets/logos/cars/Genesis.png';
    if (s.includes('ginetta'))                                                      return 'assets/logos/cars/Ginetta.png';
    if (s.includes('oreca'))                                                        return 'assets/logos/cars/Oreca.png';
    if (s.includes('ligier'))                                                       return 'assets/logos/cars/Ligier.png';
    if (s.includes('duqueine'))                                                     return 'assets/logos/cars/Duqueine.png';
    if (s.includes('dallara'))                                                      return 'assets/logos/cars/Default.png';

    return 'assets/logos/cars/Default.png';
};

// Category detection from vehicleName string.
// ORDER MATTERS: LMP3 before LMP2 (Ligier/Duqueine make both).
//                GT3/GTE before Hypercar (SC63/Huracan are Lamborghini but different classes).
const getCarCategory = (carName = '') => {
    const u = normCar(carName).toUpperCase();

    // ── Prototype classes — explicit class tag wins ──
    if (u.includes('LMP3'))                                         return 'LMP3';
    if (u.includes('LMP2'))                                         return 'LMP2';

    // ── GT classes ──
    if (u.includes('LMGT3') || u.includes('GT3'))                  return 'GT3';
    if (u.includes('GTE') || u.includes('GT-E'))                   return 'GTE';

    // ── Hypercar — class tag first, then specific model names ──
    if (u.includes('LMH') || u.includes('LMDH') || u.includes('HYPERCAR')) return 'HYPERCAR';

    // Hypercar models that don't carry LMH/LMDh in the filename
    if (u.includes('499P'))                                         return 'HYPERCAR'; // Ferrari 499P
    if (u.includes('963'))                                          return 'HYPERCAR'; // Porsche 963
    if (u.includes('GR010'))                                        return 'HYPERCAR'; // Toyota GR010
    if (u.includes('9X8'))                                          return 'HYPERCAR'; // Peugeot 9X8
    if (u.includes('A424'))                                         return 'HYPERCAR'; // Alpine A424
    if (u.includes('SC63'))                                         return 'HYPERCAR'; // Lamborghini SC63
    if (u.includes('V SERIES') || u.includes('VSERIES'))           return 'HYPERCAR'; // Cadillac V-Series
    if (u.includes('M HYBRID') || u.includes('MHYBRID'))           return 'HYPERCAR'; // BMW M Hybrid
    if (u.includes('GTP'))                                          return 'HYPERCAR'; // clase GTP = Hypercar
    if (u.includes('GLICKENHAUS') || u.includes('007LMH'))         return 'HYPERCAR';
    if (u.includes('ISOTTA') || u.includes('FRASCHINI'))           return 'HYPERCAR';
    if (u.includes('VANWALL') || u.includes('VANDERVELL'))         return 'HYPERCAR';
    if (u.includes('GENESIS'))                                      return 'HYPERCAR';

    // ── Prototype manufacturer fallback (only if no class tag found above) ──
    if (u.includes('ORECA'))                                        return 'LMP2';
    if (u.includes('JSP217'))                                       return 'LMP2';  // Ligier LMP2
    if (u.includes('JSP3') || u.includes('JSP320'))                return 'LMP3';  // Ligier LMP3
    if (u.includes('GINETTA'))                                      return 'LMP3';
    if (u.includes('DUQUEINE') || u.includes('M30'))               return 'LMP3';
    if (u.includes('LIGIER'))                                       return 'LMP2';  // unknown Ligier → assume LMP2

    return null;
};

// Category logo from a car model string OR a category name string (both work)
const getCategoryLogo = (carName = '') => {
    const cat = getCarCategory(carName);
    if (cat === 'HYPERCAR') return 'assets/logos/categories/HY.png';
    if (cat === 'LMP2')     return 'assets/logos/categories/LMP2.png';
    if (cat === 'LMP3')     return 'assets/logos/categories/LMP3.jpg';
    if (cat === 'GT3')      return 'assets/logos/categories/GT3.png';
    if (cat === 'GTE')      return 'assets/logos/categories/GTE.png';
    return null;
};

// Vehicle-object helpers — always combine carClass (sent directly by LMU) + car (vehicleName)
// LMU sends carClass: "LMP2", "Hypercar", "LMGT3", etc. which is more reliable than parsing vehicleName
const vehicleCat = (v = {}) => getCarCategory(`${v.carClass || ''} ${v.car || ''}`);
const catLogo    = (v = {}) => getCategoryLogo(`${v.carClass || ''} ${v.car || ''}`);

const getEnergyColor = (pct) => {
    if (pct == null) return 'text-white/20';
    const interpolate = (c1, c2, factor) => {
        const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
        const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
        const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
        return `rgb(${r}, ${g}, ${b})`;
    };
    const red = [255, 26, 26];
    const gold = [227, 184, 63];
    const green = [0, 255, 157];
    
    if (pct >= 65) return interpolate(gold, green, (pct - 65) / 35);
    if (pct >= 25) return interpolate(red, gold, (pct - 25) / 40);
    return interpolate([130, 0, 0], red, pct / 25);
};

function GearBadge({ gear, size = "sm" }) {
    const label = gear === -1 ? 'R' : gear === 0 ? 'N' : String(gear);
    const sizeClasses = size === "lg" ? "w-16 h-16 text-4xl" : "w-10 h-10 text-base";
    return (
        <div className={`${sizeClasses} rounded-lg border-2 border-wec-cyan/40 bg-wec-cyan/5 flex items-center justify-center shadow-[0_0_15px_rgba(0,144,255,0.15)]`}>
            <span className="text-wec-display font-black text-wec-cyan">{label}</span>
        </div>
    );
}

function Bar({ value, color = 'bg-wec-cyan', label = "" }) {
    return (
        <div className="flex flex-col gap-1 w-full">
            {label && <div className="flex justify-between items-center px-1">
                <span className="text-wec-display text-[7px] text-white/30 uppercase tracking-widest">{label}</span>
                <span className="text-wec-display text-[8px] text-white/60 tabular-nums">{Math.round(value * 100)}%</span>
            </div>}
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                <div 
                    className={`h-full ${color} rounded-full transition-all duration-75 ease-out shadow-[0_0_8px_currentColor]`} 
                    style={{ width: `${Math.min(100, value * 100)}%` }} 
                />
            </div>
        </div>
    );
}

// ─── Pilot card ───────────────────────────────────────────────────────────────

function PilotRow({ pilot, selected, onClick, isOnline }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-300 text-left group
                ${selected
                    ? 'bg-wec-blue/15 border-wec-blue/40 shadow-[0_0_20px_rgba(0,144,255,0.1)]'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'}`}
        >
            <div className="relative shrink-0">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-wec-green animate-pulse' : 'bg-white/20'}`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-white uppercase truncate group-hover:text-wec-cyan transition-colors">{pilot.driverName}</div>
                <div className="flex items-center gap-2 mt-0.5">
                    <img src={getCarLogo(pilot)} className="w-3 h-3 object-contain opacity-60" />
                    <span className="text-[8px] text-white/40 truncate italic">{pilot.car || '—'}</span>
                </div>
            </div>
            <div className="shrink-0 flex items-center gap-3">
                {pilot.fuelFraction != null && (
                    <div className="text-right border-r border-white/10 pr-3">
                        <div className="text-wec-display text-xs font-bold leading-none" style={{ color: getEnergyColor(pilot.fuelFraction) }}>
                            {Math.round(pilot.fuelFraction)}%
                        </div>
                        <div className="text-[7px] text-white/20 uppercase tracking-tighter">NRG</div>
                    </div>
                )}
                <div className="text-right">
                    <div className="text-wec-display text-xs font-bold text-wec-cyan leading-none">{pilot.speedKmh ?? 0}</div>
                    <div className="text-[7px] text-white/20 uppercase tracking-tighter">km/h</div>
                </div>
            </div>
        </button>
    );
}



// ─── Pilot Detail (DASHBOARD) ─────────────────────────────────────────────────

function PilotDetail({ pilot, timingMode = 'gap_leader', focusMode, setFocusMode }) {
    const [sectorMode, setSectorMode] = useState('best');

    const vehicles = pilot?.allVehicles || [];

    // Grouping DYNAMICALLY by whatever category the game sends
    const categories = useMemo(() => {
        const groups = {};
        vehicles.forEach(v => {
            const cat = vehicleCat(v) || 'OTRO';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(v);
        });
        Object.keys(groups).forEach(k => groups[k].sort((a,b) => (a.place || 99) - (b.place || 99)));
        
        // Sort the group keys by official category order
        const catOrder = { 'HY': 1, 'LMP2': 2, 'LMP3': 3, 'GTE': 4, 'LMGT3': 5, 'OTRO': 99 };
        const sortedGroups = {};
        Object.keys(groups)
            .sort((a, b) => (catOrder[a] || 99) - (catOrder[b] || 99))
            .forEach(k => sortedGroups[k] = groups[k]);
            
        return sortedGroups;
    }, [vehicles]);

    if (!pilot) return (
        <div className="flex flex-col items-center justify-center h-full text-white/10 opacity-40">
            <div className="text-wec-display text-[10px] uppercase tracking-[0.5em] font-bold italic">Selecciona un piloto</div>
        </div>
    );

    const renderTable = (catName, list) => {
        const bestOf = (vals) => { const p = vals.filter(x => x > 0); return p.length ? Math.min(...p) : 0; };
        const bs1 = bestOf(list.map(r => r.bestLapS1 || 0));
        const bs2 = bestOf(list.map(r => r.bestLapS2 || 0));
        const bs3 = bestOf(list.map(r => r.bestLapS3 || 0));

        const sColor = (v, b) => {
            if (v <= 0) return 'text-white/20';
            if (b <= 0) return 'text-white/60';
            const d = v - b;
            if (d < 0.001) return 'text-purple-400';
            if (d < 0.3)   return 'text-emerald-400';
            if (d < 1.0)   return 'text-yellow-300';
            return 'text-white/40';
        };

        return (
            <div key={catName} className="space-y-4 pt-4">
                <div className="flex items-center gap-4 border-b border-white/10 pb-2">
                    {getCategoryLogo(catName) && <img src={getCategoryLogo(catName)} className="h-6 object-contain" />}
                    <span className="text-wec-display text-sm font-black italic uppercase tracking-widest">{catName} STANDINGS</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead className="bg-white/5 text-[10px] text-white/50 uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-4 py-4 w-14 text-center">Pos</th>
                                <th className="px-4 py-4">Piloto | Coche</th>
                                <th className="px-2 py-4 w-16 text-center" title="Sector 1">S1</th>
                                <th className="px-2 py-4 w-16 text-center" title="Sector 2">S2</th>
                                <th className="px-2 py-4 w-16 text-center" title="Sector 3">S3</th>
                                <th className="px-4 py-4 w-24 text-center">Última</th>
                                <th className="px-4 py-4 w-24 text-center">Mejor</th>
                                <th className={`px-4 py-4 w-24 text-center ${timingMode === 'gap_leader' ? 'text-white/80' : 'text-white/30'}`}>Gap Líder</th>
                                <th className={`px-4 py-4 w-24 text-center ${timingMode === 'gap_ahead' ? 'text-orange-400' : 'text-white/30'}`}>Intervalo</th>
                                <th className="px-4 py-4 w-16 text-center" title="Energía Virtual (%)">NRG</th>
                                <th className="px-4 py-4 w-20 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {list.map((v, i) => {
                                const leaderTime = list[0]?.bestLapTime || 0;
                                const prev = list[i - 1];

                                // Gap al líder de clase
                                const gapLeader = i === 0 ? 'LÍDER'
                                    : (v.bestLapTime > 0 && leaderTime > 0)
                                        ? `+${(v.bestLapTime - leaderTime).toFixed(3)}s`
                                        : '--';

                                // Intervalo al coche de delante (modo relativo)
                                const interval = i === 0 ? '—'
                                    : (v.bestLapTime > 0 && prev?.bestLapTime > 0)
                                        ? `+${(v.bestLapTime - prev.bestLapTime).toFixed(3)}s`
                                        : '--';

                                // Color del intervalo: rojo si >1s, naranja si <1s, verde si <0.3s
                                const intervalDelta = i > 0 && v.bestLapTime > 0 && prev?.bestLapTime > 0
                                    ? v.bestLapTime - prev.bestLapTime : null;
                                const intervalColor = intervalDelta === null ? 'text-white/20'
                                    : intervalDelta < 0.3 ? 'text-emerald-400'
                                    : intervalDelta < 1.0 ? 'text-orange-400'
                                    : 'text-red-400';

                                const isSelected = v.driverName === pilot.driverName;
                                const s1 = sectorMode === 'best' ? v.bestLapS1 : v.lastLapS1;
                                const s2 = sectorMode === 'best' ? v.bestLapS2 : v.lastLapS2;
                                const s3 = sectorMode === 'best' ? v.bestLapS3 : v.lastLapS3;

                                return (
                                    <tr key={v.driverName} className={`text-[12px] ${isSelected ? 'bg-wec-blue/15' : 'hover:bg-white/[0.03] transition-colors'}`}>
                                        <td className="px-4 py-3 text-center">
                                            <div className="font-mono font-black text-wec-gold text-sm leading-none">P{i + 1}</div>
                                            {v.place && v.place !== i + 1 && (
                                                <div className="text-[8px] text-white/25 font-mono mt-0.5">#{v.place}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 bg-black/40 rounded flex items-center justify-center p-1 shrink-0">
                                                    <img src={getCarLogo(v)} className="w-full h-full object-contain" />
                                                </div>
                                                <div className="flex items-baseline gap-2 overflow-hidden">
                                                    <span className="font-bold text-white uppercase tracking-tight truncate">{v.driverName}</span>
                                                    <span className="text-white/20 font-black italic">|</span>
                                                    <span className="text-[10px] text-wec-cyan font-bold italic uppercase truncate">{v.car}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`px-2 py-3 font-mono text-center text-[11px] font-bold ${sColor(s1 || v.bestLapS1, bs1)}`}>{(s1 || v.bestLapS1) > 0 ? (s1 || v.bestLapS1).toFixed(3) : '--'}</td>
                                        <td className={`px-2 py-3 font-mono text-center text-[11px] font-bold ${sColor(s2 || v.bestLapS2, bs2)}`}>{(s2 || v.bestLapS2) > 0 ? (s2 || v.bestLapS2).toFixed(3) : '--'}</td>
                                        <td className={`px-2 py-3 font-mono text-center text-[11px] font-bold ${sColor(s3 || v.bestLapS3, bs3)}`}>{(s3 || v.bestLapS3) > 0 ? (s3 || v.bestLapS3).toFixed(3) : '--'}</td>
                                        <td className="px-4 py-3 font-mono text-center text-white/80">{fmtTime(v.lastLapTime)}</td>
                                        <td className="px-4 py-3 font-mono text-center text-wec-cyan font-bold">{fmtTime(v.bestLapTime)}</td>
                                        <td className={`px-4 py-3 font-mono text-center ${timingMode === 'gap_leader' ? 'text-white/60' : 'text-white/20'}`}>{gapLeader}</td>
                                        <td className={`px-4 py-3 font-mono text-center font-bold ${timingMode === 'gap_ahead' ? intervalColor : 'text-white/20'}`}>{interval}</td>
                                        <td 
                                            className="px-4 py-3 font-mono text-center font-bold" 
                                            style={{ color: v.fuelFraction != null ? getEnergyColor(v.fuelFraction) : undefined }}
                                        >
                                            {v.fuelFraction != null ? `${Math.round(v.fuelFraction)}%` : '--'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${v.inPits ? 'bg-wec-gold/20 text-wec-gold' : 'bg-wec-green/20 text-wec-green'}`}>
                                                {v.inPits ? 'PITS' : 'TRACK'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-wec-void/30">
            {/* Header */}
            {!focusMode && (
            <div className="p-4 md:p-6 border-b border-white/5 bg-gradient-to-r from-wec-blue/10 to-transparent shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="flex gap-4 md:gap-6 w-full md:w-auto">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-white/5 rounded-2xl flex items-center justify-center p-3 border border-white/10 shadow-xl shrink-0">
                            <img src={getCarLogo(pilot)} className="w-full h-full object-contain" />
                        </div>
                        <div className="space-y-1 overflow-hidden">
                            <div className="flex items-center gap-3">
                                {catLogo(pilot) && <img src={catLogo(pilot)} className="h-4 object-contain" />}
                                <span className="text-wec-display text-[9px] text-wec-cyan font-bold tracking-[0.4em] uppercase truncate">Live Telemetry</span>
                            </div>
                            <h2 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tight leading-none truncate">
                                {pilot.driverName} <span className="text-wec-cyan/40 px-1 md:px-2 italic">|</span> <span className="text-lg md:text-3xl">{pilot.car}</span>
                            </h2>
                            <div className="text-[9px] md:text-[11px] font-bold text-white/40 uppercase tracking-widest truncate">{pilot.carClass || 'Competition Vehicle'}</div>
                        </div>
                    </div>
                    <div className="flex gap-4 items-start w-full md:w-auto justify-between md:justify-end">
                        <div className="flex flex-col gap-2 items-start md:items-end">
                            <div className="text-[8px] text-white/30 uppercase tracking-widest">Sectores</div>
                            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 gap-px">
                                {[{ id: 'best', label: 'Mejor' }, { id: 'last', label: 'Actual' }].map(m => (
                                    <button key={m.id} onClick={() => setSectorMode(m.id)}
                                        className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-wide transition-all ${
                                            sectorMode === m.id
                                                ? 'bg-purple-600 text-white shadow'
                                                : 'text-white/30 hover:text-white/60'
                                        }`}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center min-w-[100px]">
                            <div className="text-[8px] text-white/30 uppercase mb-1">Posición</div>
                            <div className="text-3xl font-black text-wec-gold italic">P{pilot.place || '--'}</div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            <div className="flex-1 overflow-y-auto wec-scrollbar p-4 md:p-6 space-y-4 md:space-y-8">
                {/* Real-time metrics */}
                {!focusMode && (
                <div className="bg-wec-glass border border-white/5 rounded-2xl p-6 flex flex-col relative shadow-2xl overflow-hidden shrink-0">
                    <div className="flex justify-between items-start z-10 mb-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Speed</span>
                            <div className="flex items-baseline gap-1 md:gap-2">
                                <span className="text-4xl md:text-6xl font-black text-white tabular-nums leading-none tracking-tighter">{pilot.speedKmh ?? 0}</span>
                                <span className="text-xs md:text-sm text-wec-cyan font-black uppercase italic">KPH</span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-center px-4 md:px-10 border-x border-white/5">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Gear</span>
                            <span className="text-4xl md:text-6xl font-black text-wec-gold leading-none drop-shadow-[0_0_15px_rgba(255,180,0,0.4)]">
                                {pilot.gear > 0 ? pilot.gear : (pilot.gear === -1 ? 'R' : 'N')}
                            </span>
                        </div>
                        
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Engine</span>
                            <div className="flex items-baseline gap-1 md:gap-2">
                                <span className="text-3xl md:text-5xl font-black text-white/80 tabular-nums leading-none tracking-tighter">{(pilot.rpm ?? 0).toLocaleString()}</span>
                                <span className="text-xs md:text-sm text-white/30 font-black uppercase italic">RPM</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* RPM LEDs Bar */}
                    <div className="flex gap-[3px] w-full h-5 bg-black/60 p-[3px] rounded-lg border border-white/5 z-10">
                        {Array.from({ length: 15 }).map((_, i) => {
                            const rpmRaw = pilot.rpm || 0;
                            const maxRpm = pilot.maxRpm || 8500;
                            const pct = Math.max(0, Math.min(1, rpmRaw / maxRpm));
                            const activeLeds = Math.round(pct * 15);
                            let colorClass = 'bg-white/5';
                            
                            if (i < activeLeds) {
                                if (i < 7) colorClass = 'bg-wec-green shadow-[0_0_8px_rgba(0,255,0,0.4)]';
                                else if (i < 12) colorClass = 'bg-wec-gold shadow-[0_0_8px_rgba(255,200,0,0.4)]';
                                else colorClass = 'bg-wec-red shadow-[0_0_10px_rgba(255,0,0,0.6)]';
                            }
                            
                            if (pct >= 0.96 && i < activeLeds) {
                                colorClass += ' animate-pulse shadow-[0_0_15px_rgba(255,0,0,1)]';
                            }
                            
                            return <div key={i} className={`flex-1 h-full rounded-sm ${colorClass} transition-colors duration-75`} />;
                        })}
                    </div>
                    
                    {/* Advanced Live Telemetry Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 z-10">
                        {/* Pedals */}
                        <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest text-center">Pedales</span>
                            <div className="flex gap-6 h-24 justify-center items-end">
                                {/* Throttle */}
                                <div className="w-10 h-full bg-white/5 rounded-t-md border-b-4 border-wec-green overflow-hidden flex flex-col justify-end relative shadow-[0_4px_15px_rgba(0,255,157,0.1)]">
                                    <div className="w-full bg-wec-green/80 transition-all duration-75" style={{ height: `${(pilot.throttle || 0) * 100}%` }} />
                                    <div className="absolute inset-0 flex items-center justify-center mix-blend-difference pointer-events-none">
                                        <span className="text-[9px] font-black text-white opacity-50 rotate-[-90deg]">THR</span>
                                    </div>
                                </div>
                                {/* Brake */}
                                <div className="w-10 h-full bg-white/5 rounded-t-md border-b-4 border-wec-red overflow-hidden flex flex-col justify-end relative shadow-[0_4px_15px_rgba(255,26,26,0.1)]">
                                    <div className="w-full bg-wec-red/80 transition-all duration-75" style={{ height: `${(pilot.brake || 0) * 100}%` }} />
                                    <div className="absolute inset-0 flex items-center justify-center mix-blend-difference pointer-events-none">
                                        <span className="text-[9px] font-black text-white opacity-50 rotate-[-90deg]">BRK</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tires */}
                        <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col gap-2 items-center">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Neumáticos</span>
                            {pilot.wheels && pilot.wheels.length === 4 ? (
                                <div className="grid grid-cols-2 gap-x-12 gap-y-3 mt-1">
                                    {[0, 1, 2, 3].map((i) => {
                                        const w = pilot.wheels[i];
                                        const avgTemp = (w.temp[0] + w.temp[1] + w.temp[2]) / 3;
                                        let tColor = 'text-white/80';
                                        let borderColor = 'border-white/20';
                                        if (avgTemp < 70) { tColor = 'text-blue-400'; borderColor = 'border-blue-400/50'; }
                                        else if (avgTemp > 105) { tColor = 'text-wec-red'; borderColor = 'border-wec-red/50'; }
                                        else { tColor = 'text-wec-green'; borderColor = 'border-wec-green/50'; }
                                        
                                        const wearPct = w.wear * 100; // in LMU wear is 0-1 (fraction of max wear) but typically 1.0 means 100% rubber, 0 means worn out, let's assume 1.0 is healthy. wait, it's wear so 0 is new, 1 is dead? Actually rF2 wear is thickness, so usually 100% -> 0%. We will show 100-wear if it's 0-1 wear damage, or just w.wear if it's thickness. We'll use 100% filled = good.
                                        // Let's assume wear=0.0 is new, 1.0 is worn.
                                        const remainingPct = Math.max(0, 100 - (w.wear * 100));
                                        
                                        return (
                                            <div key={i} className="flex flex-col items-center">
                                                <div className={`text-[10px] font-black ${tColor}`}>{Math.round(avgTemp)}°C</div>
                                                <div className={`w-6 h-9 border-[1.5px] ${borderColor} rounded-sm mt-1 overflow-hidden relative bg-black/60`}>
                                                    <div className="absolute bottom-0 w-full bg-white/80 transition-all duration-300" style={{ height: `${remainingPct}%` }} />
                                                </div>
                                                <div className="text-[8px] font-bold text-white/40 mt-1">{Math.round(remainingPct)}%</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-white/20 text-xs italic">Telemetría no disp.</div>
                            )}
                        </div>

                        {/* Energy / MGU-K */}
                        <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col justify-center">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest text-center mb-4">Energía & MGU-K</span>
                            <div className="space-y-5">
                                <div className="flex flex-col gap-1.5 px-2">
                                    <div className="flex justify-between text-[10px] uppercase font-black">
                                        <span className="text-white/40">NRG / Batería</span>
                                        <span style={{ color: getEnergyColor(pilot.fuelFraction) }}>{pilot.fuelFraction != null ? `${Math.round(pilot.fuelFraction)}%` : '--'}</span>
                                    </div>
                                    <div className="h-2 w-full bg-black/80 rounded-full overflow-hidden border border-white/5">
                                        <div className="h-full transition-all shadow-[0_0_8px_currentColor]" style={{ width: `${pilot.fuelFraction || 0}%`, backgroundColor: getEnergyColor(pilot.fuelFraction) }} />
                                    </div>
                                </div>
                                
                                {pilot.mgukState !== undefined && (
                                    <div className="flex flex-col items-center pt-2">
                                        {pilot.mgukState === 2 && <span className="px-4 py-1.5 bg-wec-gold/20 text-wec-gold border border-wec-gold/40 rounded-md text-[9px] font-black uppercase tracking-widest animate-pulse shadow-[0_0_15px_rgba(255,180,0,0.2)]">⚡ MGU-K Deploy</span>}
                                        {pilot.mgukState === 3 && <span className="px-4 py-1.5 bg-wec-green/20 text-wec-green border border-wec-green/40 rounded-md text-[9px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(0,255,157,0.2)]">🔋 MGU-K Regen</span>}
                                        {(pilot.mgukState === 0 || pilot.mgukState === 1) && <span className="px-4 py-1.5 bg-white/5 text-white/30 border border-white/10 rounded-md text-[9px] font-black uppercase tracking-widest">MGU-K Inactivo</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Background decoration */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(0,144,255,0.05)_0%,transparent_60%)] pointer-events-none" />
                </div>
                )}

                <div className="space-y-8">
                    {/* Render all detected categories, sorted so HY is usually first if it exists */}
                    {(() => {
                        const ORDER = ['HYPERCAR', 'LMP2', 'LMP3', 'GTE', 'GT3', 'OTRO'];
                        return Object.keys(categories)
                            .sort((a, b) => {
                                const ia = ORDER.indexOf(a);
                                const ib = ORDER.indexOf(b);
                                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                            })
                            .map(cat => renderTable(cat, categories[cat]));
                    })()}
                </div>
            </div>
        </div>
    );
}

// ─── Track Map ────────────────────────────────────────────────────────────────

const TrackMap = ({ vehicles, transparent = false }) => {
    const canvasRef = useRef(null);
    const [bounds, setBounds] = useState({ minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9 });
    const pathRef = useRef([]);

    useEffect(() => {
        if (!vehicles || vehicles.length === 0) return;
        let { minX, maxX, minZ, maxZ } = bounds;
        let changed = false;
        vehicles.forEach(v => {
            if (v.worldPosX === 0 && v.worldPosZ === 0) return;
            if (v.worldPosX < minX) { minX = v.worldPosX; changed = true; }
            if (v.worldPosX > maxX) { maxX = v.worldPosX; changed = true; }
            if (v.worldPosZ < minZ) { minZ = v.worldPosZ; changed = true; }
            if (v.worldPosZ > maxZ) { maxZ = v.worldPosZ; changed = true; }
            if (v.isPlayer && Math.abs(v.speedKmh) > 10) {
                const last = pathRef.current[pathRef.current.length - 1];
                if (!last || Math.hypot(v.worldPosX - last.x, v.worldPosZ - last.z) > 10) {
                    pathRef.current.push({ x: v.worldPosX, z: v.worldPosZ });
                    if (pathRef.current.length > 5000) pathRef.current.shift();
                }
            }
        });
        if (changed) setBounds({ minX, maxX, minZ, maxZ });
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const w = canvasRef.current.width;
        const h = canvasRef.current.height;
        ctx.clearRect(0, 0, w, h);
        const margin = 20;
        const scaleX = (x) => ((x - minX) / (maxX - minX || 1)) * (w - margin * 2) + margin;
        const scaleZ = (z) => (1 - (z - minZ) / (maxZ - minZ || 1)) * (h - margin * 2) + margin;
        if (pathRef.current.length > 2) {
            ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5;
            ctx.moveTo(scaleX(pathRef.current[0].x), scaleZ(pathRef.current[0].z));
            pathRef.current.forEach(p => ctx.lineTo(scaleX(p.x), scaleZ(p.z))); ctx.stroke();
        }
        vehicles.forEach(v => {
            if (v.worldPosX === 0 && v.worldPosZ === 0) return;
            ctx.beginPath(); ctx.arc(scaleX(v.worldPosX), scaleZ(v.worldPosZ), v.isPlayer ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = v.isPlayer ? '#00ccff' : (vehicleCat(v) === 'GT3' ? '#ff6b00' : '#ffffff');
            ctx.fill();
        });
    }, [vehicles, bounds]);

    return transparent ? (
        <canvas ref={canvasRef} width={600} height={600} className="w-full h-full object-contain" />
    ) : (
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
            <div className="text-[7px] font-black italic text-white/20 uppercase tracking-widest mb-1 px-1 text-center">Live Track Radar</div>
            <canvas ref={canvasRef} width={280} height={200} className="w-full h-auto" />
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const LiveTelemetry = () => {
    const user = auth.currentUser;
    const [tab, setTab] = useState('session');
    const [timeMode, setTimeMode] = useState('gap_leader');
    const [classFilter, setClassFilter] = useState('ALL');
    const [showSettings, setShowSettings] = useState(false);
    const [sessionData, setSessionData] = useState(null);
    const [teamData, setTeamData] = useState({});
    const [selectedPilot, setSelectedPilot] = useState(null);
    const [fastPlayerData, setFastPlayerData] = useState(null);
    const [lmuOnline, setLmuOnline] = useState(false);
    const [localUrl, setLocalUrl] = useState('');
    const [showQR, setShowQR] = useState(false);
    
    const isMobileLive = new URLSearchParams(window.location.search).get('mobile') === '1';
    const [focusMode, setFocusMode] = useState(isMobileLive);

    const lastFastUpdate = useRef(0);
    const lastWsUpdate = useRef(0);

    const publishSelf = useCallback((data) => {
        if (!user || !data?.vehicles) return;
        const self = data.vehicles.find(v => v.isPlayer) || data.vehicles[0];
        if (!self) return;
        set(ref(rtdb, `live_sessions/${user.uid}`), {
            online: true, driverName: self.driverName, car: self.car, carClass: self.carClass, speedKmh: self.speedKmh, rpm: self.rpm, gear: self.gear,
            throttle: self.throttle, brake: self.brake, lap: self.lap, lastLapTime: self.lastLapTime, bestLapTime: self.bestLapTime,
            worldPosX: self.worldPosX, worldPosZ: self.worldPosZ, lapDistance: self.lapDistance, place: self.place, inPits: self.inPits,
            category: self.category, track: data.session?.track || '', updatedAt: Date.now(),
        }).catch(() => {});
    }, [user]);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            const online = (now - lastFastUpdate.current < 4000) || (now - lastWsUpdate.current < 4000);
            setLmuOnline(online);
            if (!online && user) set(ref(rtdb, `live_sessions/${user.uid}/online`), false).catch(() => {});
        }, 1000);
        return () => clearInterval(timer);
    }, [user]);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.startLmuPolling();
            window.electronAPI.onLmuUpdate(data => {
                if (data?.vehicles?.length > 0) {
                    lastWsUpdate.current = Date.now();
                    setSessionData(data);
                    publishSelf(data);
                }
            });
            window.electronAPI.onLmuLocalTelemetry(fastData => {
                lastFastUpdate.current = Date.now();
                setFastPlayerData(fastData);
            });
            return () => {
                window.electronAPI.stopLmuPolling();
                window.electronAPI.offLmuUpdate();
                window.electronAPI.offLmuLocalTelemetry();
            };
        } else {
            // Mobile Fallback: Connect to SSE
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('mobile') === '1') {
                const sseUrl = `${window.location.protocol}//${window.location.hostname}:8888/api/stream`;
                const source = new EventSource(sseUrl);
                source.onmessage = (e) => {
                    try {
                        const { channel, data } = JSON.parse(e.data);
                        if (channel === 'lmu-update' && data?.vehicles?.length > 0) {
                            lastWsUpdate.current = Date.now();
                            setSessionData(data);
                        } else if (channel === 'lmu-local-telemetry') {
                            lastFastUpdate.current = Date.now();
                            setFastPlayerData(data);
                        }
                    } catch (err) {}
                };
                return () => source.close();
            }
        }
    }, [publishSelf]);

    useEffect(() => {
        const sessionsRef = ref(rtdb, 'live_sessions');
        const unsub = onValue(sessionsRef, snapshot => setTeamData(snapshot.val() || {}));
        return () => off(sessionsRef, 'value', unsub);
    }, []);

    useEffect(() => {
        if (window.electronAPI?.getLocalUrl) {
            window.electronAPI.getLocalUrl().then(url => {
                if (url) setLocalUrl(url);
            }).catch(() => {});
        }
    }, []);

    const sessionPilots = useMemo(() => {
        const all = sessionData?.vehicles ?? [];
        if (tab === 'team') return Object.entries(teamData).map(([uid, d]) => ({ uid, ...d })).filter(p => p.online);
        const myName = (fastPlayerData?.driverName || user?.displayName || '').replace(/\s+/g, '').toUpperCase();
        return all.filter(p => {
            const normalizedP = (p.driverName || '').replace(/\s+/g, '').toUpperCase();
            const isLocal = p.isPlayer || (myName.length > 0 && normalizedP === myName);
            const isMDT = Object.values(teamData).some(tp => (tp.driverName || '').replace(/\s+/g, '').toUpperCase() === normalizedP);
            return isLocal || isMDT;
        }).sort((a, b) => {
            const catOrder = { 'HY': 1, 'LMP2': 2, 'LMP3': 3, 'GTE': 4, 'LMGT3': 5, 'OTRO': 99 };
            const catA = vehicleCat(a) || 'OTRO';
            const catB = vehicleCat(b) || 'OTRO';
            if (catOrder[catA] !== catOrder[catB]) {
                return (catOrder[catA] || 99) - (catOrder[catB] || 99);
            }
            return (a.place || 999) - (b.place || 999);
        });
    }, [sessionData, teamData, tab, fastPlayerData, user]);

    const activePilot = useMemo(() => {
        if (selectedPilot) {
            const found = sessionData?.vehicles?.find(v => v.driverName === selectedPilot.driverName);
            if (found) {
                if (found.isPlayer && fastPlayerData) return { ...found, ...fastPlayerData };
                return { ...found, allVehicles: sessionData?.vehicles || [] };
            }
            return { ...selectedPilot, allVehicles: sessionData?.vehicles || [] };
        }
        const me = sessionData?.vehicles?.find(v => v.isPlayer) || sessionData?.vehicles?.[0];
        if (me) {
            const finalMe = (me.isPlayer && fastPlayerData) ? { ...me, ...fastPlayerData } : me;
            return { ...finalMe, allVehicles: sessionData?.vehicles || [] };
        }
        return null;
    }, [selectedPilot, sessionData, fastPlayerData]);

    return (
        <div className="flex h-full w-full overflow-hidden bg-black text-white font-sans">
            <div className="flex-1 flex flex-col h-full overflow-hidden">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="h-12 md:h-14 px-3 md:px-5 border-b border-white/5 flex items-center gap-3 bg-black/80 backdrop-blur-xl z-50 shrink-0">

                    {/* Left: brand + status dot */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden lg:block text-wec-display text-[10px] font-black italic text-wec-cyan tracking-tighter">MDT LIVE</span>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${lmuOnline ? 'bg-wec-green animate-pulse' : 'bg-white/10'}`} />
                    </div>

                    {/* Center: timing toggle */}
                    <div className="flex-1 flex justify-center">
                        <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 gap-px">
                            {[
                                { id: 'gap_leader', short: 'Gap', full: 'Gap Líder' },
                                { id: 'gap_ahead',  short: 'Rel', full: 'Relativo'  },
                                { id: 'absolute',   short: 'Abs', full: 'Absoluto'  },
                            ].map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setTimeMode(m.id)}
                                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                        timeMode === m.id
                                            ? m.id === 'gap_ahead'
                                                ? 'bg-orange-500/80 text-white shadow-lg'
                                                : 'bg-wec-blue text-white shadow-lg'
                                            : 'text-white/30 hover:text-white/60'
                                    }`}
                                >
                                    <span className="hidden sm:inline">{m.full}</span>
                                    <span className="sm:hidden">{m.short}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: QR + mobile sidebar toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                        {localUrl && (
                            <button
                                onClick={() => setShowQR(true)}
                                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 px-2 sm:px-3 py-2 rounded-xl transition-all"
                            >
                                <svg className="w-4 h-4 text-wec-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                                <span className="hidden sm:inline text-[9px] font-black uppercase tracking-wider">Mobile</span>
                            </button>
                        )}
                        {/* Mobile sidebar toggle — only visible on small screens */}
                        <button
                            onClick={() => setFocusMode(f => !f)}
                            className="md:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white transition-all"
                            title={focusMode ? 'Mostrar pilotos' : 'Ocultar pilotos'}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d={focusMode
                                        ? "M4 6h16M4 12h16M4 18h16"
                                        : "M6 18L18 6M6 6l12 12"} />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* ── Body ──────────────────────────────────────────────── */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

                    {/* Sidebar — animated collapse on both axes */}
                    <div className={`
                        transition-all duration-300 ease-in-out
                        overflow-hidden shrink-0 flex flex-col
                        bg-black/40 w-full md:h-full
                        ${focusMode
                            ? 'max-h-0 md:max-h-none md:w-0'
                            : 'max-h-56 md:max-h-none md:w-64 lg:w-80 border-b md:border-b-0 md:border-r border-white/5'
                        }
                    `}>
                        {/* Tab buttons */}
                        <div className="flex gap-1 p-2 md:p-3 shrink-0">
                            <button
                                onClick={() => setTab('session')}
                                className={`flex-1 py-2 rounded text-[9px] font-bold uppercase transition-all ${tab === 'session' ? 'bg-wec-blue/40 text-white' : 'text-white/30 hover:text-white/50'}`}
                            >Session</button>
                            <button
                                onClick={() => setTab('team')}
                                className={`flex-1 py-2 rounded text-[9px] font-bold uppercase transition-all ${tab === 'team' ? 'bg-wec-blue/40 text-white' : 'text-white/30 hover:text-white/50'}`}
                            >Team MDT</button>
                        </div>
                        {/* Pilot list */}
                        <div className="flex-1 overflow-y-auto px-2 md:px-3 pb-3 space-y-2 wec-scrollbar min-h-0">
                            {sessionPilots.map((p, i) => (
                                <PilotRow
                                    key={i}
                                    pilot={p}
                                    selected={activePilot?.driverName === p.driverName}
                                    isOnline={lmuOnline}
                                    onClick={() => setSelectedPilot(p)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Desktop collapse tab — thin vertical strip always visible */}
                    <button
                        onClick={() => setFocusMode(f => !f)}
                        className="hidden md:flex w-5 shrink-0 flex-col items-center justify-center
                                   border-r border-white/[0.06] bg-white/[0.01]
                                   text-white/15 hover:text-white/50 hover:bg-white/[0.04]
                                   transition-all"
                        title={focusMode ? 'Mostrar panel de pilotos' : 'Ocultar panel de pilotos'}
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                                d={focusMode ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
                        </svg>
                    </button>

                    {/* Main content */}
                    <div className="flex-1 overflow-hidden min-h-0 min-w-0">
                        <PilotDetail
                            pilot={activePilot}
                            timingMode={timeMode}
                            focusMode={focusMode}
                            setFocusMode={setFocusMode}
                        />
                    </div>
                </div>
            </div>

            {/* QR Code Modal */}
            {showQR && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_0_50px_rgba(0,144,255,0.1)] flex flex-col items-center text-center relative">
                        <button
                            onClick={() => setShowQR(false)}
                            className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="w-14 h-14 bg-wec-blue/10 rounded-2xl flex items-center justify-center border border-wec-blue/20 mb-5">
                            <svg className="w-7 h-7 text-wec-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-black italic uppercase tracking-tight text-white mb-2">Live Telemetry</h2>
                        <p className="text-[10px] text-white/50 uppercase tracking-widest mb-6">Escanea para acceder desde móvil o tablet</p>
                        <div className="bg-white p-4 rounded-xl shadow-inner mb-5">
                            <QRCodeSVG value={`${localUrl}?mobile=1`} size={180} level="H" marginSize={0} />
                        </div>
                        <div className="flex flex-col w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                            <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest mb-1">URL Red Local</span>
                            <span className="font-mono text-sm text-wec-cyan tracking-tight break-all">{localUrl}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveTelemetry;
