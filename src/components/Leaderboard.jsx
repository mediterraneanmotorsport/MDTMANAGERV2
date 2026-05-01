import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendDiscordNotification } from '../services/discordService';

const getCarLogo = (carName) => {
    const name = (carName || '').toLowerCase();
    if (name.includes('ferrari')) return '/assets/logos/cars/Ferrari.png';
    if (name.includes('bmw')) return '/assets/logos/cars/BMW.png';
    if (name.includes('porsche')) return '/assets/logos/cars/Porsche.png';
    if (name.includes('aston martin')) return '/assets/logos/cars/Aston Martin.png';
    if (name.includes('corvette')) return '/assets/logos/cars/Corvette.png';
    if (name.includes('ford')) return '/assets/logos/cars/Ford.png';
    if (name.includes('lamborghini')) return '/assets/logos/cars/Lamborghini.png';
    if (name.includes('lexus')) return '/assets/logos/cars/Lexus.png';
    if (name.includes('mclaren')) return '/assets/logos/cars/McLaren.png';
    if (name.includes('mercedes') || name.includes('amg')) return '/assets/logos/cars/Mercedes-AMG.png';
    if (name.includes('toyota')) return '/assets/logos/cars/Toyota.png';
    if (name.includes('peugeot')) return '/assets/logos/cars/Peugeot.png';
    if (name.includes('cadillac')) return '/assets/logos/cars/Cadillac.png';
    if (name.includes('alpine')) return '/assets/logos/cars/Alpine.png';
    if (name.includes('glickenhaus')) return '/assets/logos/cars/Glickenhaus.png';
    if (name.includes('isotta') || name.includes('fraschini')) return '/assets/logos/cars/Isotta Fraschini.png';
    if (name.includes('vanwall')) return '/assets/logos/cars/Vanwall.png';
    if (name.includes('oreca')) return '/assets/logos/cars/Oreca.png';
    if (name.includes('ligier')) return '/assets/logos/cars/Ligier.png';
    if (name.includes('duqueine')) return '/assets/logos/cars/Duqueine.png';
    if (name.includes('ginetta')) return '/assets/logos/cars/Ginetta.png';
    if (name.includes('genesis')) return '/assets/logos/cars/Genesis.png';
    return '/assets/logos/cars/Default.png';
};

const getCategoryLogo = (catName) => {
    const name = (catName || '').toUpperCase();
    if (name.includes('HYP') || name === 'HY') return '/assets/logos/categories/HY.png';
    if (name.includes('LMP2')) return '/assets/logos/categories/LMP2.png';
    if (name.includes('LMP3')) return '/assets/logos/categories/LMP3.jpg';
    if (name.includes('GT3')) return '/assets/logos/categories/GT3.png';
    if (name.includes('GTE')) return '/assets/logos/categories/GTE.png';
    return null;
};

