import React, { useState, useEffect, useRef } from 'react';

const PRESETS = {
    dd_highend: {
        id: 'dd_highend',
        name: 'Direct Drive High-End',
        description: 'Simucube 2 Pro/Ultimate, Fanatec DD2, Moza R21, Asetek Invicta. Fuerza física bruta a 25Nm y máximo detalle dinámico.',
        settings: {
            isActive: true,
            masterGain: 55,
            maxTorqueRef: 25,
            smoothing: 1,
            understeerSlip: 40,
            staticNoise: 10,
            antiOscillation: 50,
            curbEffect: 50,
            roadEffect: 45,
            bumpDampening: 20,
            wheelWeight: 45,
            invertFfb: false
        }
    },
    dd_midrange: {
        id: 'dd_midrange',
        name: 'Direct Drive Gama Media',
        description: 'Moza R9/R12, Fanatec CSL DD (8Nm), Logitech G PRO, ClubSport DD. Configurado a 9Nm para un balance perfecto de peso y texturas.',
        settings: {
            isActive: true,
            masterGain: 70,
            maxTorqueRef: 9,
            smoothing: 4,
            understeerSlip: 50,
            staticNoise: 12,
            antiOscillation: 60,
            curbEffect: 65,
            roadEffect: 55,
            bumpDampening: 40,
            wheelWeight: 55,
            invertFfb: false
        }
    },
    belt_drive: {
        id: 'belt_drive',
        name: 'Transmisión por Correa',
        description: 'Thrustmaster T300/TX, Fanatec CS Elite, TS-PC. Configurado a 4.2Nm para amplificar el agarre sin quemar el motor.',
        settings: {
            isActive: true,
            masterGain: 85,
            maxTorqueRef: 4.2,
            smoothing: 8,
            understeerSlip: 55,
            staticNoise: 14,
            antiOscillation: 40,
            curbEffect: 75,
            roadEffect: 65,
            bumpDampening: 50,
            wheelWeight: 35,
            invertFfb: false
        }
    },
    gear_drive: {
        id: 'gear_drive',
        name: 'Transmisión por Engranajes',
        description: 'Logitech G29, G920, G923, G27. Configurado a 2.2Nm con amortiguación alta para evitar los ruidos metálicos y el traqueteo.',
        settings: {
            isActive: true,
            masterGain: 95,
            maxTorqueRef: 2.2,
            smoothing: 12,
            understeerSlip: 60,
            staticNoise: 15,
            antiOscillation: 20,
            curbEffect: 40,
            roadEffect: 35,
            bumpDampening: 75,
            wheelWeight: 20,
            invertFfb: false
        }
    }
};

