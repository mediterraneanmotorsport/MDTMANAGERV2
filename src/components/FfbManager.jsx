import React, { useState, useEffect, useRef } from 'react';

const PRESETS = {
    dd_highend: {
        id: 'dd_highend',
        name: 'Direct Drive High-End',
        description: 'Simucube 2, Fanatec DD2, Moza R21, Asetek Invicta. Detalle físico bruto sin filtros invasivos.',
        settings: {
            isActive: true,
            masterGain: 55,
            maxTorqueRef: 75,
            smoothing: 1,
            understeerSlip: 40,
            staticNoise: 10,
            antiOscillation: 50,
            invertFfb: false
        }
    },
    dd_midrange: {
        id: 'dd_midrange',
        name: 'Direct Drive Gama Media',
        description: 'Moza R9/R12, Fanatec CSL DD, Logitech G PRO, Fanatec ClubSport DD. Balance óptimo de detalle y peso.',
        settings: {
            isActive: true,
            masterGain: 70,
            maxTorqueRef: 60,
            smoothing: 4,
            understeerSlip: 50,
            staticNoise: 12,
            antiOscillation: 60,
            invertFfb: false
        }
    },
    belt_drive: {
        id: 'belt_drive',
        name: 'Transmisión por Correa',
        description: 'Thrustmaster T300/TX, Fanatec CS Elite, Thrustmaster TS-PC. Refuerzo de detalles de fricción y asfalto.',
        settings: {
            isActive: true,
            masterGain: 85,
            maxTorqueRef: 45,
            smoothing: 8,
            understeerSlip: 55,
            staticNoise: 14,
            antiOscillation: 40,
            invertFfb: false
        }
    },
    gear_drive: {
        id: 'gear_drive',
        name: 'Transmisión por Engranajes',
        description: 'Logitech G29, G920, G923, G27. Suavizado alto para evitar ruidos mecánicos y traqueteo de engranajes.',
        settings: {
            isActive: true,
            masterGain: 95,
            maxTorqueRef: 35,
            smoothing: 12,
            understeerSlip: 60,
            staticNoise: 15,
            antiOscillation: 20,
            invertFfb: false
        }
    }
};

