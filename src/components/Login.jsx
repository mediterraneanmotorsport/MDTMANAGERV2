import React, { useState, useEffect } from 'react';
import { auth } from '../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';

const Login = ({ error: accessError }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(accessError || '');
    const [loading, setLoading] = useState(false);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError('Credenciales inválidas. Acceso denegado.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-wec-black flex items-center justify-center p-6 relative overflow-hidden select-none">
            {/* Drag Handle Top Overlay */}
            <div className="absolute top-0 left-0 right-0 h-16 z-[100]" style={{ WebkitAppRegion: 'drag' }} />
            
            {/* ── BACKGROUND EFFECTS ── */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute inset-0 wec-grid-pattern opacity-40" />
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-wec-blue/8 blur-[200px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-wec-cyan/5 blur-[180px]" />
                
                {/* Animated grid lines */}
                <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-wec-blue/10 to-transparent" />
                <div className="absolute top-0 left-2/4 w-px h-full bg-gradient-to-b from-transparent via-wec-blue/5 to-transparent" />
                <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-wec-blue/10 to-transparent" />
                <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-wec-cyan/8 to-transparent" />
                <div className="absolute top-2/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-wec-cyan/5 to-transparent" />
            </div>

            <div className="w-full max-w-md relative z-10 wec-enter">
                {/* ── WEC TERMINAL CARD ── */}
                <div className="relative">
                    {/* Top accent bar */}
                    <div className="h-1 bg-gradient-to-r from-wec-blue via-wec-cyan to-wec-blue/50 rounded-t-sm" />
                    
                    <div className="wec-glass rounded-b-2xl p-10 md:p-12 relative overflow-hidden">
                        {/* Scan lines overlay */}
                        <div className="absolute inset-0 wec-scanlines pointer-events-none opacity-30" />
                        <div className="absolute inset-0 wec-shimmer pointer-events-none" />
                        
                        {/* ── HEADER ── */}
                        <div className="flex flex-col items-center mb-10 relative z-10">
                            {/* Logo container with hexagonal glow */}
                            <div className="relative mb-8">
                                <div className="w-20 h-20 rounded-xl bg-wec-surface flex items-center justify-center border border-wec-blue/20 overflow-hidden relative">
                                    <img src="logo.png" alt="MDT" className="w-14 h-auto relative z-10" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-wec-blue/10 to-transparent" />
                                </div>
                                {/* Glow ring */}
                                <div className="absolute -inset-2 rounded-2xl border border-wec-blue/10 wec-pulse-blue" style={{ borderRadius: '16px' }} />
                            </div>

                            {/* Title */}
                            <h1 className="text-wec-display text-2xl font-bold tracking-[0.1em] text-white mb-2">
                                ACCESO <span className="text-wec-cyan">WEC</span>
                            </h1>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-px bg-wec-blue/30" />
                                <span className="text-wec-display text-[8px] text-white/30 font-medium tracking-[0.4em]">
                                    MDT MOTORSPORT TERMINAL
                                </span>
                                <div className="w-8 h-px bg-wec-blue/30" />
                            </div>
                        </div>

                        {/* ── FORM ── */}
                        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
                            <div className="space-y-1.5">
                                <label className="wec-label pl-1 block">Identificador de Piloto</label>
                                <div className="relative group">
                                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-wec-blue/0 group-focus-within:bg-wec-blue transition-colors duration-300" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-wec-void/80 border border-white/5 rounded-lg px-5 py-4 text-sm text-white focus:outline-none focus:border-wec-blue/30 transition-all placeholder:text-white/15"
                                        style={{ fontFamily: 'var(--font-data)' }}
                                        placeholder="piloto@mdt-motorsport.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="wec-label pl-1 block">Clave de Acceso</label>
                                <div className="relative group">
                                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-wec-blue/0 group-focus-within:bg-wec-blue transition-colors duration-300" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-wec-void/80 border border-white/5 rounded-lg px-5 py-4 text-sm text-white focus:outline-none focus:border-wec-blue/30 transition-all placeholder:text-white/15"
                                        style={{ fontFamily: 'var(--font-data)' }}
                                        placeholder="••••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-wec-red/10 border border-wec-red/20 flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-wec-red animate-pulse shrink-0" />
                                    <span className="text-wec-display text-[9px] font-bold text-wec-red/90 uppercase tracking-wider">{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-wec-blue to-wec-blue/80 hover:from-wec-cyan hover:to-wec-blue text-white rounded-lg text-wec-display text-[10px] font-bold uppercase tracking-[0.3em] transition-all duration-500 transform hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group disabled:opacity-50"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    {loading ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Establishing Link...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            Iniciar Sesión
                                        </>
                                    )}
                                </span>
                                <div className="absolute inset-0 wec-shimmer opacity-0 group-hover:opacity-30 transition-opacity" />
                            </button>
                        </form>

                        {/* ── FOOTER INFO ── */}
                        <div className="mt-10 pt-6 border-t border-white/5 relative z-10">
                            <div className="flex items-center justify-between">
                                <div className="text-wec-display text-[7px] text-white/15 uppercase tracking-[0.2em]">
                                    © 2026 MDT Motorsport
                                </div>
                                <div className="text-wec-display text-[8px] text-wec-cyan/30 font-bold tracking-wider tabular-nums">
                                    {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CORNER INDICATORS ── */}
            <div className="fixed top-10 left-10 flex items-center gap-2 opacity-30">
                <div className="w-2 h-px bg-wec-cyan" />
                <div className="w-px h-2 bg-wec-cyan" />
            </div>
            <div className="fixed top-10 right-10 flex items-center gap-2 opacity-30">
                <div className="w-px h-2 bg-wec-cyan" />
                <div className="w-2 h-px bg-wec-cyan" />
            </div>
            <div className="fixed bottom-10 left-10 flex items-center gap-2 opacity-30">
                <div className="w-2 h-px bg-wec-blue" />
                <div className="w-px h-2 bg-wec-blue" />
            </div>
            <div className="fixed bottom-10 right-10 flex items-center gap-2 opacity-30">
                <div className="w-px h-2 bg-wec-blue" />
                <div className="w-2 h-px bg-wec-blue" />
            </div>
        </div>
    );
};

export default Login;
