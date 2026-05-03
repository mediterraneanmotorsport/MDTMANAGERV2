import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import CircuitCard from './CircuitCard';
import SetupList from './SetupList';
import AdminPanel from './AdminPanel';
import Leaderboard from './Leaderboard';
import SetupTweaker from './SetupTweaker';

const NAV_ITEMS = [
    { id: 'circuits', label: 'EXPLORADOR', icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
    )},
    { id: 'leaderboard', label: 'CLASIFICACIÓN', icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h4v11H3zM10 3h4v18h-4zM17 7h4v14h-4z" /></svg>
    )},
    { id: 'tweaker', label: 'MDT IA', icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
    )},
];

const Dashboard = ({ gamePath, onSelectPath, userRole, circuits, categories, allCars, isDataLoaded, nextEvent, userFavorites }) => {
    const [selectedCircuit, setSelectedCircuit] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('GT3');
    const [selectedCar, setSelectedCar] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAdmin, setShowAdmin] = useState(false);
    const [activeView, setActiveView] = useState('circuits');
    const [clearingResults, setClearingResults] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        if (nextEvent && !selectedCar) {
            setSelectedCar(nextEvent.car);
        }
    }, [nextEvent]);

    useEffect(() => {
        if (!selectedCategory && Object.keys(categories).length > 0) {
            const firstCat = Object.keys(categories)[0];
            setSelectedCategory(firstCat);
            setSelectedCar(categories[firstCat][0]);
        }
    }, [categories]);

    const filteredCircuits = (circuits || []).filter(c => {
        const name = (c.name || '').toLowerCase();
        const country = (c.country || '').toLowerCase();
        const search = searchQuery.toLowerCase();
        return name.includes(search) || country.includes(search);
    });

    const handleCategoryChange = (cat) => {
        setSelectedCategory(cat);
        setSelectedCar(categories[cat][0]);
    };

    if (!isDataLoaded) {
        return (
            <div className="flex-1 flex items-center justify-center bg-wec-black">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-wec-blue/20 border-t-wec-cyan rounded-full animate-spin" />
                    <span className="text-wec-display text-[9px] font-bold tracking-[0.4em] text-wec-cyan/50 uppercase">Sincronizando...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-wec-black overflow-hidden relative">
            {/* ── BACKGROUND EFFECTS ── */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute inset-0 wec-grid-pattern opacity-20" />
                <div className="absolute top-[-15%] left-[-5%] w-[35%] h-[35%] bg-wec-blue/8 blur-[180px]" />
                <div className="absolute bottom-[-15%] right-[-5%] w-[30%] h-[30%] bg-wec-cyan/5 blur-[150px]" />
            </div>

            {/* ── WEC LEFT NAV RAIL ── */}
            <nav className={`shrink-0 h-full bg-wec-void/80 border-r border-wec-border flex flex-col z-50 transition-all duration-500 ${sidebarCollapsed ? 'w-16' : 'w-72'}`}>
                {/* Logo */}
                <div className={`flex items-center border-b border-wec-border shrink-0 ${sidebarCollapsed ? 'p-3 justify-center' : 'p-5 gap-4'}`}>
                    <img src="logo.png" alt="MDT" className={`shrink-0 drop-shadow-[0_0_15px_rgba(0,144,255,0.3)] transition-all ${sidebarCollapsed ? 'w-8' : 'w-10'}`} />
                    {!sidebarCollapsed && (
                        <div className="min-w-0">
                            <div className="text-wec-display text-[11px] font-bold text-white tracking-[0.15em]">MDT <span className="text-wec-cyan">WEC</span></div>
                            <div className="text-[9px] text-white/20 font-medium tracking-wider">Setup Manager</div>
                        </div>
                    )}
                    <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`p-1.5 hover:bg-white/5 rounded transition-all ${sidebarCollapsed ? '' : 'ml-auto'}`}>
                        <svg className={`w-3.5 h-3.5 text-white/30 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                    </button>
                </div>

                {/* Nav Tabs */}
                <div className={`border-b border-wec-border shrink-0 ${sidebarCollapsed ? 'p-2 space-y-1' : 'p-3 space-y-1'}`}>
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={`w-full flex items-center gap-3 rounded-lg transition-all duration-300
                                ${sidebarCollapsed ? 'p-2.5 justify-center' : 'px-4 py-3'}
                                ${activeView === item.id 
                                    ? 'bg-wec-blue/10 text-wec-cyan border border-wec-blue/20' 
                                    : 'text-white/30 hover:text-white/60 hover:bg-white/3 border border-transparent'}`}
                        >
                            <span className={activeView === item.id ? 'text-wec-cyan' : ''}>{item.icon}</span>
                            {!sidebarCollapsed && (
                                <span className="text-wec-display text-[9px] font-bold tracking-[0.15em]">{item.label}</span>
                            )}
                            {!sidebarCollapsed && activeView === item.id && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-wec-cyan wec-live-dot" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Sidebar Content (only when expanded) */}
                {!sidebarCollapsed && (
                    <div className="flex-1 overflow-y-auto wec-scrollbar px-4 py-5 space-y-6">
                        {/* Next Event */}
                        {nextEvent && (
                            <section>
                                <div className="wec-label mb-3 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-wec-green wec-live-dot" />
                                    Próximo Evento
                                </div>
                                <div className="wec-glass rounded-lg p-4 border-l-2 border-l-wec-gold hover:border-l-wec-cyan transition-colors cursor-pointer group">
                                    <div className="text-sm font-bold text-white uppercase tracking-tight leading-tight mb-1.5">{nextEvent.circuitName}</div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-wec-display text-[7px] font-bold bg-wec-gold/15 text-wec-gold px-2 py-0.5 rounded">{nextEvent.car}</span>
                                        <span className="text-[10px] text-white/25 font-medium" style={{ fontFamily: 'var(--font-data)' }}>{nextEvent.date}</span>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Category Filter */}
                        <section>
                            <div className="wec-label mb-3">Filtro de Clase</div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {Object.keys(categories).map(cat => {
                                    const catKey = cat.toUpperCase().trim();
                                    let logo = "";
                                    if (catKey.includes("HYPERCAR") || catKey === "HY") logo = "HY.png";
                                    else if (catKey.includes("GT3") || catKey.includes("LMGT3")) logo = "GT3.png";
                                    else if (catKey.includes("GTE")) logo = "GTE.png";
                                    else if (catKey.includes("LMP2")) logo = "LMP2.png";
                                    else if (catKey.includes("LMP3")) logo = "LMP3.jpg";

                                    return (
                                        <button
                                            key={cat}
                                            onClick={() => handleCategoryChange(cat)}
                                            className={`flex flex-col items-center justify-center aspect-square rounded-lg border transition-all duration-300
                                                ${selectedCategory === cat
                                                    ? 'bg-wec-blue/10 border-wec-blue/30 shadow-[0_0_15px_rgba(0,144,255,0.1)]'
                                                    : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.02]'}`}
                                        >
                                            {logo && (
                                                <img
                                                    src={`/assets/logos/categories/${logo}`}
                                                    alt=""
                                                    className={`w-7 h-auto mb-1.5 transition-all duration-300 ${selectedCategory === cat ? 'scale-110 opacity-100' : 'grayscale opacity-25 group-hover:opacity-60'}`}
                                                />
                                            )}
                                            <span className={`text-wec-display text-[7px] font-bold uppercase tracking-wider ${selectedCategory === cat ? 'text-wec-cyan' : 'text-white/25'}`}>
                                                {cat}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Car Selection */}
                        <section>
                            <div className="wec-label mb-3">Vehículo</div>
                            <div className="flex flex-col gap-1">
                                {categories[selectedCategory]?.map(car => {
                                    const carName = car.toLowerCase();
                                    let logoFile = "";
                                    const brandMap = {
                                        "alpine": "Alpine.png", "aston": "Aston Martin.png", "bmw": "BMW.png",
                                        "cadillac": "Cadillac.png", "corvette": "Corvette.png", "duqueine": "Duqueine.png",
                                        "ferrari": "Ferrari.png", "ford": "Ford.png", "glickenhaus": "Glickenhaus.png",
                                        "isotta": "Isotta Fraschini.png", "lambor": "Lamborghini.png", "lexus": "Lexus.png",
                                        "ligier": "Ligier.png", "mclaren": "McLaren.png", "mercedes": "Mercedes-AMG.png",
                                        "oreca": "Oreca.png", "peugeot": "Peugeot.png", "porsche": "Porsche.png",
                                        "toyota": "Toyota.png", "vanwall": "Vanwall.png"
                                    };
                                    for (const [key, file] of Object.entries(brandMap)) {
                                        if (carName.includes(key)) { logoFile = file; break; }
                                    }

                                    return (
                                        <button
                                            key={car}
                                            onClick={() => setSelectedCar(car)}
                                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-300
                                                ${selectedCar === car
                                                    ? 'bg-wec-gold/10 border-wec-gold/30 text-white'
                                                    : 'bg-transparent border-transparent hover:bg-white/[0.02] text-white/30 hover:text-white/60'}`}
                                        >
                                            <div className={`w-5 h-5 flex items-center justify-center shrink-0 rounded overflow-hidden ${selectedCar === car ? 'bg-wec-gold/10' : 'bg-white/5'}`}>
                                                {logoFile ? (
                                                    <img src={`/assets/logos/cars/${logoFile}`} alt="" className={`w-full h-auto ${selectedCar === car ? 'brightness-150 opacity-100' : 'opacity-30'}`} />
                                                ) : (
                                                    <div className="w-2 h-2 rounded-full bg-white/10" />
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider truncate">{car}</span>
                                            {selectedCar === car && <div className="ml-auto w-1 h-3 bg-wec-gold rounded-full" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                )}

                {/* Bottom Actions */}
                <div className={`border-t border-wec-border shrink-0 ${sidebarCollapsed ? 'p-2' : 'p-4 space-y-2'}`}>
                    {!sidebarCollapsed && userRole?.toLowerCase() === 'admin' && (
                        <button
                            onClick={() => setShowAdmin(true)}
                            className="w-full px-4 py-3 bg-gradient-to-r from-wec-orange to-wec-red rounded-lg text-wec-display text-[8px] font-bold uppercase tracking-[0.2em] text-white transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Modo Admin
                        </button>
                    )}

                    {!sidebarCollapsed && (
                        <button
                            id="btn-depurar-results"
                            disabled={clearingResults || !gamePath}
                            onClick={async () => {
                                if (!gamePath) { alert('⚠️ Ruta del juego no configurada.'); return; }
                                if (!window.confirm('🗑️ ¿Eliminar archivos XML de Results?\n\nLos tiempos subidos al servidor no se verán afectados.')) return;
                                setClearingResults(true);
                                try {
                                    const result = await window.electronAPI.clearResultsFolder({ gamePath });
                                    if (result.error) alert(`⚠️ ${result.error}`);
                                    else alert(`✅ ${result.deleted} archivo(s) eliminados.`);
                                } catch (err) { alert('❌ Error: ' + err.message); }
                                finally { setClearingResults(false); }
                            }}
                            className={`w-full px-4 py-2.5 rounded-lg text-wec-display text-[8px] font-bold uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 border
                                ${clearingResults ? 'bg-white/3 border-white/5 text-white/20 cursor-not-allowed' : 'bg-wec-red/5 border-wec-red/15 text-wec-red/60 hover:bg-wec-red hover:text-white hover:border-wec-red'}`}
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            {clearingResults ? 'Limpiando...' : 'Depurar Results'}
                        </button>
                    )}

                    <div className={`flex gap-1 ${sidebarCollapsed ? 'flex-col' : ''}`}>
                        <button onClick={onSelectPath} className={`flex-1 text-wec-display text-[7px] uppercase font-bold tracking-wider text-white/20 hover:text-white/50 border border-white/5 rounded-lg transition-all hover:bg-white/3 ${sidebarCollapsed ? 'p-2.5' : 'px-3 py-2'}`}>
                            {sidebarCollapsed ? '⚙' : 'Ajustes'}
                        </button>
                        <button onClick={() => auth.signOut()} className={`text-wec-display text-[7px] uppercase font-bold tracking-wider text-wec-red/30 hover:text-wec-red hover:bg-wec-red/5 rounded-lg transition-all border border-transparent hover:border-wec-red/20 ${sidebarCollapsed ? 'p-2.5' : 'px-3 py-2'}`}>
                            {sidebarCollapsed ? '✕' : 'Salir'}
                        </button>
                    </div>
                </div>
            </nav>

            {/* ── MAIN CONTENT ── */}
            <main className="flex-1 flex flex-col relative z-10 overflow-hidden">
                {/* Content Area */}
                <div className="flex-1 w-full relative overflow-y-auto wec-scrollbar">
                    {/* ── CIRCUITS VIEW ── */}
                    {activeView === 'circuits' && (
                        <div className="wec-enter px-8 lg:px-12 pb-12">
                            <header className="py-8">
                                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1 h-6 bg-wec-blue rounded-full" />
                                            <span className="text-wec-display text-[9px] text-wec-blue font-bold tracking-[0.3em] uppercase">Base de Datos</span>
                                        </div>
                                        <h1 className="text-4xl lg:text-5xl font-bold text-white uppercase tracking-tight leading-none" style={{ fontFamily: 'var(--font-body)' }}>
                                            MDT MOTORSPORT <span className="text-wec-cyan">SETUPS</span>
                                        </h1>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-wec-display text-[8px] font-bold bg-wec-gold/10 text-wec-gold px-3 py-1 rounded border border-wec-gold/20 tracking-wider">
                                                {selectedCar || 'Sin Selección'}
                                            </span>
                                            <span className="text-white/10 text-xs">/</span>
                                            <span className="text-wec-display text-[8px] font-bold text-white/25 tracking-wider uppercase">{selectedCategory}</span>
                                        </div>
                                    </div>

                                    {/* Search */}
                                    <div className="w-full lg:w-80 relative group">
                                        <input 
                                            type="text"
                                            placeholder="Buscar circuito..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-wec-surface/50 border border-white/5 rounded-lg px-10 py-3.5 text-sm focus:outline-none focus:border-wec-blue/30 transition-all text-white placeholder:text-white/15"
                                            style={{ fontFamily: 'var(--font-data)' }}
                                        />
                                        <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/15 group-focus-within:text-wec-blue transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                </div>
                                <div className="h-px w-full bg-gradient-to-r from-wec-blue/20 via-white/5 to-transparent mt-6" />
                            </header>

                            {filteredCircuits.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                                    {filteredCircuits.map((circuit, idx) => (
                                        <div key={circuit.id} className="wec-enter" style={{ animationDelay: `${idx * 0.04}s` }}>
                                            <CircuitCard
                                                circuit={circuit}
                                                isSelected={selectedCircuit?.id === circuit.id}
                                                onClick={() => setSelectedCircuit(circuit)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-[50vh] flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 rounded-xl border border-dashed border-white/10 flex items-center justify-center mb-5">
                                        <svg className="w-7 h-7 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <p className="text-wec-display text-[9px] font-bold text-white/15 uppercase tracking-[0.3em]">Sin resultados</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── LEADERBOARD VIEW ── */}
                    {activeView === 'leaderboard' && (
                        <div className="wec-enter px-8 lg:px-12">
                            <Leaderboard 
                                selectedCircuit={selectedCircuit || circuits[0]} 
                                selectedCategory={selectedCategory}
                                categories={categories}
                                gamePath={gamePath}
                            />
                        </div>
                    )}

                    {/* ── TWEAKER VIEW ── */}
                    {activeView === 'tweaker' && (
                        <div className="wec-enter px-8 lg:px-12">
                            <SetupTweaker gamePath={gamePath} />
                        </div>
                    )}
                </div>
            </main>

            {/* ── SETUP LIST PANEL ── */}
            {selectedCircuit && (
                <div className="fixed inset-0 z-[200] flex justify-end md:p-6 lg:p-10 pointer-events-none">
                    <div className="pointer-events-auto h-full">
                        <SetupList
                            circuit={selectedCircuit}
                            car={selectedCar}
                            onClose={() => setSelectedCircuit(null)}
                            userRole={userRole}
                            gamePath={gamePath}
                            userFavorites={userFavorites}
                        />
                    </div>
                </div>
            )}

            {/* ── ADMIN PANEL ── */}
            {showAdmin && (
                <div className="fixed inset-0 z-[300] bg-wec-black/90 backdrop-blur-xl flex items-center justify-center p-6">
                    <div className="w-full max-w-6xl h-[90vh] wec-glass rounded-2xl overflow-hidden relative">
                        <button 
                            onClick={() => setShowAdmin(false)}
                            style={{ WebkitAppRegion: 'no-drag' }}
                            className="absolute top-6 right-6 z-50 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-white/30 hover:text-white"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <AdminPanel 
                            onClose={() => setShowAdmin(false)} 
                            circuits={circuits}
                            cars={allCars}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
