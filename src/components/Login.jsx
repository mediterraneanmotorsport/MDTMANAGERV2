import React, { useState } from 'react';
import { auth } from '../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';

const Login = ({ error: accessError }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(accessError || '');
    const [loading, setLoading] = useState(false);

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
        <div className="min-h-screen bg-racing-black flex items-center justify-center p-6 relative overflow-hidden selection:bg-racing-blue/30 select-none">
            {/* Drag Handle Top Overlay */}
            <div className="absolute top-0 left-0 right-0 h-16 z-[100]" style={{ WebkitAppRegion: 'drag' }} />
            
            {/* Immersive Background Patterns */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-racing-blue/10 blur-[150px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-racing-orange/5 blur-[150px]" />
                <div className="absolute inset-0 racing-stripes opacity-20" />
            </div>

            <div className="w-full max-w-md relative z-10 motion-blur-in">
                <div className="liquid-glass rounded-[40px] p-10 md:p-12 relative overflow-hidden group border-white/10">
                    <div className="absolute inset-0 shimmer-bg opacity-5 pointer-events-none" />
                    
                    <div className="flex flex-col items-center mb-12">
                        <div className="w-20 h-20 rounded-3xl liquid-glass flex items-center justify-center mb-8 border-racing-blue/20 shadow-[0_0_30px_rgba(0,112,243,0.2)]">
                            <img src="logo.png" alt="MDT" className="w-12 h-auto" />
                        </div>
                        <h1 className="text-3xl font-black text-racing-italic mb-2 tracking-tight">ACCESO <span className="text-racing-blue">TERMINAL</span></h1>
                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.3em]">Acceso Restringido a MDT Motorsport</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-4">Identificador de Sector (Email)</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full liquid-glass rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-racing-blue/10 transition-all font-medium border-white/5"
                                placeholder="piloto@mdt.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-4">Clave de Seguridad (Contraseña)</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full liquid-glass rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-racing-blue/10 transition-all font-medium border-white/5"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest text-center animate-bounce">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 bg-racing-blue hover:bg-racing-blue/90 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] transition-all transform hover:scale-[1.02] active:scale-95 shadow-2xl shadow-racing-blue/30 relative overflow-hidden group"
                        >
                            <span className="relative z-10">{loading ? 'Estableciendo Enlace...' : 'Iniciar Secuencia'}</span>
                            <div className="absolute inset-0 shimmer-bg opacity-0 group-hover:opacity-20 transition-opacity" />
                        </button>
                    </form>

                    <div className="mt-12 text-center">
                        <div className="text-[8px] text-zinc-700 font-black uppercase tracking-[0.2em] border-t border-white/5 pt-8">
                            © 2026 MDT Motorsport • Secured Channel
                        </div>
                    </div>
                </div>
            </div>

            {/* Tactical Corners */}
            <div className="fixed top-12 left-12 w-12 h-px bg-white/10" />
            <div className="fixed top-12 left-12 w-px h-12 bg-white/10" />
            <div className="fixed bottom-12 right-12 w-12 h-px bg-white/10" />
            <div className="fixed bottom-12 right-12 w-px h-12 bg-white/10" />
        </div>
    );
};

export default Login;
