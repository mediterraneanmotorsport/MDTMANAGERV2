import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendDiscordNotification } from '../services/discordService';

const getCarLogo = (carName) => {
    const name = (carName || '').toLowerCase();
    if (name.includes('ferrari')) return 'assets/logos/cars/Ferrari.png';
    if (name.includes('bmw')) return 'assets/logos/cars/BMW.png';
    if (name.includes('porsche')) return 'assets/logos/cars/Porsche.png';
    if (name.includes('aston martin')) return 'assets/logos/cars/Aston Martin.png';
    if (name.includes('corvette')) return 'assets/logos/cars/Corvette.png';
    if (name.includes('ford')) return 'assets/logos/cars/Ford.png';
    if (name.includes('lamborghini')) return 'assets/logos/cars/Lamborghini.png';
    if (name.includes('lexus')) return 'assets/logos/cars/Lexus.png';
    if (name.includes('mclaren')) return 'assets/logos/cars/McLaren.png';
    if (name.includes('mercedes') || name.includes('amg')) return 'assets/logos/cars/Mercedes-AMG.png';
    if (name.includes('toyota')) return 'assets/logos/cars/Toyota.png';
    if (name.includes('peugeot')) return 'assets/logos/cars/Peugeot.png';
    if (name.includes('cadillac')) return 'assets/logos/cars/Cadillac.png';
    if (name.includes('alpine')) return 'assets/logos/cars/Alpine.png';
    if (name.includes('glickenhaus')) return 'assets/logos/cars/Glickenhaus.png';
    if (name.includes('isotta') || name.includes('fraschini')) return 'assets/logos/cars/Isotta Fraschini.png';
    if (name.includes('vanwall')) return 'assets/logos/cars/Vanwall.png';
    if (name.includes('oreca')) return 'assets/logos/cars/Oreca.png';
    if (name.includes('ligier')) return 'assets/logos/cars/Ligier.png';
    if (name.includes('duqueine')) return 'assets/logos/cars/Duqueine.png';
    if (name.includes('ginetta')) return 'assets/logos/cars/Ginetta.png';
    if (name.includes('genesis')) return 'assets/logos/cars/Genesis.png';
    return 'assets/logos/cars/Default.png';
};

const getCategoryLogo = (catName) => {
    const name = (catName || '').toUpperCase();
    if (name.includes('HYP') || name === 'HY') return 'assets/logos/categories/HY.png';
    if (name.includes('LMP2')) return 'assets/logos/categories/LMP2.png';
    if (name.includes('LMP3')) return 'assets/logos/categories/LMP3.jpg';
    if (name.includes('GT3')) return 'assets/logos/categories/GT3.png';
    if (name.includes('GTE')) return 'assets/logos/categories/GTE.png';
    return null;
};