const Leaderboard = ({ gamePath, selectedCircuit, selectedCategory: initialCategory }) => {
    const [entries, setEntries] = useState([]);
    const [teamMembers, setTeamMembers] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [filterCircuit, setFilterCircuit] = useState('ALL');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterVersion, setFilterVersion] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [showOnlyMDT, setShowOnlyMDT] = useState(false);
    const [ignoredRecords, setIgnoredRecords] = useState(new Set());
    const sentNotifications = useRef(new Set());
    const [selectedEntry, setSelectedEntry] = useState(null);
    const sessionStartTime = useRef(new Date());

    const getCategory = (modelStr) => {
        if (!modelStr) return 'OTRO';
        const upper = modelStr.toUpperCase();
        if (upper.includes('HYPER') || upper.includes('LMH') || upper.includes('LMDH') || upper.includes('HY') || 
            upper.includes('GLICKENHAUS') || upper.includes('ISOTTA') || upper.includes('VANWALL') || upper.includes('GENESIS') ||
            upper.includes('TOYOTA') || upper.includes('PEUGEOT') || upper.includes('CADILLAC') || 
            upper.includes('499P') || upper.includes('963') || upper.includes('ALPINE') || upper.includes('SC63') || upper.includes('V-SERIES.R')) return 'HYPERCAR';
        if (upper.includes('GT3') || upper.includes('LMGT3')) return 'GT3';
        if (upper.includes('GTE')) return 'GTE';
        if (upper.includes('LMP2') || upper.includes('P2') || upper.includes('ORECA')) return 'LMP2';
        if (upper.includes('LMP3') || upper.includes('P3')) return 'LMP3';
        return 'OTRO';
    };

    const formatTime = (seconds) => {
        if (!seconds || seconds === 0) return '--:--.---';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(3);
        return `${mins}:${secs.padStart(6, '0')}`;
    };

    useEffect(() => {
        const syncAndLoadTelemetry = async () => {
            if (!gamePath || !window.electronAPI) {
                setLoading(false);
                return;
            }

            try {
                const allLaps = await window.electronAPI.scanLocalTelemetry({ gamePath });
                const localBests = {};
                allLaps.forEach(lap => {
                    const category = getCategory(lap.car);
                    const version = lap.gameVersion || 'Unknown';
                    const key = `${lap.circuit}_${category}_${lap.name}_${version}`;
                    if (!localBests[key] || lap.bestLap < localBests[key].bestLap) {
                        localBests[key] = { ...lap, category, version, key };
                    }
                });

                setEntries(Object.values(localBests));
                setLoading(false);

                const [leaderboardSnap, settingsSnap, membersSnap, ignoredSnap] = await Promise.all([
                    getDocs(collection(db, "lmu_leaderboard")),
                    getDoc(doc(db, "settings", "discord")),
                    getDocs(collection(db, "mdt_members")),
                    getDocs(collection(db, "ignored_records"))
                ]);

                const cloudBests = {};
                leaderboardSnap.forEach((doc) => {
                    cloudBests[doc.id] = { ...doc.data(), key: doc.id };
                });

                const ignoredIds = new Set(ignoredSnap.docs.map(d => d.id));
                setIgnoredRecords(ignoredIds);

                const webhookUrl = settingsSnap.exists() ? settingsSnap.data().url : null;
                const mdtMembersList = membersSnap.docs.map(d => d.data().name.toLowerCase());
                const mdtMembersSet = new Set(mdtMembersList);
                setTeamMembers(mdtMembersSet);

                const finalBests = { ...localBests };
                for (const key in cloudBests) {
                    const cloudLap = cloudBests[key];
                    // Lógica Anti-Duplicados: Si ya tenemos una versión mejor local o viceversa
                    if (!finalBests[key] || cloudLap.bestLap < finalBests[key].bestLap) {
                        finalBests[key] = cloudLap;
                    }
                }

                // LIMPIEZA DE MIGRACIÓN: Eliminar duplicados "huérfanos" (sin versión)
                const deduplicated = {};
                const recordsWithVersion = Object.values(finalBests).filter(l => l.gameVersion && l.gameVersion !== 'Unknown');
                const recordsUnknown = Object.values(finalBests).filter(l => !l.gameVersion || l.gameVersion === 'Unknown');

                // 1. Añadimos todos los que tienen versión (son los buenos)
                recordsWithVersion.forEach(lap => {
                    deduplicated[lap.key] = lap;
                });

                // 2. Añadimos los "Unknown" solo si no hay ya un registro para ese piloto/circuito/cat
                recordsUnknown.forEach(lap => {
                    const baseKey = `${lap.circuit}_${lap.category}_${lap.name}`;
                    const alreadyHasDetailed = recordsWithVersion.some(r => 
                        r.circuit === lap.circuit && 
                        r.category === lap.category && 
                        r.name === lap.name
                    );
                    
                    if (!alreadyHasDetailed) {
                        deduplicated[lap.key] = lap;
                    }
                });
                
                setEntries(Object.values(deduplicated));

                // Función interna para procesar una vuelta (subir y notificar)
                const processLapUpdate = async (lap, currentCloudBests) => {
                    const category = getCategory(lap.car);
                    const version = lap.gameVersion || 'Unknown';
                    const key = `${lap.circuit}_${category}_${lap.name}_${version}`;
                    
                    if (ignoredIds.has(key)) return;

                    const cloudLap = currentCloudBests[key];
                    const hasLocalSectors = lap.sectors && (lap.sectors.s1 > 0 || lap.sectors.s2 > 0 || lap.sectors.s3 > 0);
                    const cloudMissingSectors = !cloudLap?.sectors || (cloudLap.sectors.s1 === 0 && cloudLap.sectors.s2 === 0);

                    // SUBIR SI: No existe OR Mejor tiempo OR Faltan sectores
                    if (!cloudLap || lap.bestLap < cloudLap.bestLap || (hasLocalSectors && cloudMissingSectors)) {
                        await setDoc(doc(db, "lmu_leaderboard", key), {
                            circuit: lap.circuit,
                            category: category,
                            car: lap.car,
                            name: lap.name,
                            bestLap: lap.bestLap,
                            sectors: lap.sectors || { s1: 0, s2: 0, s3: 0 },
                            topSpeed: lap.topSpeed || '0',
                            gameVersion: version,
                            date: lap.date || new Date().toISOString()
                        });

                        // Notificar si es miembro y es una MEJORA REAL de tiempo
                        const isMember = mdtMembersSet.has(lap.name.toLowerCase());
                        const notificationKey = `${key}_${lap.bestLap}`; // Llave única por tiempo para permitir mejoras

                        if (isMember && webhookUrl && !sentNotifications.current.has(notificationKey)) {
                            if (!cloudLap || lap.bestLap < cloudLap.bestLap) {
                                sentNotifications.current.add(notificationKey);
                                sendDiscordNotification(webhookUrl, {
                                    pilot: lap.name,
                                    circuit: lap.circuit,
                                    car: lap.car,
                                    lapTime: lap.bestLap,
                                    category: category,
                                    improvement: cloudLap ? cloudLap.bestLap - lap.bestLap : 0
                                });
                            }
                        }
                    }
                };

                // Procesar carga inicial
                for (const key in localBests) {
                    const lap = localBests[key];
                    const isMember = mdtMembersSet.has(lap.name.toLowerCase());
                    if (lap.isPlayer || isMember) {
                        await processLapUpdate(lap, cloudBests);
                    }
                }

                // ESCUCHAR ACTUALIZACIONES EN TIEMPO REAL
                if (window.electronAPI.onTelemetryUpdate) {
                    window.electronAPI.onTelemetryUpdate(async (data) => {
                        console.log("MDT Link: Recibida actualización en tiempo real", data);
                        const { circuit, results } = data;
                        
                        setEntries(prev => {
                            const combined = [...prev];
                            let updated = false;

                            results.forEach(lap => {
                                const category = getCategory(lap.car);
                                const version = lap.gameVersion || 'Unknown';
                                const key = `${circuit}_${category}_${lap.name}_${version}`;
                                const isMember = mdtMembersSet.has(lap.name.toLowerCase());
                                
                                const idx = combined.findIndex(e => e.key === key);
                                if (idx === -1) {
                                    combined.push({ ...lap, circuit, category, version, key });
                                    updated = true;
                                } else if (lap.bestLap < combined[idx].bestLap) {
                                    combined[idx] = { ...lap, circuit, category, version, key };
                                    updated = true;
                                }

                                if (lap.isPlayer || isMember) {
                                    processLapUpdate({ ...lap, circuit, category, version, key }, cloudBests);
                                }
                            });

                            if (!updated) return prev;

                            // Aplicar deduplicación inteligente al estado final
                            const finalMap = {};
                            const withVer = combined.filter(l => l.gameVersion && l.gameVersion !== 'Unknown');
                            const unkVer = combined.filter(l => !l.gameVersion || l.gameVersion === 'Unknown');

                            withVer.forEach(l => finalMap[l.key] = l);
                            unkVer.forEach(l => {
                                const hasDetailed = withVer.some(r => r.circuit === l.circuit && r.category === l.category && r.name === l.name);
                                if (!hasDetailed) finalMap[l.key] = l;
                            });

                            return Object.values(finalMap);
                        });
                    });
                }

            } catch (err) {
                console.error("Error syncing telemetry", err);
            }
        };
        syncAndLoadTelemetry();
    }, [gamePath]);

    const availableCircuits = useMemo(() => {
        const circuits = new Set(entries.map(e => e.circuit));
        return Array.from(circuits).sort();
    }, [entries]);

    const availableCategories = useMemo(() => {
        const cats = new Set(entries.map(e => e.category));
        return Array.from(cats).sort();
    }, [entries]);

    const availableVersions = useMemo(() => {
        const versions = new Set(entries.map(e => e.gameVersion).filter(v => v && v !== 'Unknown'));
        return Array.from(versions).sort((a, b) => b.localeCompare(a));
    }, [entries]);

    const grouped = useMemo(() => {
        // 1. Filtrado en un solo paso (O(N))
        const filtered = entries.filter(e => {
            // Filtro de registros ignorados
            const key = e.key || `${e.circuit}_${e.category}_${e.name}_${e.gameVersion || 'Unknown'}`;
            if (ignoredRecords.has(key)) return false;

            // Filtro de Circuito
            if (filterCircuit && filterCircuit !== 'ALL' && e.circuit !== filterCircuit) return false;

            // Filtro de Categoría
            if (filterCategory && filterCategory !== 'ALL' && e.category !== filterCategory) return false;

            // Filtro de Versión
            if (filterVersion && filterVersion !== 'ALL' && e.gameVersion !== filterVersion) return false;

            // Filtro de MDT
            if (showOnlyMDT && !teamMembers.has(e.name.toLowerCase())) return false;

            // Filtro de Búsqueda (Search Query)
            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase();
                const nameMatch = e.name.toLowerCase().includes(q);
                const carMatch = e.car.toLowerCase().includes(q);
                if (!nameMatch && !carMatch) return false;
            }

            return true;
        });

        // 2. Agrupación y Ordenación (O(N log N))
        const baseGrouped = filtered.reduce((acc, entry) => {
            const circuit = entry.circuit || 'Circuito Desconocido';
            const category = entry.category;
            if (!acc[circuit]) acc[circuit] = {};
            if (!acc[circuit][category]) acc[circuit][category] = [];
            acc[circuit][category].push(entry);
            return acc;
        }, {});

        // Ordenar cada categoría y calcular deltas
        Object.values(baseGrouped).forEach(circuitObj => {
            Object.values(circuitObj).forEach(catEntries => {
                catEntries.sort((a, b) => a.bestLap - b.bestLap);
                const poleTime = catEntries[0]?.bestLap || 0;
                catEntries.forEach((entry, index) => {
                    entry.globalPos = index + 1;
                    entry.globalDelta = index === 0 ? 0 : entry.bestLap - poleTime;
                });
            });
        });

        return baseGrouped;
    }, [entries, filterCircuit, filterCategory, filterVersion, searchQuery, showOnlyMDT, teamMembers, ignoredRecords]);

    const TelemetryModal = ({ entry, onClose }) => {
        if (!entry) return null;
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
                <div className="relative w-full max-w-2xl liquid-glass rounded-3xl border-racing-blue/30 shadow-[0_0_50px_rgba(0,112,243,0.2)] overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500">
                    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-racing-blue/10 to-transparent pointer-events-none" />
                    <div className="p-8 relative z-10">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-[10px] font-black text-racing-blue uppercase tracking-[0.4em] mb-2">Informe de Telemetría</h3>
                                <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">{entry.name}</h2>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">{entry.car} • {entry.circuit}</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-500 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-black/40 p-6 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Tiempo de Vuelta</span>
                                <span className="text-5xl font-black italic text-racing-blue tabular-nums">{formatTime(entry.bestLap)}</span>
                                <div className="mt-4 flex gap-2">
                                    <span className="text-[10px] bg-racing-blue/20 text-racing-blue px-2 py-1 rounded font-bold">POS #{entry.globalPos}</span>
                                    {entry.globalDelta > 0 && <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-1 rounded font-bold">+{entry.globalDelta.toFixed(3)}s</span>}
                                </div>
                            </div>
                            <div className="bg-black/40 p-6 rounded-2xl border border-white/5 space-y-4">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block text-center">Desglose de Sectores</span>
                                {['s1', 's2', 's3'].map((s, i) => (
                                    <div key={s} className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-zinc-600 uppercase">Sector {i+1}</span>
                                        <span className="text-sm font-black text-white italic tabular-nums">{entry.sectors?.[s] ? entry.sectors[s].toFixed(3) + 's' : '--.---'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                                <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Top Speed</div>
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-2xl font-black italic text-racing-orange tabular-nums">{entry.topSpeed || '--'}</span>
                                    <span className="text-[10px] font-bold text-zinc-600">KM/H</span>
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center flex flex-col justify-center">
                                <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Versión Juego</div>
                                <div className="text-xs font-black text-white truncate px-2">{entry.gameVersion || 'Unknown'}</div>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                            <div className="text-[9px] text-zinc-600 font-mono italic">MDT DATA LINK SECURE • {entry.date}</div>
                            <button className="px-6 py-2 bg-racing-blue/10 text-racing-blue border border-racing-blue/20 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-racing-blue hover:text-white transition-all">Exportar Telemetría</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full space-y-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between px-4 mt-8 gap-4">
                <div className="flex justify-between items-center px-4 mb-4">
                    <div className="flex flex-col">
                        <h2 className="text-3xl font-black italic tracking-widest text-white uppercase" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.2)' }}>
                            <span className="text-transparent">Global</span> Leaderboard
                        </h2>
                        <span className="text-xs text-racing-blue font-bold tracking-widest uppercase mt-1">Sincronización Activa</span>
                    </div>
                </div>
            </div>

            <div className="mx-4 p-4 liquid-glass rounded-2xl border border-white/10 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto custom-scrollbar pb-2 md:pb-0">
                    <div className="flex flex-col gap-1 shrink-0">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Circuito</label>
                        <select className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold text-white uppercase focus:border-racing-blue outline-none transition-colors" value={filterCircuit} onChange={(e) => setFilterCircuit(e.target.value)}>
                            <option value="ALL">Todos los Circuitos</option>
                            {availableCircuits.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Clase</label>
                        <select className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold text-white uppercase focus:border-racing-orange outline-none transition-colors" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                            <option value="ALL">Todas las Categorías</option>
                            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Versión</label>
                        <select className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold text-white uppercase focus:border-racing-success outline-none transition-colors" value={filterVersion} onChange={(e) => setFilterVersion(e.target.value)}>
                            <option value="ALL">Todas las Versiones</option>
                            {availableVersions.map(v => <option key={v} value={v}>v{v}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    <button onClick={() => setShowOnlyMDT(!showOnlyMDT)} className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all duration-300 group ${showOnlyMDT ? 'bg-racing-orange border-racing-orange shadow-[0_0_20px_rgba(255,107,0,0.4)]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                        <img src="/logo.png" alt="MDT" className={`w-5 h-5 object-contain transition-transform duration-500 ${showOnlyMDT ? 'scale-110' : 'group-hover:scale-110'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${showOnlyMDT ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`}>Solo Equipo MDT</span>
                        {showOnlyMDT && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    </button>
                    <div className="flex flex-col gap-1 w-full md:w-64 shrink-0">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Buscar Piloto / Coche</label>
                        <div className="relative">
                            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input type="text" placeholder="Ej. Valiente, Ferrari..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm font-bold text-white placeholder-zinc-700 focus:border-white/30 outline-none transition-colors" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {Object.keys(grouped).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                        <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">No se han encontrado récords</p>
                    </div>
                ) : (
                    Object.entries(grouped).map(([circuit, categories]) => (
                        <div key={circuit} className="space-y-4">
                            <div className="flex items-center gap-3 px-4">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">{circuit}</h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-white/10 via-white/10 to-transparent"></div>
                            </div>

                            {Object.entries(categories).map(([category, catEntries]) => {
                                const categoryLogo = getCategoryLogo(category);
                                return (
                                <div key={category} className="mx-4 overflow-hidden rounded-2xl border border-white/5 bg-black/20 shadow-2xl">
                                    <div className="bg-white/[0.02] px-6 py-3 border-b border-white/5 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            {categoryLogo && <img src={categoryLogo} alt={category} className="h-4 object-contain" />}
                                            <span className="text-[10px] font-black text-racing-blue uppercase tracking-widest">{category}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{catEntries.length} Pilotos</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-black/40">
                                                    <th className="px-6 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5">#</th>
                                                    <th className="px-6 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5">Piloto</th>
                                                    <th className="px-6 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5">Coche</th>
                                                    <th className="px-6 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 text-right">Tiempo / Delta</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {catEntries.map((entry) => {
                                                    const isMatch = searchQuery.trim() !== '' && (entry.name.toLowerCase().includes(searchQuery.toLowerCase()) || entry.car.toLowerCase().includes(searchQuery.toLowerCase()));
                                                    const isTeamMember = teamMembers.has(entry.name.toLowerCase());
                                                    return (
                                                        <tr key={`${entry.circuit}_${entry.name}_${entry.bestLap}`} className={`transition-all duration-300 ${isMatch ? 'bg-racing-blue/20 border-l-4 border-racing-blue' : 'hover:bg-white/[0.04]'}`}>
                                                            <td className="px-6 py-4">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black italic text-sm ${entry.globalPos === 1 ? 'bg-racing-orange text-white' : 'bg-white/5 text-zinc-500'}`}>{entry.globalPos}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <button onClick={() => setSelectedEntry(entry)} className="flex items-center gap-4 group/pilot text-left">
                                                                    {isTeamMember && (
                                                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-racing-blue/20 to-racing-orange/20 border border-white/10 p-1 flex items-center justify-center overflow-hidden">
                                                                            <img src="/logo.png" alt="MDT" className="w-full h-full object-contain" />
                                                                        </div>
                                                                    )}
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-base font-black uppercase tracking-tight group-hover/pilot:text-racing-blue transition-colors ${entry.globalPos === 1 ? 'text-white' : 'text-zinc-300'}`}>{entry.name}</span>
                                                                            {isTeamMember && <span className="px-1.5 py-0.5 bg-racing-orange text-white text-[6px] font-black uppercase rounded italic">Piloto MDT</span>}
                                                                        </div>
                                                                        <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Ver Telemetría</span>
                                                                    </div>
                                                                </button>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <img src={getCarLogo(entry.car)} alt={entry.car} className="h-6 w-auto max-w-[40px] object-contain opacity-90" />
                                                                    <span className="text-xs text-zinc-400 font-bold uppercase truncate max-w-[150px]">{entry.car}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex flex-col items-end justify-center">
                                                                    <span className={`text-xl font-black italic tracking-tighter tabular-nums ${entry.globalPos === 1 ? 'text-racing-blue' : 'text-white'}`}>{formatTime(entry.bestLap)}</span>
                                                                    {entry.globalPos > 1 && <span className="text-[10px] font-mono font-bold text-zinc-500">+{formatTime(entry.globalDelta).replace(/^0:/, '')}</span>}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )})}
                        </div>
                    ))
                )}
            </div>

            {selectedEntry && createPortal(
                <TelemetryModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />,
                document.body
            )}
        </div>
    );
};

export default Leaderboard;