const FfbManager = ({ gamePath }) => {
    // Core FFB State Variables
    const [isActive, setIsActive] = useState(true);
    const [masterGain, setMasterGain] = useState(70);
    const [maxTorqueRef, setMaxTorqueRef] = useState(9); // 9 Nm as default (CSL DD / R9 mid-range)
    const [smoothing, setSmoothing] = useState(4);
    const [understeerSlip, setUndersteerSlip] = useState(50);
    const [staticNoise, setStaticNoise] = useState(12);
    const [antiOscillation, setAntiOscillation] = useState(60);
    
    // Advanced Sliders
    const [curbEffect, setCurbEffect] = useState(65);       // Pianos
    const [roadEffect, setRoadEffect] = useState(55);       // Efectos de carretera (textura asfalto)
    const [bumpDampening, setBumpDampening] = useState(40); // Amortiguación de baches
    const [wheelWeight, setWheelWeight] = useState(55);     // Inercia / Peso del volante
    
    const [invertFfb, setInvertFfb] = useState(false);

    const [activePreset, setActivePreset] = useState('dd_midrange');
    const [saveStatus, setSaveStatus] = useState('');
    const canvasRef = useRef(null);

    // Live Game Telemetry State
    const [isLiveTelemetry, setIsLiveTelemetry] = useState(false);
    const [detectedWheel, setDetectedWheel] = useState({ detected: false, name: null, torque: null, type: null, brand: null });
    const [scanningWheel, setScanningWheel] = useState(false);

    // Refs for holding latest fast live values to feed into the 60fps canvas loop
    const lastTelemetryTimeRef = useRef(0);
    const lastFfbValueRef = useRef(0);
    const lastSteeringValueRef = useRef(0);

    // Load settings from localStorage on mount and start wheelbase detection
    useEffect(() => {
        const saved = localStorage.getItem('mdt_ffb_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setIsActive(parsed.isActive ?? true);
                setMasterGain(parsed.masterGain ?? 70);
                setMaxTorqueRef(parsed.maxTorqueRef ?? 9);
                setSmoothing(parsed.smoothing ?? 4);
                setUndersteerSlip(parsed.understeerSlip ?? 50);
                setStaticNoise(parsed.staticNoise ?? 12);
                setAntiOscillation(parsed.antiOscillation ?? 60);
                
                setCurbEffect(parsed.curbEffect ?? 65);
                setRoadEffect(parsed.roadEffect ?? 55);
                setBumpDampening(parsed.bumpDampening ?? 40);
                setWheelWeight(parsed.wheelWeight ?? 55);
                
                setInvertFfb(parsed.invertFfb ?? false);
                setActivePreset(parsed.activePreset ?? 'custom');
            } catch (e) {
                console.warn('Failed to parse FFB settings:', e);
            }
        }

        // Run automatic hardware detection
        handleDetectWheelbase();
    }, []);

    // Subscribe to true real-time local telemetry from shared memory
    useEffect(() => {
        if (window.electronAPI && window.electronAPI.onLmuLocalTelemetry) {
            window.electronAPI.onLmuLocalTelemetry((data) => {
                if (data) {
                    // Update latest telemetry refs
                    lastTelemetryTimeRef.current = Date.now();
                    
                    // LMU outputs ffbTorque between -1.0 and 1.0 (sometimes slightly over).
                    // Or steeringTorque representing physical shaft load.
                    // We'll normalize it for display.
                    const rawFfb = data.ffbTorque || (data.steeringTorque ? data.steeringTorque / 15.0 : 0);
                    lastFfbValueRef.current = rawFfb;
                    lastSteeringValueRef.current = data.steeringTorque || 0;
                    
                    if (!isLiveTelemetry) {
                        setIsLiveTelemetry(true);
                    }
                }
            });
        }

        return () => {
            if (window.electronAPI && window.electronAPI.offLmuLocalTelemetry) {
                window.electronAPI.offLmuLocalTelemetry();
            }
        };
    }, [isLiveTelemetry]);

    // Check if live telemetry is timed out (game closed / paused)
    useEffect(() => {
        const interval = setInterval(() => {
            if (Date.now() - lastTelemetryTimeRef.current > 2000) {
                if (isLiveTelemetry) {
                    setIsLiveTelemetry(false);
                }
            }
        }, 1500);

        return () => clearInterval(interval);
    }, [isLiveTelemetry]);

    // USB Hardware Wheelbase Detection
    const handleDetectWheelbase = async () => {
        if (scanningWheel) return;
        setScanningWheel(true);

        // Standard Gamepad API fallback (works everywhere)
        const checkGamepadAPI = () => {
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            for (const gp of gamepads) {
                if (!gp || !gp.id) continue;
                const id = gp.id.toLowerCase();
                if (id.includes('moza r3')) return { detected: true, name: 'MOZA R3', torque: 3.9, type: 'dd_midrange', brand: 'MOZA' };
                if (id.includes('moza r5')) return { detected: true, name: 'MOZA R5', torque: 5.5, type: 'dd_midrange', brand: 'MOZA' };
                if (id.includes('moza r9')) return { detected: true, name: 'MOZA R9', torque: 9.0, type: 'dd_midrange', brand: 'MOZA' };
                if (id.includes('moza r12')) return { detected: true, name: 'MOZA R12', torque: 12.0, type: 'dd_midrange', brand: 'MOZA' };
                if (id.includes('simucube')) return { detected: true, name: 'Simucube 2 Pro', torque: 25.0, type: 'dd_highend', brand: 'Simucube' };
                if (id.includes('csl dd') || id.includes('fanatec')) return { detected: true, name: 'Fanatec CSL DD', torque: 8.0, type: 'dd_midrange', brand: 'Fanatec' };
                if (id.includes('g29') || id.includes('g920') || id.includes('g923')) return { detected: true, name: 'Logitech G29', torque: 2.2, type: 'gear_drive', brand: 'Logitech' };
                if (id.includes('g pro') || id.includes('g-pro')) return { detected: true, name: 'Logitech G PRO', torque: 11.0, type: 'dd_midrange', brand: 'Logitech' };
                if (id.includes('t300') || id.includes('thrustmaster')) return { detected: true, name: 'Thrustmaster T300', torque: 3.9, type: 'belt_drive', brand: 'Thrustmaster' };
            }
            return null;
        };

        // Attempt Electron Native PowerShell PNP scan
        if (window.electronAPI && window.electronAPI.detectWheelbase) {
            try {
                const res = await window.electronAPI.detectWheelbase();
                if (res && res.detected) {
                    setDetectedWheel(res);
                    setScanningWheel(false);
                    return;
                }
            } catch (e) {
                console.warn('Electron PNP detection failed:', e);
            }
        }

        // Fallback to Gamepad API
        const gpResult = checkGamepadAPI();
        if (gpResult) {
            setDetectedWheel(gpResult);
        } else {
            // MOCK Moza R5 search trigger for presentation if nothing is plugged
            setDetectedWheel({ detected: false, name: null });
        }
        setScanningWheel(false);
    };

    // Apply auto-detected hardware calibration
    const handleApplyDetectedCalibration = () => {
        if (!detectedWheel.detected || !detectedWheel.type) return;
        
        const presetKey = detectedWheel.type;
        const pr = PRESETS[presetKey];
        if (!pr) return;

        const s = pr.settings;
        setIsActive(true);
        setMasterGain(s.masterGain);
        
        // Use EXACT hardware torque limit detected!
        setMaxTorqueRef(detectedWheel.torque);
        
        setSmoothing(s.smoothing);
        setUndersteerSlip(s.understeerSlip);
        setStaticNoise(s.staticNoise);
        setAntiOscillation(s.antiOscillation);
        setCurbEffect(s.curbEffect);
        setRoadEffect(s.roadEffect);
        setBumpDampening(s.bumpDampening);
        setWheelWeight(s.wheelWeight);
        
        setInvertFfb(s.invertFfb);
        setActivePreset(presetKey);

        // Immediate Save to LS
        const payload = { 
            ...s, 
            maxTorqueRef: detectedWheel.torque, 
            activePreset: presetKey 
        };
        localStorage.setItem('mdt_ffb_settings', JSON.stringify(payload));
        
        setSaveStatus(`Calibrado a ${detectedWheel.name} (${detectedWheel.torque} Nm)`);
        setTimeout(() => setSaveStatus(''), 2500);
    };

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
            curbEffect,
            roadEffect,
            bumpDampening,
            wheelWeight,
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
        
        setCurbEffect(s.curbEffect);
        setRoadEffect(s.roadEffect);
        setBumpDampening(s.bumpDampening);
        setWheelWeight(s.wheelWeight);
        
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

            // Calculate clipping ceiling.
            // A lower maxTorqueRef (e.g. 2.2 Nm) means a lower physical force ceiling -> easier to clip!
            // Range is now properly scaled from 1 Nm to 32 Nm.
            // threshold height in pixels from center
            const ceilingThreshold = 30 + (maxTorqueRef * 2.2); 
            const limitPos = centerLine - ceilingThreshold;
            const limitNeg = centerLine + ceilingThreshold;

            // Draw clipping limit threshold red lines
            ctx.strokeStyle = 'rgba(255, 77, 77, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, limitPos);
            ctx.lineTo(canvas.width, limitPos);
            ctx.moveTo(0, limitNeg);
            ctx.lineTo(canvas.width, limitNeg);
            ctx.stroke();

            // Label the clipping lines
            ctx.fillStyle = 'rgba(255, 77, 77, 0.5)';
            ctx.font = 'bold 8px "Antonio", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`LÍMITE CLIPPING (${maxTorqueRef.toFixed(1)} Nm)`, canvas.width - 15, limitPos - 4);
            ctx.fillText(`-LÍMITE CLIPPING (-${maxTorqueRef.toFixed(1)} Nm)`, canvas.width - 15, limitNeg + 10);

            // True Telemetry Data Source vs Simulated
            if (isActive) {
                const isReceivingLive = Date.now() - lastTelemetryTimeRef.current < 2000;
                
                if (isReceivingLive) {
                    // GENUINE Telemetry Feed directly from LMU Shared Memory!
                    // Scale LMU's -1.0 to 1.0 FFB float according to our settings
                    const scaleFactor = (masterGain / 70); 
                    const liveFfb = lastFfbValueRef.current * scaleFactor;
                    
                    telemetryPoints.shift();
                    telemetryPoints.push(liveFfb);
                } else {
                    // Simulated physics telemetry loop when simulator is closed
                    timeStep += 0.055;
                    
                    // Base sine wave representing steering input load (cornering)
                    // Affected by wheelWeight (adds a bit of damping/inertia, smoothing the input transition)
                    const inertiaWeight = Math.max(0.1, wheelWeight / 100);
                    const steeringSpeed = 0.4 / (1.0 + inertiaWeight * 0.5);
                    const steeringInput = Math.sin(timeStep * steeringSpeed) * (0.45 + inertiaWeight * 0.15);
                    
                    // Add high frequency road noise & suspension bumps (roadEffect adds micro vibration)
                    const roadFactor = roadEffect / 50; 
                    const noiseFactor = Math.max(0.05, (24 - smoothing) / 16);
                    const roadVibration = (Math.sin(timeStep * 5.5) * 0.09 + Math.cos(timeStep * 11) * 0.06) * noiseFactor * roadFactor;
                    
                    // Curb contact bump spikes (pianos) - amplitude regulated by curbEffect setting
                    let curbBump = 0;
                    const curbFactor = curbEffect / 60;
                    if (Math.sin(timeStep * 0.95) > 0.80) {
                        curbBump = Math.cos(timeStep * 28) * 0.32 * noiseFactor * curbFactor;
                    }

                    // Bump dampening: attenuates sharp high-frequency transient spikes
                    const dampeningFactor = Math.max(0.2, (100 - bumpDampening) / 100);
                    const finalTransientBumps = curbBump * dampeningFactor;

                    // Understeer slip calculation: reduces steering torque if cornering load exceeds a threshold
                    let gripMultiplier = 1.0;
                    const slipZone = 0.38;
                    if (Math.abs(steeringInput) > slipZone) {
                        // Understeer slip drops the steering torque to simulate loss of grip
                        const excess = Math.abs(steeringInput) - slipZone;
                        const slipSensitivity = understeerSlip / 100;
                        gripMultiplier = 1.0 - (excess * 1.55 * slipSensitivity);
                    }

                    const rawFfbSignal = (steeringInput * gripMultiplier + roadVibration + finalTransientBumps) * (masterGain / 45);
                    
                    telemetryPoints.shift();
                    telemetryPoints.push(rawFfbSignal);
                }
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
                
                let yOffset = signal * 68; // Scale for drawing
                
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
            ctx.fillRect(15, 12, 270, 22);
            ctx.strokeRect(15, 12, 270, 22);

            const isReceivingLive = Date.now() - lastTelemetryTimeRef.current < 2000;
            ctx.fillStyle = !isActive ? '#ff6b2b' : (isCurrentlyClipping ? '#ff4d4d' : '#00ff66');
            ctx.beginPath();
            ctx.arc(28, 23, 4.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px "Heebo", sans-serif';
            ctx.textAlign = 'left';
            
            let statusLabel = '';
            if (!isActive) {
                statusLabel = 'MDT FFB DESACTIVADO (FLATLINE IDLE)';
            } else if (isReceivingLive) {
                statusLabel = isCurrentlyClipping 
                    ? '⚠️ CLIPPING EN VIVO: SATURACIÓN FFB REGISTRADA' 
                    : '🟢 TELEMETRÍA EN VIVO: SEÑAL DE VUELTA IMPECABLE';
            } else {
                statusLabel = isCurrentlyClipping 
                    ? '⚠️ ADVERTENCIA: SIMULACIÓN EN CLIPPING Nm' 
                    : '🔵 MODO DEMO: SIMULACIÓN DE FÍSICA CORNERING';
            }
            ctx.fillText(statusLabel, 38, 26);

            // FPS loop
            animationId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [isActive, masterGain, maxTorqueRef, smoothing, understeerSlip, invertFfb, curbEffect, roadEffect, bumpDampening, wheelWeight]);

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
                            Ajustes calibrados de Force Feedback para Le Mans Ultimate. Configura la física exacta de tu base en un clic.
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

                        {/* Switch Toggle */}
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

            {/* Hardware wheel detection banner if detected */}
            {detectedWheel.detected ? (
                <div className="wec-glass border border-wec-cyan/20 bg-wec-blue/5 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-wec-cyan/10 flex items-center justify-center border border-wec-cyan/20">
                            <svg className="w-5 h-5 text-wec-cyan animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1.5} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10V2M10 12H2M14 12h8" /></svg>
                        </div>
                        <div>
                            <span className="text-[8px] font-bold text-wec-cyan tracking-widest block uppercase">Hardware Volante Detectado</span>
                            <span className="text-sm font-bold text-white uppercase">{detectedWheel.name} ({detectedWheel.torque.toFixed(1)} Nm)</span>
                        </div>
                    </div>
                    <button
                        onClick={handleApplyDetectedCalibration}
                        className="px-4 py-2 bg-wec-cyan text-wec-black hover:bg-white rounded-lg text-wec-display text-[9px] font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(0,212,255,0.25)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
                    >
                        Aplicar Calibración de Torque en {detectedWheel.torque.toFixed(1)} Nm
                    </button>
                </div>
            ) : (
                <div className="wec-glass border border-white/5 bg-white/[0.01] p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                            <svg className="w-5 h-5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1.5} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l-3.5 6M12 14l3.5 6" /></svg>
                        </div>
                        <div>
                            <span className="text-[8px] font-bold text-white/20 tracking-widest block uppercase">Buscador de Hardware USB</span>
                            <span className="text-xs text-white/50">Haz clic para escanear y calibrar tu base de volante automáticamente.</span>
                        </div>
                    </div>
                    <button
                        onClick={handleDetectWheelbase}
                        disabled={scanningWheel}
                        className="px-4 py-2 border border-white/10 hover:border-wec-cyan hover:bg-wec-blue/5 rounded-lg text-white text-[9px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer shrink-0"
                    >
                        {scanningWheel ? 'Escaneando...' : 'Escanear Volante'}
                    </button>
                </div>
            )}

            {/* Main content grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Left Column: Preset Selection & Live clipping visualizer */}
                <div className="xl:col-span-1 space-y-6">
                    
                    {/* Live Telemetry Display */}
                    <div className="wec-glass rounded-xl border border-white/5 overflow-hidden flex flex-col">
                        <div className="px-4 py-3 bg-white/[0.02] border-b border-white/5 flex justify-between items-center shrink-0">
                            <span className="text-[9px] font-bold text-white/50 tracking-wider uppercase">Monitor de Señal en Tiempo Real</span>
                            {isLiveTelemetry ? (
                                <span className="text-[8px] font-bold text-wec-green tracking-widest uppercase animate-pulse flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-wec-green" /> EN VIVO (SHARED MEMORY)
                                </span>
                            ) : (
                                <span className="text-[8px] font-bold text-wec-cyan tracking-widest uppercase flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-wec-cyan" /> MODO DEMO
                                </span>
                            )}
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
                            {isLiveTelemetry 
                                ? 'Graficando FFB en tiempo real del juego. Si la señal toca las líneas límites rojas de Nm, sufrirás pérdida de detalle físico.'
                                : 'Visualiza la oscilación de fuerza. Si la curva toca las líneas límites rojas de Nm, el FFB se aplanará y perderás detalle físico.'
                            }
                        </div>
                    </div>

                    {/* Presets Grid */}
                    <div className="wec-glass p-5 rounded-xl border border-white/5 space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Perfiles de Volante (Presets)</h3>
                            <p className="text-[10px] text-white/30">Carga en un clic la calibración de torque real de tu base física.</p>
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

                        {/* Slider Controls Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            
                            {/* 1. Ganancia Maestra */}
                            <div className={`space-y-2 border-b border-white/5 pb-4 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
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
                                    Controla la fuerza global que sentirás en el volante. Si notas la dirección excesivamente pesada o blanda, ajústala aquí.
                                </p>
                            </div>

                            {/* 2. Fuerza Máxima en Nm */}
                            <div className={`space-y-2 border-b border-white/5 pb-4 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Fuerza Máxima de Base (Max Torque)</label>
                                    <span className="text-[10px] font-bold text-wec-orange" style={{ fontFamily: 'var(--font-data)' }}>{maxTorqueRef.toFixed(1)} Nm</span>
                                </div>
                                <input
                                    type="range"
                                    min="1.0"
                                    max="32.0"
                                    step="0.1"
                                    value={maxTorqueRef}
                                    onChange={(e) => {
                                        setMaxTorqueRef(parseFloat(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-wec-orange bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Configura la **fuerza física máxima real en Nm** de tu base de volante. G29 es ~2.2Nm, Moza R3 es 3.9Nm, R5 es 5.5Nm, CSL DD es 5-8Nm, R9 es 9Nm, Simucube es 25Nm.
                                </p>
                            </div>

                            {/* 3. Pianos (Curb Effects) */}
                            <div className={`space-y-2 border-b border-white/5 pb-4 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Fuerza de Pianos (Curb Effects)</label>
                                    <span className="text-[10px] font-bold text-wec-cyan" style={{ fontFamily: 'var(--font-data)' }}>{curbEffect}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={curbEffect}
                                    onChange={(e) => {
                                        setCurbEffect(parseInt(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-wec-cyan bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Controla la intensidad de la vibración táctil al pasar sobre los pianos y límites del circuito. Aumenta para una respuesta más agresiva y directa.
                                </p>
                            </div>

                            {/* 4. Efectos de Carretera (Road Textures) */}
                            <div className={`space-y-2 border-b border-white/5 pb-4 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Textura del Asfalto (Road Effects)</label>
                                    <span className="text-[10px] font-bold text-white/60" style={{ fontFamily: 'var(--font-data)' }}>{roadEffect}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={roadEffect}
                                    onChange={(e) => {
                                        setRoadEffect(parseInt(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-white/40 bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Añade una vibración fina tridimensional que simula el grano del asfalto y la rugosidad de la pista, incrementando la sensación de velocidad.
                                </p>
                            </div>

                            {/* 5. Amortiguación de Baches */}
                            <div className={`space-y-2 border-b border-white/5 pb-4 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Amortiguador de Baches (Bump Dampening)</label>
                                    <span className="text-[10px] font-bold text-wec-orange" style={{ fontFamily: 'var(--font-data)' }}>{bumpDampening}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={bumpDampening}
                                    onChange={(e) => {
                                        setBumpDampening(parseInt(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-wec-orange bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Suaviza los latigazos secos e impactos bruscos producidos por baches profundos o zanjas en pista. Protege la mecánica del aro y tus muñecas.
                                </p>
                            </div>

                            {/* 6. Inercia y Peso del Volante */}
                            <div className={`space-y-2 border-b border-white/5 pb-4 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Peso de Dirección (Inertia & Weight)</label>
                                    <span className="text-[10px] font-bold text-white/60" style={{ fontFamily: 'var(--font-data)' }}>{wheelWeight}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={wheelWeight}
                                    onChange={(e) => {
                                        setWheelWeight(parseInt(e.target.value));
                                        handleTweak();
                                    }}
                                    className="w-full accent-white/40 bg-white/5 rounded-lg h-1"
                                />
                                <p className="text-[9px] leading-relaxed text-white/20">
                                    Añade una inercia física simulada a la columna de dirección. Hace que el volante se sienta más denso y natural, reduciendo la flotabilidad en rectas.
                                </p>
                            </div>

                            {/* 7. Suavizado de Dirección */}
                            <div className={`space-y-2 border-b border-white/5 pb-4 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Suavizado del Eje (Smoothing)</label>
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
                                    Dampen general del eje para bases ruidosas. Reduce el traqueteo y ruidos agudos sin enturbiar las fuerzas esenciales de adherencia.
                                </p>
                            </div>

                            {/* 8. Efecto de Subviraje */}
                            <div className={`space-y-2 border-b border-white/5 pb-4 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Pérdida de Grip en Subviraje</label>
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
                                    Atenúa la fuerza de resistencia del volante cuando el neumático delantero desliza en curva. Notarás que el aro se vuelve ligero al patinar.
                                </p>
                            </div>

                            {/* 9. Filtro Estático */}
                            <div className={`space-y-2 border-b border-white/5 pb-4 md:pb-0 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Vibración Estática del Motor</label>
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
                                    Elimina la frecuencia del zumbido o temblor del motor cuando estás en ralentí parado en boxes o a bajísima velocidad.
                                </p>
                            </div>

                            {/* 10. Protección de Manos Libres */}
                            <div className={`space-y-2 ${!isActive ? 'opacity-35 pointer-events-none' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-white uppercase tracking-wider">Atenuación Anti-Oscilación (Hands-Off)</label>
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
                                    Detecta instantáneamente si has soltado las manos del aro en recta y mitiga las fuerzas del motor para impedir sacudidas cíclicas peligrosas.
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
                                        Activar **solo** si al girar el volante tiende a irse solo hacia el exterior de la curva.
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
