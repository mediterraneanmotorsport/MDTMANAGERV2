import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

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

const Leaderboard = ({ gamePath }) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterCircuit, setFilterCircuit] = useState('ALL');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterVersion, setFilterVersion] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const getCategory = (modelStr) => {
        if (!modelStr) return 'OTRO';
        const upper = modelStr.toUpperCase();
        if (upper.includes('HYPER') || upper.includes('LMH') || upper.includes('LMDH') || upper.includes('HY')) return 'HYPERCAR';
        if (upper.includes('GT3') || upper.includes('LMGT3')) return 'GT3';
        if (upper.includes('GTE')) return 'GTE';
        if (upper.includes('LMP2') || upper.includes('P2') || upper.includes('ORECA')) return 'LMP2';
        if (upper.includes('LMP3') || upper.includes('P3')) return 'LMP3';
        if (upper.includes('HYPER') || upper.includes('LMH') || upper.includes('LMDH') || upper.includes('HY') || 
            upper.includes('GLICKENHAUS') || upper.includes('ISOTTA') || upper.includes('VANWALL') || upper.includes('GENESIS') ||
            upper.includes('TOYOTA') || upper.includes('PEUGEOT') || upper.includes('CADILLAC') || 
            upper.includes('499P') || upper.includes('963') || upper.includes('ALPINE') || upper.includes('SC63') || upper.includes('V-SERIES.R')) return 'HYPERCAR';
        return 'OTRO';
    };

    useEffect(() => {
        const syncAndLoadTelemetry = async () => {
            if (!gamePath || !window.electronAPI) {
                setLoading(false);
                return;
            }

            try {
                // 1. Obtener telemetría local
                const allLaps = await window.electronAPI.scanLocalTelemetry({ gamePath });
                
                // Procesar locales (agrupar por circuito, categoría y piloto)
                const localBests = {};
                allLaps.forEach(lap => {
                    const category = getCategory(lap.car);
                    const key = `${lap.circuit}_${category}_${lap.name}`;
                    if (!localBests[key] || lap.bestLap < localBests[key].bestLap) {
                        localBests[key] = { ...lap, category };
                    }
                });

                // Mostrar inmediatamente los datos locales para destrabar la UI
                setEntries(Object.values(localBests));
                setLoading(false);

                // 2. Sincronización en segundo plano (Fuego y Olvido)
                getDocs(collection(db, "lmu_leaderboard")).then(querySnapshot => {
                    const cloudBests = {};
                    querySnapshot.forEach((doc) => {
                        cloudBests[doc.id] = doc.data();
                    });

                    // Fusionar visualmente con lo que ya mostramos
                    const finalBests = { ...localBests };
                    for (const key in cloudBests) {
                        const cloudLap = cloudBests[key];
                        if (!finalBests[key] || cloudLap.bestLap < finalBests[key].bestLap) {
                            finalBests[key] = cloudLap;
                        }
                    }
                    
                    setEntries(Object.values(finalBests));

                    // 3. Subir mis récords si son mejores (en segundo plano)
                    for (const key in localBests) {
                        const lap = localBests[key];
                        if (lap.isPlayer) {
                            const cloudLap = cloudBests[key];
                            if (!cloudLap || lap.bestLap < cloudLap.bestLap) {
                                setDoc(doc(db, "lmu_leaderboard", key), {
                                    circuit: lap.circuit,
                                    category: lap.category,
                                    car: lap.car,
                                    name: lap.name,
                                    bestLap: lap.bestLap,
                                    gameVersion: lap.gameVersion || 'Unknown',
                                    date: lap.date || new Date().toISOString()
                                }).catch(err => console.error("Error silencioso subiendo a Firebase:", err));
                            }
                        }
                    }
                }).catch(dbErr => {
                    console.error("Error de permisos o red leyendo Firebase:", dbErr);
                });

            } catch (err) {
                console.error("Error general sincronizando telemetría", err);
            }
        };

        syncAndLoadTelemetry();
    }, [gamePath]);

    const formatTime = (seconds) => {
        if (!seconds) return '--:--.---';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(3);
        return `${mins}:${secs.padStart(6, '0')}`;
    };



    // Calculate dynamic filter options based on available data
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
        return Array.from(versions).sort((a, b) => b.localeCompare(a)); // sort descending
    }, [entries]);

    const grouped = useMemo(() => {
        let filtered = entries;

        if (filterCircuit !== 'ALL') filtered = filtered.filter(e => e.circuit === filterCircuit);
        if (filterCategory !== 'ALL') filtered = filtered.filter(e => e.category === filterCategory);
        if (filterVersion !== 'ALL') filtered = filtered.filter(e => e.gameVersion === filterVersion);

        const baseGrouped = filtered.reduce((acc, entry) => {
            const circuit = entry.circuit || 'Circuito Desconocido';
            const category = entry.category;

            if (!acc[circuit]) acc[circuit] = {};
            if (!acc[circuit][category]) acc[circuit][category] = [];
            
            acc[circuit][category].push(entry);
            return acc;
        }, {});

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

        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            const finalGrouped = {};
            
            Object.entries(baseGrouped).forEach(([circuit, catObj]) => {
                Object.entries(catObj).forEach(([category, catEntries]) => {
                    const hasMatch = catEntries.some(e => e.name.toLowerCase().includes(q) || e.car.toLowerCase().includes(q));
                    
                    if (hasMatch) {
                        if (!finalGrouped[circuit]) finalGrouped[circuit] = {};
                        finalGrouped[circuit][category] = catEntries;
                    }
                });
            });
            return finalGrouped;
        }

        return baseGrouped;
    }, [entries, filterCircuit, filterCategory, filterVersion, searchQuery]);

    useEffect(() => {
        if (searchQuery.trim() !== '') {
            const highlightTimeout = setTimeout(() => {
                const highlighted = document.querySelector('.search-highlight');
                if (highlighted) {
                    highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
            return () => clearTimeout(highlightTimeout);
        }
    }, [searchQuery, grouped]);

    return (
        <div className="w-full space-y-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between px-4 mt-8 gap-4">
                <div className="flex justify-between items-center px-4 mb-4">
                    <div className="flex flex-col">
                        <h2 className="text-3xl font-black italic tracking-widest text-white uppercase" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.2)' }}>
                            <span className="text-transparent">Global</span> Leaderboard
                        </h2>
                        <span className="text-xs text-racing-blue font-bold tracking-widest uppercase mt-1">
                            Sincronización Activa | {filterVersion !== 'ALL' ? `v${filterVersion}` : 'Todas las versiones'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="mx-4 p-4 liquid-glass rounded-2xl border border-white/10 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto custom-scrollbar pb-2 md:pb-0">
                    <div className="flex flex-col gap-1 shrink-0">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Circuito</label>
                        <select 
                            className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold text-white uppercase focus:border-racing-blue outline-none transition-colors"
                            value={filterCircuit}
                            onChange={(e) => setFilterCircuit(e.target.value)}
                        >
                            <option value="ALL">Todos los Circuitos</option>
                            {availableCircuits.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    
                    <div className="flex flex-col gap-1 shrink-0">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Clase</label>
                        <select 
                            className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold text-white uppercase focus:border-racing-orange outline-none transition-colors"
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                        >
                            <option value="ALL">Todas las Categorías</option>
                            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Versión</label>
                        <select 
                            className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm font-bold text-white uppercase focus:border-racing-success outline-none transition-colors"
                            value={filterVersion}
                            onChange={(e) => setFilterVersion(e.target.value)}
                        >
                            <option value="ALL">Todas las Versiones</option>
                            {availableVersions.map(v => <option key={v} value={v}>v{v}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-1 w-full md:w-64 shrink-0">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Buscar Piloto / Coche</label>
                    <div className="relative">
                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input 
                            type="text" 
                            placeholder="Ej. Valiente, Ferrari..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm font-bold text-white placeholder-zinc-700 focus:border-white/30 outline-none transition-colors"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="w-full py-20 flex flex-col items-center justify-center gap-4">
                    <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-racing-orange animate-spin" />
                    <div className="text-center text-zinc-600 text-[10px] uppercase font-bold tracking-widest animate-pulse">
                        Escaneando base de datos local...
                    </div>
                </div>
            ) : Object.keys(grouped).length === 0 ? (
                <div className="w-full py-20 text-center text-zinc-600 text-sm uppercase font-bold tracking-widest">
                    No se encontraron registros que coincidan con los filtros.
                </div>
            ) : (
                Object.entries(grouped).map(([circuit, categories]) => (
                    <div key={circuit} className="space-y-6">
                        <div className="sticky top-0 z-20 bg-[#0c0c0c]/90 backdrop-blur-md px-4 py-4 border-b border-white/5 flex items-center gap-4">
                            <div className="w-2 h-6 bg-racing-blue rounded-full" />
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(0,112,243,0.3)]">{circuit}</h3>
                        </div>

                        <div className="px-4 space-y-8">
                            {Object.entries(categories).map(([category, catEntries]) => {
                                const categoryLogo = getCategoryLogo(category);
                                return (
                                <div key={category} className="liquid-glass rounded-2xl overflow-hidden border border-white/5 shadow-2xl flex flex-col group hover:border-white/10 transition-all">
                                    
                                    <div className="bg-black/60 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {categoryLogo && <img src={categoryLogo} alt={category} className="h-6 object-contain" />}
                                            <span className="text-lg font-black text-racing-orange uppercase tracking-[0.2em]">{category}</span>
                                            <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] font-bold text-zinc-500 uppercase">{catEntries.length} Pilotos</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 overflow-x-auto">
                                        <table className="w-full text-left border-collapse min-w-[700px]">
                                            <thead>
                                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                                    <th className="px-6 py-4 text-[9px] font-black text-zinc-600 uppercase tracking-widest w-16">Pos</th>
                                                    <th className="px-6 py-4 text-[9px] font-black text-zinc-600 uppercase tracking-widest">Piloto</th>
                                                    <th className="px-6 py-4 text-[9px] font-black text-zinc-600 uppercase tracking-widest">Vehículo</th>
                                                    <th className="px-6 py-4 text-[9px] font-black text-zinc-600 uppercase tracking-widest text-right">Tiempo / Delta</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/[0.02]">
                                                {catEntries.map((entry) => {
                                                    const isMatch = searchQuery.trim() !== '' && (entry.name.toLowerCase().includes(searchQuery.toLowerCase()) || entry.car.toLowerCase().includes(searchQuery.toLowerCase()));
                                                    return (
                                                        <tr 
                                                            key={`${entry.circuit}_${category}_${entry.name}`} 
                                                            className={`transition-all duration-300 ${isMatch ? 'bg-racing-blue/20 border-l-4 border-racing-blue search-highlight' : 'hover:bg-white/[0.04]'}`}
                                                        >
                                                            <td className="px-6 py-4">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black italic text-sm
                                                                    ${entry.globalPos === 1 ? 'bg-racing-orange text-white shadow-[0_0_15px_rgba(255,107,0,0.4)]' : 
                                                                      entry.globalPos === 2 ? 'bg-zinc-300 text-black' : 
                                                                      entry.globalPos === 3 ? 'bg-amber-700 text-white' : 
                                                                      'bg-white/5 text-zinc-500'}`}>
                                                                    {entry.globalPos}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    {entry.globalPos === 1 && <div className="w-1.5 h-1.5 rounded-full bg-racing-success shadow-[0_0_8px_rgba(34,197,94,0.8)]" />}
                                                                    <span className={`text-base font-black uppercase tracking-tight ${entry.globalPos === 1 || isMatch ? 'text-white' : 'text-zinc-300'}`}>
                                                                        {entry.name}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <img src={getCarLogo(entry.car)} alt={entry.car} className="h-6 w-auto max-w-[40px] object-contain opacity-90" />
                                                                    <span className="text-xs text-zinc-400 font-bold uppercase truncate max-w-[200px] inline-block px-3 py-1 bg-white/5 rounded-md">
                                                                        {entry.car}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex flex-col items-end justify-center h-full">
                                                                    <span className={`text-xl font-black italic tracking-tighter tabular-nums leading-none ${entry.globalPos === 1 ? 'text-racing-blue' : 'text-white'}`}>
                                                                        {formatTime(entry.bestLap)}
                                                                    </span>
                                                                    {entry.globalPos > 1 ? (
                                                                        <span className={`text-[11px] font-mono font-bold mt-1 leading-none ${isMatch ? 'text-racing-blue' : 'text-zinc-500'}`}>
                                                                            +{formatTime(entry.globalDelta).replace(/^0:/, '')}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[9px] text-racing-orange font-black uppercase tracking-widest mt-1 leading-none">
                                                                            Pole Position
                                                                        </span>
                                                                    )}
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
                    </div>
                ))
            )}
        </div>
    );
};

export default Leaderboard;