const Leaderboard = ({ gamePath, selectedCircuit, selectedCategory: initialCategory }) => {
    const [entries, setEntries] = useState([]);
    const [teamMembers, setTeamMembers] = useState(new Set());
    const [localPlayerName, setLocalPlayerName] = useState(null);
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
                // 1. Funciones de Identidad Unificada
                const getIdentityBase = (lap) => {
                    const circ = (lap.circuit || '').replace(/\s+/g, '').toLowerCase();
                    const cat = getCategory(lap.car).replace(/\s+/g, '').toLowerCase();
                    const name = (lap.name || '').replace(/\s+/g, '').toLowerCase();
                    return `${circ}_${cat}_${name}`;
                };

                const getIdentityKey = (lap) => {
                    const base = getIdentityBase(lap);
                    const rawVer = (lap.gameVersion || 'Unknown').trim();
                    const verMatch = rawVer.match(/^(\d+\.\d)/);
                    let ver = verMatch ? verMatch[1] : 'Unknown';
                    if (ver === '1.3' || ver === 'Unknown') ver = '1.3000';
                    return `${base}_${ver}`;
                };

                // 2. Carga de Datos (Prioridad Cloud para la UI)
                const [cloudSnap, settingsSnap, membersSnap, ignoredSnap, allLocal] = await Promise.all([
                    getDocs(collection(db, "lmu_leaderboard")),
                    getDoc(doc(db, "settings", "discord")),
                    getDocs(collection(db, "mdt_members")),
                    getDocs(collection(db, "ignored_records")),
                    window.electronAPI.scanLocalTelemetry({ gamePath })
                ]);

                const webhook = settingsSnap.exists() ? settingsSnap.data().url : null;
                const membersSet = new Set(membersSnap.docs.map(d => d.data().name.trim().toLowerCase()));
                const ignoredSet = new Set(ignoredSnap.docs.map(d => d.id));

                console.log(`MDT Leaderboard: [INIT] Miembros cargados: ${membersSet.size} | Registros locales: ${allLocal?.length || 0}`);

                setTeamMembers(membersSet);
                setIgnoredRecords(ignoredSet);

                // 3. Preparar lista inteligente de ignorados (POR TIEMPO O ID)
                const ignoredTimesMap = {};
                ignoredSnap.forEach(doc => {
                    ignoredTimesMap[doc.id] = doc.data().bestLap;
                });

                // 4. Procesar Datos de la NUBE con Consolidación Extrema
                const cloudMap = {};
                cloudSnap.forEach((doc) => {
                    const data = doc.data();
                    const key = doc.id;

                    // Normalización de versión
                    const rawVer = (data.gameVersion || 'Unknown').trim();
                    const verMatch = rawVer.match(/^(\d+\.\d)/);
                    let cleanVer = verMatch ? verMatch[1] : 'Unknown';
                    if (cleanVer === '1.3' || cleanVer === 'Unknown') cleanVer = '1.3000';
                    data.gameVersion = cleanVer;

                    // Identidad Universal
                    const identityBase = getIdentityBase(data);

                    // Filtro de Seguridad: ¿Está en la lista negra?
                    const ignoredByTime = ignoredTimesMap[identityBase] || ignoredTimesMap[key];
                    const isTimeIgnored = ignoredByTime && Math.abs(data.bestLap - ignoredByTime) < 0.001;

                    if (ignoredSet.has(key) || isTimeIgnored) return;

                    const existing = cloudMap[identityBase];
                    const isNewFaster = !existing || Number(data.bestLap) < Number(existing.bestLap);
                    const isEqualButBetterVersion = existing && Number(data.bestLap) === Number(existing.bestLap) && data.gameVersion !== 'Unknown' && existing.gameVersion === 'Unknown';

                    if (isNewFaster || isEqualButBetterVersion) {
                        if (existing && data.bestLap !== existing.bestLap) {
                            console.log(`MDT Sync: [CONSOLIDACIÓN] Fusionando tiempos de ${data.name}. Manteniendo ${data.bestLap} sobre ${existing.bestLap}`);
                        }
                        cloudMap[identityBase] = { ...data, key };
                    }
                });

                const finalCloudEntries = Object.values(cloudMap);
                console.log(`MDT Leaderboard: Mostrando ${finalCloudEntries.length} récords consolidados.`);
                setEntries(finalCloudEntries);
                setLoading(false);

                // 5. Motor de Actualización (Background)
                const processLap = async (lap, circuitName) => {
                    const fullLap = { ...lap, circuit: circuitName || lap.circuit };
                    const key = getIdentityKey(fullLap);
                    const baseKey = getIdentityBase(fullLap);

                    // COMPROBACIÓN INTELIGENTE DE IGNORADOS
                    // Bloqueamos si coincide el ID exacto O si coincide la identidad base + el tiempo
                    const isSpecificIgnored = ignoredSet.has(key);
                    const ignoredTime = ignoredTimesMap[baseKey] || ignoredTimesMap[key];
                    const isTimeIgnored = ignoredTime && Math.abs(lap.bestLap - ignoredTime) < 0.001;

                    // Identificar al jugador local para el resaltado UI
                    if (lap.isPlayer && lap.name && !localPlayerName) {
                        setLocalPlayerName(lap.name);
                    }

                    if (isSpecificIgnored || isTimeIgnored) {
                        console.log(`MDT Sync: [SKIP] ${lap.name} en ${fullLap.circuit} - Tiempo ${lap.bestLap} ignorado.`);
                        return;
                    }

                    const existingCloud = cloudMap[baseKey]; // USAR BASEKEY PARA EVITAR SUBIDAS INFINITAS
                    const hasLocalSectors = lap.sectors && (lap.sectors.s1 > 0 || lap.sectors.s2 > 0 || lap.sectors.s3 > 0);

                    // Normalización de versión para la comparación
                    const rawVersion = (lap.gameVersion || 'Unknown').trim();
                    const verMatch = rawVersion.match(/^(\d+\.\d)/);
                    let cleanVersion = verMatch ? verMatch[1] : 'Unknown';
                    if (cleanVersion === '1.3' || cleanVersion === 'Unknown') cleanVersion = '1.3000';

                    console.log(`MDT Sync: [CHECK] ${lap.name} | Local: ${lap.bestLap} | Cloud: ${existingCloud?.bestLap || 'Ninguno'}`);

                    // REGLA DE ORO: El tiempo más rápido MANDA. 
                    // No permitimos que un tiempo lento sobrescriba a uno rápido por tener sectores.
                    const isFaster = !existingCloud || Number(lap.bestLap) < Number(existingCloud.bestLap) - 0.001;
                    const isSameTimeButBetterData = existingCloud &&
                        Math.abs(Number(lap.bestLap) - Number(existingCloud.bestLap)) < 0.001 &&
                        hasLocalSectors && (!existingCloud.sectors || existingCloud.sectors.s1 === 0);

                    if (isFaster || isSameTimeButBetterData) {
                        const uploadData = {
                            circuit: fullLap.circuit,
                            category: getCategory(lap.car),
                            car: lap.car,
                            name: lap.name.trim(),
                            bestLap: Number(lap.bestLap),
                            sectors: lap.sectors || { s1: 0, s2: 0, s3: 0 },
                            topSpeed: lap.topSpeed || '0',
                            gameVersion: cleanVersion,
                            date: new Date().toISOString()
                        };

                        console.log(`MDT Sync: [UPLOAD] Subiendo mejora de ${name}: ${lap.bestLap}s`);
                        await setDoc(doc(db, "lmu_leaderboard", key), uploadData);
                        cloudMap[baseKey] = { ...uploadData, key };

                        // Notificación Discord (SOLO SI ES MEJORA REAL SOBRE TODO LO QUE TENEMOS)
                        const currentBest = cloudMap[baseKey]?.bestLap || Infinity;
                        if (membersSet.has(lap.name.trim().toLowerCase()) && webhook && Number(lap.bestLap) < Number(currentBest) + 0.001) {
                            // Solo enviamos si realmente estamos mejorando el récord absoluto que tiene la app en este momento
                            if (!existingCloud || Number(lap.bestLap) < Number(existingCloud.bestLap) - 0.001) {
                                sendDiscordNotification(webhook, {
                                    pilot: lap.name, circuit: fullLap.circuit, car: lap.car,
                                    lapTime: lap.bestLap, category: uploadData.category,
                                    improvement: existingCloud ? existingCloud.bestLap - lap.bestLap : 0
                                });
                            }
                        }
                    }
                };

                // Sincronizar logs históricos en segundo plano (Secuencial para evitar saturación)
                // 5. Motor de Sincronización Histórica (Primeros 30 archivos)
                const syncHistory = async () => {
                    if (!allLocal || allLocal.length === 0) {
                        console.log("MDT Sync: No se encontraron registros locales recientes.");
                    } else {
                        console.log(`MDT Sync: Iniciando escaneo de ${allLocal.length} archivos locales...`);
                        for (const l of allLocal) {
                            const pilotName = (l.name || '').toLowerCase().trim();
                            const isMember = membersSet.has(pilotName);
                            const shouldProcess = l.isPlayer || isMember;

                            if (shouldProcess) {
                                await processLap(l);
                            }
                        }
                    }

                    const finalEntries = Object.values(cloudMap);
                    console.log(`MDT Sync: Sincronización finalizada. UI actualizada.`);
                    setEntries(finalEntries);
                    setLoading(false);
                };

                await syncHistory();

                // 6. Listener de Telemetría en Tiempo Real
                if (window.electronAPI.onTelemetryUpdate) {
                    window.electronAPI.onTelemetryUpdate(async data => {
                        console.log("MDT Sync: Nueva telemetría en pista...");
                        for (const lap of data.results) {
                            const pilotName = (lap.name || '').toLowerCase().trim();
                            const isMember = membersSet.has(pilotName);
                            if (lap.isPlayer || isMember) {
                                await processLap(lap, data.circuit);
                            }
                        }
                        setEntries(Object.values(cloudMap));
                    });
                }

            } catch (err) {
                console.error("Critical Sync Failure", err);
                setLoading(false);
            }
        };
        syncAndLoadTelemetry();
    }, [gamePath]);

    const availableCircuits = useMemo(() => {
        const circuits = new Set(entries.map(e => e.circuit));
        return Array.from(circuits).sort();
    }, [entries]);

    // Auto-seleccionar el primer circuito disponible al cargar datos
    // Evita renderizar todos los circuitos a la vez (performance) y muestra datos inmediatamente
    const hasAutoSelected = useRef(false);
    useEffect(() => {
        if (!hasAutoSelected.current && availableCircuits.length > 0) {
            hasAutoSelected.current = true;
            setFilterCircuit(availableCircuits[0]);
        }
    }, [availableCircuits]);

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
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                <div className="absolute inset-0 bg-wec-black/70 backdrop-blur-lg" onClick={onClose} />
                <div className="relative w-full max-w-2xl wec-glass rounded-xl border-wec-cyan/20 shadow-[0_0_60px_rgba(0,212,255,0.1)] overflow-hidden wec-enter">
                    <div className="h-1 bg-gradient-to-r from-wec-blue via-wec-cyan to-wec-blue/30" />
                    <div className="p-8 relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="wec-label mb-2 flex items-center gap-2"><div className="w-1 h-3 bg-wec-cyan" />Informe de Telemetría</div>
                                <h2 className="text-3xl font-bold text-white uppercase tracking-tight" style={{ fontFamily: 'var(--font-body)' }}>{entry.name}</h2>
                                <p className="text-[10px] text-white/25 font-medium uppercase tracking-wider mt-1">{entry.car} • {entry.circuit}</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/20 hover:text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-wec-void/60 p-5 rounded-lg border border-white/5 flex flex-col items-center justify-center">
                                <span className="wec-label mb-2">Lap Time</span>
                                <span className="text-4xl font-bold text-wec-cyan wec-timing">{formatTime(entry.bestLap)}</span>
                                <div className="mt-3 flex gap-2">
                                    <span className="text-wec-display text-[8px] bg-wec-blue/10 text-wec-blue px-2 py-1 rounded font-bold">POS #{entry.globalPos}</span>
                                    {entry.globalDelta > 0 && <span className="text-wec-display text-[8px] bg-wec-red/10 text-wec-red px-2 py-1 rounded font-bold">+{entry.globalDelta.toFixed(3)}s</span>}
                                </div>
                            </div>
                            <div className="bg-wec-void/60 p-5 rounded-lg border border-white/5 space-y-3">
                                <span className="wec-label block text-center">Sector Split</span>
                                {['s1', 's2', 's3'].map((s, i) => (
                                    <div key={s} className="flex items-center justify-between">
                                        <span className="wec-label">S{i + 1}</span>
                                        <span className="text-sm font-bold text-white wec-timing">{entry.sectors?.[s] ? entry.sectors[s].toFixed(3) + 's' : '--.---'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="bg-wec-surface/50 p-4 rounded-lg border border-white/5 text-center">
                                <div className="wec-label mb-1">V-Max</div>
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-xl font-bold text-wec-gold wec-timing">{entry.topSpeed || '--'}</span>
                                    <span className="text-wec-display text-[7px] font-medium text-white/20">KM/H</span>
                                </div>
                            </div>
                            <div className="bg-wec-surface/50 p-4 rounded-lg border border-white/5 text-center flex flex-col justify-center">
                                <div className="wec-label mb-1">Game Version</div>
                                <div className="text-xs font-bold text-white/60" style={{ fontFamily: 'var(--font-data)' }}>{entry.gameVersion || 'Unknown'}</div>
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                            <div className="text-wec-display text-[7px] text-white/15 uppercase tracking-wider">MDT Secure Link • {entry.date}</div>
                            <button className="px-5 py-2 bg-wec-blue/10 text-wec-cyan border border-wec-blue/20 rounded-lg text-wec-display text-[8px] font-bold uppercase tracking-wider hover:bg-wec-blue hover:text-white transition-all">Exportar</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between px-4 mt-8 gap-4">
                <div className="flex justify-between items-center px-4 mb-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-1 h-5 bg-wec-cyan rounded-full" />
                            <span className="text-wec-display text-[9px] text-wec-cyan font-bold tracking-[0.3em] uppercase">Live Timing</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-wec-green wec-live-dot" />
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-white uppercase" style={{ fontFamily: 'var(--font-body)' }}>
                            Global <span className="text-wec-cyan">Leaderboard</span>
                        </h2>
                    </div>
                </div>
            </div>

            <div className="mx-4 p-4 wec-glass rounded-lg border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto custom-scrollbar pb-2 md:pb-0">
                    <div className="flex flex-col gap-1 shrink-0">
                        <label className="wec-label px-1">Circuito</label>
                        <select className="bg-wec-void/80 border border-white/5 rounded-lg px-4 py-2 text-sm font-bold text-white uppercase focus:border-wec-blue outline-none transition-colors" style={{ fontFamily: 'var(--font-data)' }} value={filterCircuit} onChange={(e) => setFilterCircuit(e.target.value)}>
                            <option value="ALL">Todos los Circuitos</option>
                            {availableCircuits.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                        <label className="wec-label px-1">Clase</label>
                        <select className="bg-wec-void/80 border border-white/5 rounded-lg px-4 py-2 text-sm font-bold text-white uppercase focus:border-wec-gold outline-none transition-colors" style={{ fontFamily: 'var(--font-data)' }} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                            <option value="ALL">Todas las Categorías</option>
                            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                        <label className="wec-label px-1">Versión</label>
                        <select className="bg-wec-void/80 border border-white/5 rounded-lg px-4 py-2 text-sm font-bold text-white uppercase focus:border-wec-green outline-none transition-colors" style={{ fontFamily: 'var(--font-data)' }} value={filterVersion} onChange={(e) => setFilterVersion(e.target.value)}>
                            <option value="ALL">Todas las Versiones</option>
                            {availableVersions.map(v => <option key={v} value={v}>v{v}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    <button onClick={() => setShowOnlyMDT(!showOnlyMDT)} className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-all duration-300 group ${showOnlyMDT ? 'bg-wec-gold/15 border-wec-gold/40 shadow-[0_0_20px_rgba(232,168,50,0.2)]' : 'bg-white/3 border-white/5 hover:border-white/10'}`}>
                        <img src="logo.png" alt="MDT" className={`w-5 h-5 object-contain transition-transform duration-500 ${showOnlyMDT ? 'scale-110' : 'group-hover:scale-110'}`} />
                        <span className={`text-wec-display text-[9px] font-bold uppercase tracking-wider ${showOnlyMDT ? 'text-wec-gold' : 'text-white/30 group-hover:text-white/60'}`}>Solo MDT</span>
                        {showOnlyMDT && <div className="w-1.5 h-1.5 rounded-full bg-wec-gold wec-live-dot" />}
                    </button>
                    <div className="flex flex-col gap-1 w-full md:w-64 shrink-0">
                        <label className="wec-label px-1">Buscar Piloto</label>
                        <div className="relative">
                            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input type="text" placeholder="Piloto o coche..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-wec-void/80 border border-white/5 rounded-lg pl-9 pr-4 py-2 text-sm font-bold text-white placeholder-white/10 focus:border-wec-blue/30 outline-none transition-colors" style={{ fontFamily: 'var(--font-data)' }} />
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
                                    <div key={category} className="mx-4 overflow-hidden rounded-lg border border-white/5 bg-wec-void/50 shadow-2xl">
                                        <div className="bg-wec-surface/50 px-5 py-2.5 border-b border-white/5 flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                {categoryLogo && <img src={categoryLogo} alt={category} className="h-4 object-contain" />}
                                                <span className="text-wec-display text-[9px] font-bold text-wec-cyan uppercase tracking-wider">{category}</span>
                                            </div>
                                            <span className="text-wec-display text-[8px] font-medium text-white/20 uppercase tracking-wider">{catEntries.length} Pilotos</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-wec-black/60">
                                                        <th className="px-5 py-2.5 wec-label border-b border-white/5">POS</th>
                                                        <th className="px-5 py-2.5 wec-label border-b border-white/5">Piloto</th>
                                                        <th className="px-5 py-2.5 wec-label border-b border-white/5">Vehículo</th>
                                                        <th className="px-5 py-2.5 wec-label border-b border-white/5 text-right">Tiempo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {catEntries.map((entry) => {
                                                        const isMatch = searchQuery.trim() !== '' && (entry.name.toLowerCase().includes(searchQuery.toLowerCase()) || entry.car.toLowerCase().includes(searchQuery.toLowerCase()));
                                                        const isTeamMember = teamMembers.has(entry.name.toLowerCase());
                                                        const isLocalPlayer = localPlayerName && entry.name.toLowerCase().trim() === localPlayerName.toLowerCase().trim();
                                                        return (
                                                            <tr key={`${entry.circuit}_${entry.name}_${entry.bestLap}`} className={`transition-all duration-300 ${isMatch ? 'bg-wec-blue/10 border-l-2 border-wec-cyan' : (isLocalPlayer ? 'bg-wec-blue/5 border-l-2 border-l-wec-blue' : 'hover:bg-white/[0.02]')}`}>
                                                                <td className="px-5 py-3">
                                                                    <div className={`w-7 h-7 rounded flex items-center justify-center text-wec-display text-xs font-bold ${entry.globalPos === 1 ? 'wec-pos-1' : entry.globalPos === 2 ? 'wec-pos-2' : entry.globalPos === 3 ? 'wec-pos-3' : 'bg-white/5 text-white/30'}`}>{entry.globalPos}</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <button onClick={() => setSelectedEntry(entry)} className="flex items-center gap-4 group/pilot text-left">
                                                                        {isTeamMember && (
                                                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-racing-blue/20 to-racing-orange/20 border border-white/10 p-1 flex items-center justify-center overflow-hidden">
                                                                                <img src="logo.png" alt="MDT" className="w-full h-full object-contain" />
                                                                            </div>
                                                                        )}
                                                                        <div className="flex flex-col">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`text-sm font-bold uppercase tracking-tight group-hover/pilot:text-wec-cyan transition-colors ${entry.globalPos === 1 ? 'text-white' : (isLocalPlayer ? 'text-wec-blue' : 'text-white/60')}`}>{entry.name}</span>
                                                                                {isTeamMember && <span className="px-1.5 py-0.5 bg-wec-gold/15 text-wec-gold text-wec-display text-[12px] font-bold uppercase rounded tracking-wider">MDT</span>}
                                                                                {isLocalPlayer && <span className="px-1.5 py-0.5 bg-wec-blue/20 text-wec-cyan text-wec-display text-[12px] font-bold uppercase rounded tracking-wider wec-live-dot">Tú</span>}
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
                                                                        <span className={`text-lg font-bold tracking-tight wec-timing ${entry.globalPos === 1 ? 'text-wec-cyan' : 'text-white/80'}`}>{formatTime(entry.bestLap)}</span>
                                                                        {entry.globalPos > 1 && <span className="text-[9px] font-medium text-wec-red/60 wec-timing">+{formatTime(entry.globalDelta).replace(/^0:/, '')}</span>}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                            })}
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