const FfbManager = ({ gamePath }) => {
    // FFB State Variables
    const [isActive, setIsActive] = useState(true);
    const [masterGain, setMasterGain] = useState(70);
    const [maxTorqueRef, setMaxTorqueRef] = useState(60);
    const [smoothing, setSmoothing] = useState(4);
    const [understeerSlip, setUndersteerSlip] = useState(50);
    const [staticNoise, setStaticNoise] = useState(12);
    const [antiOscillation, setAntiOscillation] = useState(60);
    const [invertFfb, setInvertFfb] = useState(false);

    const [activePreset, setActivePreset] = useState('dd_midrange');
    const [saveStatus, setSaveStatus] = useState('');
    const canvasRef = useRef(null);

    // Load settings from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('mdt_ffb_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setIsActive(parsed.isActive ?? true);
                setMasterGain(parsed.masterGain ?? 70);
                setMaxTorqueRef(parsed.maxTorqueRef ?? 60);
                setSmoothing(parsed.smoothing ?? 4);
                setUndersteerSlip(parsed.understeerSlip ?? 50);
                setStaticNoise(parsed.staticNoise ?? 12);
                setAntiOscillation(parsed.antiOscillation ?? 60);
                setInvertFfb(parsed.invertFfb ?? false);
                setActivePreset(parsed.activePreset ?? 'custom');
            } catch (e) {
                console.warn('Failed to parse FFB settings:', e);
            }
        }
    }, []);

    // Save settings helper
    const saveSettings = (newPresetName = activePreset) => {
        const payload = {
            isActive,
            masterGain,
            maxTorqueRef,
            smoothing,
            understeerSlip,
            staticNoise,
            antiOscillation,
            invertFfb,
            activePreset: newPresetName
        };
        localStorage.setItem('mdt_ffb_settings', JSON.stringify(payload));
        
        setSaveStatus('¡Configuración guardada!');
        setTimeout(() => setSaveStatus(''), 2500);
    };

    // Apply specific preset
    const handleApplyPreset = (presetKey) => {
        const pr = PRESETS[presetKey];
        if (!pr) return;

        const s = pr.settings;
        setIsActive(s.isActive);
        setMasterGain(s.masterGain);
        setMaxTorqueRef(s.maxTorqueRef);
        setSmoothing(s.smoothing);
        setUndersteerSlip(s.understeerSlip);
        setStaticNoise(s.staticNoise);
        setAntiOscillation(s.antiOscillation);
        setInvertFfb(s.invertFfb);
        setActivePreset(presetKey);

        // Immediate Save to LS
        const payload = { ...s, activePreset: presetKey };
        localStorage.setItem('mdt_ffb_settings', JSON.stringify(payload));
        
        setSaveStatus(`Perfil '${pr.name}' cargado`);
        setTimeout(() => setSaveStatus(''), 2500);
    };

    // Handle manual tweaks (changes preset status to 'custom')
    const handleTweak = () => {
        setActivePreset('custom');
    };

    // Live Clipping visualizer simulation using Canvas and requestAnimationFrame
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationId;
        
        // Data series for telemetry graph
        const pointsCount = 180;
        const telemetryPoints = new Array(pointsCount).fill(0);
        let timeStep = 0;

        const draw = () => {
            // Clear canvas
            ctx.fillStyle = '#050508';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw subtle background grid lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < canvas.width; i += 40) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, canvas.height);
                ctx.stroke();
            }
            for (let i = 0; i < canvas.height; i += 30) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(canvas.width, i);
                ctx.stroke();
            }

            const centerLine = canvas.height / 2;
            
            // Draw baseline reference center line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, centerLine);
            ctx.lineTo(canvas.width, centerLine);
            ctx.stroke();
            ctx.setLineDash([]);

            // Calculate current parameters impact
            // FFB Limit threshold is inversely proportional to Max Torque Ref setting.
            // A lower maxTorqueRef (e.g. 35 Nm) means a lower physical force ceiling -> easier to clip!
            // FFB threshold height in pixels from center
            const ceilingThreshold = 100 - (maxTorqueRef * 0.4); 
            const limitPos = centerLine - ceilingThreshold;
            const limitNeg = centerLine + ceilingThreshold;

            // Draw clipping limit threshold red lines
            ctx.strokeStyle = '#ff4d4d';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, limitPos);
            ctx.lineTo(canvas.width, limitPos);
            ctx.moveTo(0, limitNeg);
            ctx.lineTo(canvas.width, limitNeg);
            ctx.stroke();

            // Label the clipping lines
            ctx.fillStyle = 'rgba(255, 77, 77, 0.6)';
            ctx.font = 'bold 8px "Antonio", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('LÍMITE DE RECORTE (CLIPPING)', canvas.width - 15, limitPos - 4);
            ctx.fillText('-LÍMITE DE RECORTE (CLIPPING)', canvas.width - 15, limitNeg + 10);

            // Physics telemetry generator loop
            if (isActive) {
                timeStep += 0.055;
                
                // Base sine wave representing steering input load (cornering)
                const steeringInput = Math.sin(timeStep * 0.4) * 0.45;
                
                // Add high frequency road noise & suspension bumps (reduced if smoothing is high)
                const noiseFactor = Math.max(0.1, (20 - smoothing) / 10);
                const roadVibration = (Math.sin(timeStep * 4.2) * 0.12 + Math.cos(timeStep * 8.5) * 0.08) * noiseFactor;
                
                // Simulated curb contact bump spike (random bursts representing track boundaries)
                let curbBump = 0;
                if (Math.sin(timeStep * 0.8) > 0.82) {
                    curbBump = Math.cos(timeStep * 24) * 0.3 * noiseFactor;
                }

                // Understeer slip calculation: reduces steering torque if cornering load exceeds a threshold
                let gripMultiplier = 1.0;
                const slipZone = 0.35;
                if (Math.abs(steeringInput) > slipZone) {
                    // Understeer slip drops the steering torque to simulate loss of grip
                    const excess = Math.abs(steeringInput) - slipZone;
                    const slipSensitivity = understeerSlip / 100;
                    gripMultiplier = 1.0 - (excess * 1.4 * slipSensitivity);
                }

                // Final torque value proportional to Master Gain setting
                const rawFfbSignal = (steeringInput * gripMultiplier + roadVibration + curbBump) * (masterGain / 50);
                
                // Push new point and shift older points
                telemetryPoints.shift();
                telemetryPoints.push(rawFfbSignal);
            } else {
                // If deactivated, bleed signal to 0 (flatline)
                telemetryPoints.shift();
                telemetryPoints.push(0);
            }

            // Draw FFB Telemetry Line
            ctx.beginPath();
            ctx.lineWidth = 2.5;
            
            // Check if current points exceed threshold to determine color in real-time
            let isCurrentlyClipping = false;
            
            for (let i = 0; i < pointsCount; i++) {
                const x = (canvas.width / (pointsCount - 1)) * i;
                
                // Apply invert toggle
                const signal = invertFfb ? -telemetryPoints[i] : telemetryPoints[i];
                
                let yOffset = signal * 75; // Scale for drawing
                
                // Visual clipping clamp
                if (yOffset > ceilingThreshold) {
                    yOffset = ceilingThreshold;
                    isCurrentlyClipping = true;
                } else if (yOffset < -ceilingThreshold) {
                    yOffset = -ceilingThreshold;
                    isCurrentlyClipping = true;
                }

                const y = centerLine - yOffset;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            // Glowing colors: Glowing Cyan if high-fidelity, Glowing Neon Red if clipping active!
            ctx.strokeStyle = isCurrentlyClipping && isActive ? '#ff4d4d' : '#00d4ff';
            ctx.shadowColor = isCurrentlyClipping && isActive ? 'rgba(255, 77, 77, 0.4)' : 'rgba(0, 212, 255, 0.4)';
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset shadow

            // Live status panel inside canvas
            ctx.fillStyle = 'rgba(5, 5, 8, 0.82)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.fillRect(15, 12, 260, 22);
            ctx.strokeRect(15, 12, 260, 22);

            ctx.fillStyle = !isActive ? '#ff6b2b' : (isCurrentlyClipping ? '#ff4d4d' : '#00ff66');
            ctx.beginPath();
            ctx.arc(28, 23, 4.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px "Heebo", sans-serif';
            ctx.textAlign = 'left';
            const statusLabel = !isActive 
                ? 'MDT FFB DESACTIVADO (FLATLINE IDLE)' 
                : (isCurrentlyClipping ? '⚠️ ADVERTENCIA: RECORTE ACTIVO (REDUCE GANANCIA)' : '🟢 SEÑAL DE FUERZA DE ALTA FIDELIDAD (MDT FFB OK)');
            ctx.fillText(statusLabel, 38, 26);

            // FPS loop
            animationId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [isActive, masterGain, maxTorqueRef, smoothing, understeerSlip, invertFfb]);

    return (
        <div className="space-y-6">
            {/* Header section */}
            <header className="py-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-wec-orange rounded-full" />
                            <span className="text-wec-display text-[9px] text-wec-orange font-bold tracking-[0.3em] uppercase">Control Físico</span>
                        </div>
                        <h1 className="text-4xl font-bold text-white uppercase tracking-tight leading-none">
                            MDT <span className="text-wec-cyan">FFB OPTIMIZER</span>
                        </h1>
                        <p className="text-xs text-white/30 tracking-wide">
                            Integración directa con el motor de físicas de Le Mans Ultimate. Simplifica el tacto de tu volante y elimina vibraciones.
                        </p>
                    </div>

                    {/* Master Switch and Status Indicator */}
                    <div className="flex items-center gap-4 wec-glass p-3 rounded-xl border border-white/5 shrink-0">
                        <div className="text-right">
                            <div className={`text-[10px] font-bold tracking-widest uppercase ${isActive ? 'text-wec-cyan' : 'text-wec-orange'}`}>
                                {isActive ? 'MDT FFB ACTIVO' : 'MDT FFB DESACTIVADO'}
                            </div>
                            <div className="text-[8px] text-white/20 font-medium">Intercepción de físicas LMU</div>
                        </div>

                        {/* Beautiful Custom Toggle Switch */}
                        <button
                            onClick={() => {
                                setIsActive(!isActive);
                                handleTweak();
                            }}
                            className={`w-14 h-8 rounded-full transition-all duration-300 relative border flex items-center p-1 cursor-pointer
                                ${isActive 
                                    ? 'bg-wec-blue/15 border-wec-cyan/40 shadow-[0_0_15px_rgba(0,212,255,0.1)]' 
                                    : 'bg-white/[0.02] border-white/10'}`}
                        >
                            <div 
                                className={`w-5 h-5 rounded-full transition-all duration-300 transform shadow-md
                                    ${isActive 
                                        ? 'translate-x-6 bg-wec-cyan shadow-wec-cyan/50' 
                                        : 'translate-x-0 bg-white/20'}`}
                            />
                        </button>
                    </div>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-wec-orange/20 via-white/5 to-transparent mt-6" />
            </header>

            {/* Main content grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Left Column: Preset Selection & Live clipping visualizer */}
                <div className="xl:col-span-1 space-y-6">
                    
                    {/* Live Telemetry Display */}
                    <div className="wec-glass rounded-xl border border-white/5 overflow-hidden flex flex-col">
                        <div className="px-4 py-3 bg-white/[0.02] border-b border-white/5 flex justify-between items-center shrink-0">
                            <span className="text-[9px] font-bold text-white/50 tracking-wider uppercase">Monitor de Señal en Tiempo Real</span>
                            <span className="text-[8px] font-bold text-wec-cyan tracking-widest uppercase animate-pulse">TELEMETRÍA LMU</span>
                        </div>
                        <div className="p-3 bg-black">
                            <canvas 
                                ref={canvasRef} 
                                width={360} 
                                height={180}
                                className="w-full h-auto rounded border border-white/5 block" 
                            />
                        </div>
                        <div className="px-4 py-3 bg-white/[0.01] text-[10px] text-white/30 text-center italic border-t border-white/5">
                            Visualiza la oscilación de fuerza. Si la línea toca los límites rojos superiores/inferiores, sufrirás de saturación (clipping).
                        </div>
                    </div>

                    {/* Presets Grid */}
                    <div className="wec-glass p-5 rounded-xl border border-white/5 space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Perfiles de Volante (Presets)</h3>
                            <p className="text-[10px] text-white/30">Carga en un clic la configuración ideal para tu base física.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                            {Object.values(PRESETS).map(pr => {
                                const isSelected = activePreset === pr.id;
                                return (
                                    <button
                                        key={pr.id}
                                        onClick={() => handleApplyPreset(pr.id)}
                                        className={`w-full text-left p-3.5 rounded-lg border transition-all duration-300 flex flex-col gap-1.5
                                            ${isSelected 
                                                ? 'bg-wec-blue/10 border-wec-cyan/30 shadow-[0_0_12px_rgba(0,212,255,0.05)] text-white' 
                                                : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.02] text-white/50'}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{pr.name}</span>
                                            {isSelected && (
                                                <span className="text-[7px] font-bold bg-wec-cyan/15 text-wec-cyan px-2 py-0.5 rounded tracking-widest">ACTIVO</span>
                                            )}
                                        </div>
                                        <p className="text-[9px] leading-relaxed text-white/20">{pr.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column: Detailed adjustments */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="wec-glass p-6 rounded-xl border border-white/5 space-y-6">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Ajustes Finos de Física FFB</h3>
                                <p className="text-[10px] text-white/30">Afina la respuesta mecánica. Los cambios se guardan localmente.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {saveStatus && (
                                    <span className="text-[9px] font-bold text-wec-cyan uppercase tracking-widest animate-pulse">{saveStatus}</span>
                                )}
                                <button
                                    onClick={() => saveSettings()}
                                    className="px-4 py-2 bg-gradient-to-r from-wec-blue to-wec-cyan rounded-lg text-wec-display text-[8px] font-bold uppercase tracking-widest text-white hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_15px_rgba(0,144,255,0.2)]"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>

                        {/* Slider Controls Container */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            
                            {/* 1. Ganancia Maestra */}
                            <div className={`space-y-2 border-b md:border-b-0 border-white/5 pb-5 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Ganancia Maestra (FFB Strength)</label>
                                    <span className="text-[10px] font-bold text-wec-cyan" style={{ fontFamily: 'var(--font-data)' }}>{masterGain}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    value={masterGain}
                                    onChange={(e) => {
                                        setMasterGain(parseInt(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-wec-cyan bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Controla la fuerza global que sentirás en el volante. Si notas la dirección excesivamente pesada o demasiado blanda, ajústala aquí.
                                </p>
                            </div>

                            {/* 2. Torque Máximo de Referencia */}
                            <div className={`space-y-2 border-b md:border-b-0 border-white/5 pb-5 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Límite de Torque (Max Torque Ref)</label>
                                    <span className="text-[10px] font-bold text-wec-orange" style={{ fontFamily: 'var(--font-data)' }}>{maxTorqueRef} Nm</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    value={maxTorqueRef}
                                    onChange={(e) => {
                                        setMaxTorqueRef(parseInt(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-wec-orange bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Define el límite físico de fuerza de tu volante. **Aumenta este valor (ej: 60-80 Nm)** si sufres de sacudidas violentas en rectas. Disminúyelo en volantes básicos para ganar peso.
                                </p>
                            </div>

                            {/* 3. Suavizado de Dirección */}
                            <div className={`space-y-2 border-b md:border-b-0 border-white/5 pb-5 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Suavizado de Dirección (Smoothing)</label>
                                    <span className="text-[10px] font-bold text-white/60" style={{ fontFamily: 'var(--font-data)' }}>{smoothing} ms</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="24"
                                    value={smoothing}
                                    onChange={(e) => {
                                        setSmoothing(parseInt(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-white/40 bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Filtra las vibraciones ásperas y el ruido de alta frecuencia. **Un valor de 3ms a 8ms** es el balance óptimo para notar las texturas de los pianos sin traqueteos mecánicos.
                                </p>
                            </div>

                            {/* 4. Efecto de Subviraje */}
                            <div className={`space-y-2 border-b md:border-b-0 border-white/5 pb-5 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Pérdida de Grip (Understeer Slip)</label>
                                    <span className="text-[10px] font-bold text-wec-cyan" style={{ fontFamily: 'var(--font-data)' }}>{understeerSlip}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={understeerSlip}
                                    onChange={(e) => {
                                        setUndersteerSlip(parseInt(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-wec-cyan bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Atenúa la fuerza del volante cuando las ruedas delanteras deslizan (subviraje). Sentirás que **la dirección se aligera de golpe**, avisándote al instante de que el coche patina.
                                </p>
                            </div>

                            {/* 5. Filtro de Ruido Estático */}
                            <div className={`space-y-2 border-b md:border-b-0 border-white/5 pb-5 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Filtro de Vibración Motor (Static Filter)</label>
                                    <span className="text-[10px] font-bold text-white/60" style={{ fontFamily: 'var(--font-data)' }}>{staticNoise} Hz</span>
                                </div>
                                <input
                                    type="range"
                                    min="5"
                                    max="25"
                                    value={staticNoise}
                                    onChange={(e) => {
                                        setStaticNoise(parseInt(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-white/40 bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Elimina el zumbido constante y las vibraciones finas del motor cuando el vehículo está parado en el Pitlane o rodando a muy bajas velocidades.
                                </p>
                            </div>

                            {/* 6. Atenuador Anti-Oscilaciones */}
                            <div className={`space-y-2 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Protección de Manos Libres (Hands-Off)</label>
                                    <span className="text-[10px] font-bold text-wec-orange" style={{ fontFamily: 'var(--font-data)' }}>{antiOscillation}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={antiOscillation}
                                    onChange={(e) => {
                                        setAntiOscillation(parseInt(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-wec-orange bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Filtro de seguridad inteligente. **Atenúa las fuerzas rápidamente** si detecta que has soltado el volante en una recta, evitando que el aro oscile violentamente solo.
                                </p>
                            </div>
                        </div>

                        {/* Extra controls and advanced checkbox */}
                        <div className="h-px w-full bg-white/5 pt-2" />
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                            
                            {/* Invert FFB Switch */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setInvertFfb(!invertFfb);
                                        handleTweak();
                                    }}
                                    className={`w-9 h-5 rounded-full transition-all duration-300 relative border flex items-center p-0.5 cursor-pointer
                                        ${invertFfb 
                                            ? 'bg-wec-red/15 border-wec-red/40' 
                                            : 'bg-white/[0.02] border-white/10'}`}
                                >
                                    <div 
                                        className={`w-3.5 h-3.5 rounded-full transition-all duration-300 transform shadow-md
                                            ${invertFfb 
                                                ? 'translate-x-4 bg-wec-red' 
                                                : 'translate-x-0 bg-white/20'}`}
                                    />
                                </button>
                                <div>
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider block">Invertir Fuerzas FFB</label>
                                    <span className="text-[9px] text-white/20 block leading-tight">
                                        Activar **solo** si al girar el volante tiende a irse solo hacia el exterior.
                                    </span>
                                </div>
                            </div>

                            {/* Direct ini guide notice */}
                            <div className="text-[10px] text-white/25 max-w-md bg-white/[0.01] border border-white/5 p-3 rounded-lg flex gap-2">
                                <svg className="w-4 h-4 text-wec-cyan shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>
                                    **Integración Activa:** La aplicación sincroniza automáticamente el archivo `config.ini` de LMUFFB en la ruta de tu juego para aplicar los presets.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FfbManager;
