import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import CircuitCard from './CircuitCard';
import SetupList from './SetupList';
import AdminPanel from './AdminPanel';
import Leaderboard from './Leaderboard';

const Dashboard = ({ gamePath, onSelectPath, userRole, circuits, categories, allCars, isDataLoaded, nextEvent, userFavorites }) => {
    const [selectedCircuit, setSelectedCircuit] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('GT3');
    const [selectedCar, setSelectedCar] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAdmin, setShowAdmin] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeView, setActiveView] = useState('circuits'); // 'circuits' or 'leaderboard'

    // Auto-highlight based on next event
    useEffect(() => {
        if (nextEvent && !selectedCar) {
            setSelectedCar(nextEvent.car);
            // If the circuit exists, we might want to highlight it but let's keep it subtle
        }
    }, [nextEvent]);

    // Dynamic selection sync
    useEffect(() => {
        if (!selectedCategory && Object.keys(categories).length > 0) {
            const firstCat = Object.keys(categories)[0];
            setSelectedCategory(firstCat);
            setSelectedCar(categories[firstCat][0]);
        }
    }, [categories]);

    // Derived State
    const filteredCircuits = (circuits || []).filter(c => {
        const name = (c.name || '').toLowerCase();
        const country = (c.country || '').toLowerCase();
        const search = searchQuery.toLowerCase();
        return name.includes(search) || country.includes(search);
    });

    const handleCategoryChange = (cat) => {
        setSelectedCategory(cat);
        setSelectedCar(categories[cat][0]);
        // Auto-close on small screens
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
    };

    if (!isDataLoaded) {
        return (
            <div className="flex-1 flex items-center justify-center bg-racing-black">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-racing-blue/20 border-t-racing-blue rounded-full animate-spin" />
                    <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Sincronizando Base de Datos...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-racing-black overflow-hidden relative selection:bg-racing-blue/30">
            {/* Immersive Background Elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-racing-blue/10 blur-[150px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-racing-orange/5 blur-[150px]" />
                <div className="absolute inset-0 racing-stripes opacity-30" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,5,0.8)_100%)]" />
            </div>

            {/* Main Content Area */}
            <main className={`flex-1 flex flex-col relative z-10 transition-all duration-700 ${isSidebarOpen ? 'lg:pl-80' : 'pl-0'}`}>

                {/* Floating Top Nav (Draggable Area) */}
                <nav className="h-24 px-8 flex items-center justify-between pointer-events-none select-none" style={{ WebkitAppRegion: 'drag' }}>
                    <div className="flex items-center gap-6 pointer-events-auto" style={{ WebkitAppRegion: 'no-drag' }}>
                        <button 
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-3 liquid-glass rounded-xl hover:text-racing-blue transition-all group"
                        >
                            <svg className={`w-6 h-6 transition-transform duration-500 ${isSidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                        </button>
                        <div className="h-10 w-px bg-white/10 hidden md:block" />
                        <div className="hidden md:block">
                            <h2 className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.3em] mb-1 opacity-60">ESTADO</h2>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-racing-success animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-racing-success">Telemetría Conectada</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pointer-events-auto" style={{ WebkitAppRegion: 'no-drag' }}>
                         <div className="hidden lg:flex liquid-glass px-6 py-2 rounded-2xl items-center gap-6">
                            <div className="text-right">
                                <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none">Perfil de Piloto</div>
                                <div className="text-xs font-black text-white mt-1 uppercase tracking-tighter italic">{auth.currentUser?.displayName || 'Desconocido'}</div>
                            </div>
                            <div className="h-8 w-px bg-white/10" />
                            <span className="px-3 py-1 bg-racing-blue/10 border border-racing-blue/30 rounded-md text-[9px] font-black text-racing-blue uppercase tracking-widest">
                                {userRole}
                            </span>
                         </div>
                    </div>
                </nav>

                {/* Immersive Circuit Explorer */}
                <div className="flex-1 overflow-y-auto px-8 lg:px-12 pb-12 custom-scrollbar">
                    <header className="mb-12 mt-4 motion-blur-in">
                        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/5 pb-10">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <span className="w-12 h-1 bg-racing-blue rounded-full" />
                                    <span className="text-[10px] text-racing-blue font-black tracking-[0.4em] uppercase">Base de Datos de Setups</span>
                                </div>
                                <h1 className="text-5xl lg:text-7xl text-racing-italic bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-zinc-700">
                                    MDT MOTORSPORT <span className="text-racing-blue">SETUPS</span>
                                </h1>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="px-4 py-1.5 liquid-glass rounded-lg text-[10px] font-black uppercase tracking-widest text-racing-orange">
                                        {selectedCar || 'Esperando Selección...'}
                                    </span>
                                    <span className="text-zinc-600 font-black">/</span>
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                        {selectedCategory}
                                    </span>
                                </div>
                            </div>

                            <div className="w-full lg:w-96 relative group">
                                <input 
                                    type="text"
                                    placeholder="Buscador de Circuitos..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full liquid-glass rounded-2xl px-12 py-5 text-sm focus:outline-none focus:ring-4 focus:ring-racing-blue/10 transition-all font-medium placeholder:text-zinc-600 text-white select-text"
                                />
                                <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-racing-blue transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                    </header>

                    {activeView === 'circuits' ? (
                        <>
                            {filteredCircuits.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-10">
                                    {filteredCircuits.map((circuit, idx) => (
                                        <div key={circuit.id} className="motion-blur-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                                            <CircuitCard
                                                circuit={circuit}
                                                isSelected={selectedCircuit?.id === circuit.id}
                                                onClick={() => setSelectedCircuit(circuit)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-[50vh] flex flex-col items-center justify-center text-center motion-blur-in">
                                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6">
                                        <svg className="w-10 h-10 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 3.536L5.636 12.728M12 12V3m0 18v-9" /></svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-zinc-500 mb-2">No se detectan circuitos</h3>
                                    <p className="text-zinc-700 max-w-xs text-sm uppercase tracking-widest font-black opacity-50">Modifica los criterios de búsqueda para re-analizar</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="motion-blur-in">
                            <Leaderboard 
                                selectedCircuit={selectedCircuit || circuits[0]} 
                                selectedCategory={selectedCategory}
                                categories={categories}
                                gamePath={gamePath}
                            />
                        </div>
                    )}
                </div>
            </main>

            {/* Sidebar Overlay (Mobile) */}
            {isSidebarOpen && (
                <div className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[80]" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* High-Tech Liquid Glass Sidebar */}
            <aside className={`
                fixed top-0 bottom-0 left-0 w-80 liquid-glass z-[100] flex flex-col transition-all duration-500 ease-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Brand Header */}
                <div className="p-8 pb-4 flex flex-col items-center relative overflow-hidden group">
                    <div className="absolute inset-0 shimmer-bg opacity-20 pointer-events-none" />
                    <img src="logo.png" alt="MDT" className="w-24 h-auto drop-shadow-[0_0_25px_rgba(0,112,243,0.3)] hover:scale-110 transition-transform cursor-pointer relative z-10" />
                    
                    {/* Navigation Tabs */}
                    <div className="flex w-full mt-10 p-1 bg-black/40 rounded-xl border border-white/5 gap-1">
                        <button 
                            onClick={() => setActiveView('circuits')}
                            className={`flex-1 py-3 px-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-2
                                ${activeView === 'circuits' ? 'bg-racing-blue text-white shadow-lg shadow-racing-blue/20' : 'text-zinc-500 hover:text-white'}`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Circuitos
                        </button>
                        <button 
                            onClick={() => setActiveView('leaderboard')}
                            className={`flex-1 py-3 px-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-2 relative
                                ${activeView === 'leaderboard' ? 'bg-racing-orange text-white shadow-lg shadow-racing-orange/20' : 'text-zinc-500 hover:text-white'}`}
                        >
                            <div className="absolute top-0 right-0 -mr-1 -mt-1 w-2 h-2 bg-racing-success rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            MDT LIVE
                        </button>
                    </div>

                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mt-8" />
                </div>

                {/* Content Section */}
                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar flex flex-col gap-10">

                    {nextEvent && (
                        <section className="relative overflow-hidden group">
                            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-racing-blue/10 rounded-full blur-2xl group-hover:bg-racing-blue/20 transition-all" />
                            <h2 className="text-[9px] text-racing-blue font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-racing-blue animate-pulse" />
                                Calendario en Vivo
                            </h2>
                            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-racing-blue/30 transition-all cursor-pointer">
                                <div className="text-white font-black text-sm uppercase italic tracking-tighter mb-2 line-clamp-1">{nextEvent.circuitName}</div>
                                <div className="flex items-center gap-3">
                                    <div className="px-2 py-0.5 bg-racing-blue/20 text-racing-blue text-[8px] font-black rounded uppercase">{nextEvent.car}</div>
                                    <div className="text-[10px] text-zinc-500 font-mono">{nextEvent.date}</div>
                                </div>
                            </div>
                        </section>
                    )}

                    <section>
                        <h2 className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.4em] mb-4 opacity-50">Filtro de Clase</h2>
                        <div className="grid grid-cols-2 gap-2">
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
                                        className={`group relative flex flex-col items-center justify-center aspect-square rounded-2xl border transition-all duration-500 overflow-hidden
                                            ${selectedCategory === cat
                                                ? 'bg-racing-blue/20 border-racing-blue shadow-[0_0_20px_rgba(0,112,243,0.1)]'
                                                : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.03]'}`}
                                    >
                                        {logo && (
                                            <img
                                                src={`/assets/logos/categories/${logo}`}
                                                alt=""
                                                className={`w-8 h-auto mb-2 transition-all duration-500 ${selectedCategory === cat ? 'scale-110' : 'grayscale opacity-30 group-hover:opacity-100 group-hover:grayscale-0'}`}
                                            />
                                        )}
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${selectedCategory === cat ? 'text-white' : 'text-zinc-600'}`}>
                                            {cat}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="mb-6">
                        <h2 className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.4em] mb-4 opacity-50">Selección de Vehículo</h2>
                        <div className="flex flex-col gap-2">
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
                                        onClick={() => {
                                            setSelectedCar(car);
                                            if (window.innerWidth < 1024) setIsSidebarOpen(false);
                                        }}
                                        className={`group px-5 py-4 rounded-2xl border transition-all duration-300 flex items-center gap-4
                                            ${selectedCar === car
                                                ? 'bg-racing-orange shadow-[0_0_30px_rgba(255,87,34,0.3)] border-racing-orange text-white'
                                                : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.03] text-zinc-500 hover:text-white'}`}
                                    >
                                        <div className={`w-6 h-6 flex items-center justify-center shrink-0 p-1 rounded-full bg-white/10 group-hover:bg-white/20 transition-all ${selectedCar === car ? 'bg-black/20' : ''}`}>
                                            {logoFile ? (
                                                <img
                                                    src={`/assets/logos/cars/${logoFile}`}
                                                    alt=""
                                                    className={`w-full h-auto brightness-200 contrast-125 ${selectedCar === car ? 'opacity-100 scale-110' : 'opacity-40'}`}
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-zinc-800 rounded-full" />
                                            )}
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest truncate">{car}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>

                {/* Tactical Footer */}
                <div className="p-8 border-t border-white/5 space-y-4 bg-black/20">
                    {userRole?.toLowerCase() === 'admin' && (
                        <button
                            onClick={() => setShowAdmin(true)}
                            className="w-full px-5 py-5 bg-gradient-to-r from-racing-orange to-red-600 hover:scale-[1.02] active:scale-95 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-racing-orange/30 group mb-2"
                        >
                            <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Modo Comandante
                        </button>
                    )}

                    <div className="flex items-center gap-2">
                        <button onClick={onSelectPath} className="flex-1 px-4 py-3 text-[8px] uppercase font-black tracking-widest text-zinc-500 hover:text-white border border-white/5 rounded-xl transition-all hover:bg-white/5">Ajustes</button>
                        <button onClick={() => auth.signOut()} className="px-4 py-3 text-[8px] uppercase font-black tracking-widest text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20">Salir</button>
                    </div>
                </div>
            </aside>

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

            {showAdmin && (
                <div className="fixed inset-0 z-[300] bg-racing-black/90 backdrop-blur-xl flex items-center justify-center p-6">
                    <div className="w-full max-w-6xl h-[90vh] liquid-glass rounded-[40px] overflow-hidden border-white/5 relative">
                        <button 
                            onClick={() => setShowAdmin(false)}
                            style={{ WebkitAppRegion: 'no-drag' }}
                            className="absolute top-8 right-8 z-50 p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-zinc-500 hover:text-white"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
