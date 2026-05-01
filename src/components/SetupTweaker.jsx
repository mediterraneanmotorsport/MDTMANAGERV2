import React, { useState, useEffect } from 'react';

const SetupTweaker = ({ gamePath }) => {
    const [circuits, setCircuits] = useState([]);
    const [selectedCircuit, setSelectedCircuit] = useState('');
    const [selectedCar, setSelectedCar] = useState('');
    const [setups, setSetups] = useState([]);
    const [selectedSetup, setSelectedSetup] = useState('');
    const [vehicleType, setVehicleType] = useState('GT3');
    const [problem, setProblem] = useState('');
    const [intensity, setIntensity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });

    // Cargar circuitos locales (carpetas en Settings)
    useEffect(() => {
        if (!gamePath) return;
        const loadCircuits = async () => {
            try {
                const settingsPath = `${gamePath}\\UserData\\player\\Settings`;
                const folders = await window.electronAPI.getDirectoryContents({ path: settingsPath, type: 'folders' });
                setCircuits(folders || []);
            } catch (err) {
                console.error("Error loading circuits for tweaker:", err);
            }
        };
        loadCircuits();
    }, [gamePath]);

    // Cargar coches para el circuito seleccionado
    const [availableCars, setAvailableCars] = useState([]);
    useEffect(() => {
        if (!selectedCircuit || !gamePath) return;
        const loadCars = async () => {
            try {
                const circuitPath = `${gamePath}\\UserData\\player\\Settings\\${selectedCircuit}`;
                const folders = await window.electronAPI.getDirectoryContents({ path: circuitPath, type: 'folders' });
                
                if (folders && folders.length > 0) {
                    setAvailableCars(folders);
                    setSelectedCar('');
                } else {
                    // Si no hay carpetas, quizás los setups están directamente aquí
                    setAvailableCars(['[Directo en Circuito]']);
                    setSelectedCar('[Directo en Circuito]');
                }
                setSetups([]);
            } catch (err) {
                console.error("Error loading cars for circuit:", err);
            }
        };
        loadCars();
    }, [selectedCircuit, gamePath]);

    // Cargar setups (.svm) para el coche seleccionado
    useEffect(() => {
        if (!selectedCar || !selectedCircuit || !gamePath) return;
        const loadSetups = async () => {
            try {
                let carPath = '';
                if (selectedCar === '[Directo en Circuito]') {
                    carPath = `${gamePath}\\UserData\\player\\Settings\\${selectedCircuit}`;
                } else {
                    carPath = `${gamePath}\\UserData\\player\\Settings\\${selectedCircuit}\\${selectedCar}`;
                }
                
                const files = await window.electronAPI.getDirectoryContents({ path: carPath, type: 'files', filter: '.svm' });
                setSetups(files || []);
                setSelectedSetup('');
            } catch (err) {
                console.error("Error loading setups:", err);
            }
        };
        loadSetups();
    }, [selectedCar, selectedCircuit, gamePath]);

    const problems = [
        { id: 'understeer_entry', label: '1. Subviraje en entrada (No gira)', icon: '󰒲' },
        { id: 'oversteer_exit', label: '2. Sobreviraje en salida (Trompos)', icon: '󰈸' },
        { id: 'braking', label: '3. Inestabilidad en frenada', icon: '󰓡' },
        { id: 'top_speed', label: '4. Falta de velocidad punta', icon: '󱐋' },
        { id: 'bumpy', label: '5. Coche muy saltarín o nervioso', icon: '󱐌' },
        { id: 'tire_wear', label: '6. Desgaste / Sobrecalentamiento Trasero', icon: '󰔏' },
        { id: 'understeer_apex', label: '7. Subviraje en mitad de curva', icon: '󰒲' },
        { id: 'sluggish', label: '8. Perezoso en cambios de dirección', icon: '󰓡' },
        { id: 'front_locking', label: '9. Bloqueo constante de frenos del.', icon: '󰓏' },
        { id: 'traction', label: '10. Falta de tracción mecánica (Lentas)', icon: '󰓞' }
    ];

    const handleTweak = async () => {
        if (!selectedSetup || !problem) return;
        setLoading(true);
        setStatus({ type: '', msg: '' });

        try {
            let baseDir = '';
            if (selectedCar === '[Directo en Circuito]') {
                baseDir = `${gamePath}\\UserData\\player\\Settings\\${selectedCircuit}`;
            } else {
                baseDir = `${gamePath}\\UserData\\player\\Settings\\${selectedCircuit}\\${selectedCar}`;
            }

            const filePath = `${baseDir}\\${selectedSetup}`;
            const content = await window.electronAPI.readSetupFile(filePath);
            
            if (!content) throw new Error("No se pudo leer el archivo");

            let newContent = content;
            const lines = newContent.split('\n');
            const newLines = [...lines];

            const modifyParam = (param, delta, section = null) => {
                let startIndex = 0;
                let endIndex = newLines.length;

                if (section) {
                    const secStart = newLines.findIndex(l => l.trim() === `[${section}]`);
                    if (secStart === -1) return false;
                    startIndex = secStart;
                    // End is next section or file end
                    const nextSec = newLines.findIndex((l, i) => i > startIndex && l.startsWith('[') && l.endsWith(']'));
                    endIndex = nextSec === -1 ? newLines.length : nextSec;
                }

                let found = false;
                for (let i = startIndex; i < endIndex; i++) {
                    if (newLines[i].startsWith(param + '=')) {
                        const parts = newLines[i].split('=');
                        const valParts = parts[1].split('//');
                        let currentVal = parseInt(valParts[0]);
                        if (!isNaN(currentVal)) {
                            const newVal = currentVal + delta;
                            newLines[i] = `${param}=${newVal}//${newVal}`;
                            found = true;
                            if (section) break; // Only first one in section
                        }
                    }
                }
                return found;
            };

            const modifyAll = (param, delta, sections) => {
                sections.forEach(s => modifyParam(param, delta, s));
            };

            const mult = intensity;

            switch (problem) {
                case 'understeer_entry':
                    modifyParam('RearBrakeSetting', -1 * mult);
                    modifyParam('FrontAntiSwaySetting', -1 * mult);
                    modifyParam('DiffCoastSetting', -1 * mult);
                    modifyParam('DiffPreloadSetting', -2 * mult);
                    modifyParam('Front3rdSpringSetting', -1 * mult);
                    modifyParam('FrontToeInSetting', -1 * mult);
                    modifyAll('SlowReboundSetting', 1 * mult, ['FRONTLEFT', 'FRONTRIGHT']);
                    if (mult >= 2) {
                        modifyAll('RideHeightSetting', -(mult - 1), ['FRONTLEFT', 'FRONTRIGHT']);
                    }
                    break;

                case 'oversteer_exit':
                    modifyParam('RearBrakeSetting', 1 * mult);
                    modifyParam('DiffCoastSetting', 1 * mult);
                    modifyParam('DiffPreloadSetting', 2 * mult);
                    modifyParam('Rear3rdSpringSetting', -1 * mult);
                    modifyParam('RearToeInSetting', 1 * mult);
                    modifyAll('SlowBumpSetting', 1 * mult, ['REARLEFT', 'REARRIGHT']);
                    modifyAll('FastBumpSetting', -1 * mult, ['REARLEFT', 'REARRIGHT']);
                    break;

                case 'braking':
                    modifyParam('RearBrakeSetting', 1 * mult);
                    modifyParam('DiffCoastSetting', 1 * mult);
                    modifyParam('DiffPreloadSetting', 5 * mult);
                    modifyParam('Front3rdSpringSetting', 1 * mult);
                    modifyParam('RearToeInSetting', 1 * mult);
                    modifyAll('SlowReboundSetting', 1 * mult, ['REARLEFT', 'REARRIGHT']);
                    if (mult >= 2) {
                        modifyAll('RideHeightSetting', -(mult - 1), ['REARLEFT', 'REARRIGHT']);
                    }
                    break;

                case 'top_speed':
                    modifyParam('RWSetting', -1 * mult);
                    modifyParam('Front3rdSpringSetting', 1 * mult);
                    modifyParam('Rear3rdSpringSetting', 1 * mult);
                    modifyParam('FrontToeInSetting', 1 * mult);
                    modifyParam('RearToeInSetting', -1 * mult);
                    if (mult >= 2) {
                        modifyAll('RideHeightSetting', -(mult - 1), ['REARLEFT', 'REARRIGHT']);
                    }
                    modifyParam('BrakeDuctSetting', -1 * mult);
                    modifyParam('BrakeDuctRearSetting', -1 * mult);
                    if (mult === 3) {
                        modifyAll('CamberSetting', 2, ['FRONTLEFT', 'FRONTRIGHT', 'REARLEFT', 'REARRIGHT']);
                    }
                    break;

                case 'bumpy':
                    modifyAll('SlowBumpSetting', -1 * mult, ['FRONTLEFT', 'FRONTRIGHT', 'REARLEFT', 'REARRIGHT']);
                    modifyAll('FastBumpSetting', -2 * mult, ['FRONTLEFT', 'FRONTRIGHT', 'REARLEFT', 'REARRIGHT']);
                    modifyAll('FastReboundSetting', -1 * mult, ['FRONTLEFT', 'FRONTRIGHT', 'REARLEFT', 'REARRIGHT']);
                    modifyParam('Front3rdSpringSetting', -1 * mult);
                    modifyParam('Rear3rdSpringSetting', -1 * mult);
                    if (mult >= 2) {
                        modifyAll('SpringSetting', -5 * (mult - 1), ['FRONTLEFT', 'FRONTRIGHT', 'REARLEFT', 'REARRIGHT']);
                        modifyAll('PackerSetting', -1 * (mult - 1), ['FRONTLEFT', 'FRONTRIGHT', 'REARLEFT', 'REARRIGHT']);
                    }
                    break;

                case 'tire_wear':
                    modifyAll('SpringSetting', -5 * mult, ['REARLEFT', 'REARRIGHT']);
                    modifyParam('DiffPowerSetting', -1 * mult);
                    modifyParam('RWSetting', 1 * mult);
                    modifyAll('SlowBumpSetting', -1 * mult, ['REARLEFT', 'REARRIGHT']);
                    break;

                case 'understeer_apex':
                    modifyParam('FrontAntiSwaySetting', -1 * mult);
                    modifyAll('SpringSetting', -5 * mult, ['FRONTLEFT', 'FRONTRIGHT']);
                    modifyParam('FWSetting', 1 * mult);
                    break;

                case 'sluggish':
                    modifyParam('FrontAntiSwaySetting', 1 * mult);
                    modifyParam('RearAntiSwaySetting', 1 * mult);
                    modifyAll('SpringSetting', 10 * mult, ['FRONTLEFT', 'FRONTRIGHT', 'REARLEFT', 'REARRIGHT']);
                    modifyAll('SlowReboundSetting', 2 * mult, ['FRONTLEFT', 'FRONTRIGHT']);
                    break;

                case 'front_locking':
                    modifyParam('RearBrakeSetting', -1 * mult);
                    modifyParam('Front3rdSpringSetting', 1 * mult);
                    modifyAll('SlowBumpSetting', 1 * mult, ['FRONTLEFT', 'FRONTRIGHT']);
                    break;

                case 'traction':
                    modifyParam('RearAntiSwaySetting', -1 * mult);
                    modifyAll('SpringSetting', -10 * mult, ['REARLEFT', 'REARRIGHT']);
                    modifyParam('DiffPreloadSetting', -2 * mult);
                    modifyAll('SlowBumpSetting', -1 * mult, ['REARLEFT', 'REARRIGHT']);
                    break;
            }

            const newFileName = selectedSetup.replace('.svm', '') + '_MDT_AI.svm';
            const newFilePath = `${baseDir}\\${newFileName}`;
            
            await window.electronAPI.saveSetupFile({ path: newFilePath, content: newLines.join('\n') });
            
            setStatus({ type: 'success', msg: `¡Ingeniería aplicada! Creado: ${newFileName}` });
            
            // Refrescar lista para que aparezca el nuevo archivo
            const refreshDir = selectedCar === '[Directo en Circuito]' 
                ? `${gamePath}\\UserData\\player\\Settings\\${selectedCircuit}`
                : `${gamePath}\\UserData\\player\\Settings\\${selectedCircuit}\\${selectedCar}`;
            const files = await window.electronAPI.getDirectoryContents({ path: refreshDir, type: 'files', filter: '.svm' });
            setSetups(files || []);
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', msg: 'Error al aplicar la corrección: ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto pb-24">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-racing-blue/10 flex items-center justify-center border border-racing-blue/30 shadow-[0_0_15px_rgba(0,112,243,0.2)]">
                    <span className="text-2xl text-racing-blue italic font-black">AI</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">MDT AI Race Engineer</h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Corrección de setups mediante algoritmos de ingeniería</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Panel Izquierdo: Selección de Archivo */}
                <div className="space-y-6 bg-black/40 p-6 rounded-3xl border border-white/5 backdrop-blur-sm">
                    <div className="space-y-4">
                        <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5 mb-2">
                            <button 
                                onClick={() => setVehicleType('GT3')}
                                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                                    ${vehicleType === 'GT3' ? 'bg-racing-blue text-white' : 'text-zinc-500 hover:text-white'}`}
                            >
                                GT3 Class
                            </button>
                            <button 
                                onClick={() => setVehicleType('Hypercar')}
                                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                                    ${vehicleType === 'Hypercar' ? 'bg-racing-orange text-white' : 'text-zinc-500 hover:text-white'}`}
                            >
                                Hypercar
                            </button>
                        </div>

                        <div>
                            <label className="block text-[9px] uppercase font-bold text-zinc-600 mb-2 tracking-widest">1. Seleccionar Circuito</label>
                            <select 
                                value={selectedCircuit}
                                onChange={(e) => setSelectedCircuit(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-racing-blue transition-all"
                            >
                                <option value="" className="bg-zinc-900">Seleccionar...</option>
                                {circuits.map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[9px] uppercase font-bold text-zinc-600 mb-2 tracking-widest">2. Seleccionar Coche</label>
                            <select 
                                value={selectedCar}
                                disabled={!selectedCircuit}
                                onChange={(e) => setSelectedCar(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-racing-blue transition-all disabled:opacity-30"
                            >
                                <option value="" className="bg-zinc-900">Seleccionar...</option>
                                {availableCars.map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[9px] uppercase font-bold text-zinc-600 mb-2 tracking-widest">3. Setup Base a Corregir</label>
                            <select 
                                value={selectedSetup}
                                disabled={!selectedCar}
                                onChange={(e) => setSelectedSetup(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-racing-blue transition-all disabled:opacity-30"
                            >
                                <option value="" className="bg-zinc-900">Seleccionar setup...</option>
                                {setups.map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Panel Derecho: Diagnóstico */}
                <div className="space-y-6 bg-black/40 p-6 rounded-3xl border border-white/5 backdrop-blur-sm">
                    <div>
                        <label className="block text-[9px] uppercase font-bold text-zinc-600 mb-4 tracking-widest">4. Diagnóstico del Piloto</label>
                        <div className="grid grid-cols-1 gap-2">
                            {problems.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setProblem(p.id)}
                                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                                        problem === p.id 
                                        ? 'bg-racing-blue/20 border-racing-blue text-white shadow-[0_0_15px_rgba(0,112,243,0.1)]' 
                                        : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                                    }`}
                                >
                                    <span className="text-xl">{p.icon}</span>
                                    <span className="text-xs font-bold uppercase tracking-tight">{p.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[9px] uppercase font-bold text-zinc-600 tracking-widest">5. Intensidad del Cambio</label>
                            <span className="text-[10px] font-black text-racing-blue uppercase">
                                {intensity === 1 ? 'Sutil' : intensity === 2 ? 'Moderada' : 'Agresiva'}
                            </span>
                        </div>
                        <input 
                            type="range" min="1" max="3" step="1"
                            value={intensity}
                            onChange={(e) => setIntensity(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-racing-blue"
                        />
                    </div>
                </div>
            </div>

            {/* Botón de Acción */}
            <div className="mt-12 text-center">
                <button
                    onClick={handleTweak}
                    disabled={loading || !selectedSetup || !problem}
                    className="relative group px-12 py-5 rounded-2xl bg-racing-blue text-white font-black italic uppercase tracking-tighter overflow-hidden transition-all disabled:opacity-50 disabled:grayscale"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative flex items-center gap-3">
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Calculando Ajustes...
                            </>
                        ) : (
                            'Aplicar Ingeniería de Pista'
                        )}
                    </span>
                </button>

                {status.msg && (
                    <div
                        className={`mt-8 p-6 rounded-2xl border-2 backdrop-blur-xl shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 ${
                            status.type === 'success' 
                            ? 'bg-racing-success/20 border-racing-success/40 text-racing-success shadow-racing-success/10' 
                            : 'bg-red-500/20 border-red-500/40 text-red-500 shadow-red-500/10'
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.type === 'success' ? 'bg-racing-success/20' : 'bg-red-500/20'}`}>
                                {status.type === 'success' ? (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                )}
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-black uppercase tracking-[0.2em] mb-1">
                                    {status.type === 'success' ? 'Operación Exitosa' : 'Error de Ingeniería'}
                                </p>
                                <p className="text-sm font-bold opacity-90">{status.msg}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SetupTweaker;
