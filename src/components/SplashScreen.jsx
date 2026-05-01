import React from 'react';

const SplashScreen = ({ onFinish }) => {
    return (
        <div className="h-screen w-full bg-racing-black flex items-center justify-center relative overflow-hidden select-none">
            {/* Drag Handle */}
            <div className="absolute top-0 left-0 right-0 h-16 z-[100]" style={{ WebkitAppRegion: 'drag' }} />
            
            {/* Background Atmosphere */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-racing-blue/10 blur-[150px] animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-racing-orange/5 blur-[150px]" />
            <div className="absolute inset-0 racing-stripes opacity-10 animate-[shimmer_10s_infinite_linear]" />
            
            <div className="relative z-10 flex flex-col items-center motion-blur-in">
                <img 
                    src="logo.png" 
                    alt="MDT" 
                    className="w-48 h-auto mb-16 drop-shadow-[0_0_50px_rgba(0,112,243,0.6)] animate-pulse" 
                />
                
                <div className="flex flex-col items-center gap-6">
                    <div className="w-80 h-1 bg-white/5 rounded-full overflow-hidden p-[1px]">
                        <div className="h-full bg-racing-blue shadow-[0_0_15px_rgba(0,112,243,0.8)] animate-[shimmer_2s_infinite_linear] shimmer-bg rounded-full" style={{ width: '40%' }} />
                    </div>
                    
                    <div className="space-y-2 text-center">
                        <div className="text-[10px] text-racing-blue font-black uppercase tracking-[0.6em] animate-pulse">Iniciando Terminal</div>
                        <div className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest opacity-50">Estableciendo Enlace Seguro...</div>
                    </div>
                </div>

                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full text-center">
                    <button 
                        onClick={onFinish}
                        className="px-10 py-4 liquid-glass rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] text-white hover:text-racing-blue hover:border-racing-blue/40 transition-all duration-500 group"
                    >
                        <span className="relative z-10">Omitir Secuencia</span>
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                    </button>
                </div>
            </div>

            {/* Tactical Frame Elements */}
            <div className="fixed top-8 left-8 text-[8px] font-mono text-zinc-800 uppercase tracking-widest vertical-text select-none">MDT_SYSTEM_OS_v3.0</div>
            <div className="fixed bottom-8 right-8 text-[8px] font-mono text-zinc-800 uppercase tracking-widest select-none">Auth_Relay_Active</div>
        </div>
    );
};

export default SplashScreen;
