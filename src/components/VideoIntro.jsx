import React, { useRef, useEffect } from 'react';

const VideoIntro = ({ onFinish }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.play().catch(err => {
                console.log("Autoplay blocked or failed:", err);
            });
        }
    }, []);

    return (
        <div className="fixed inset-0 w-screen h-screen bg-black z-[9999] flex items-center justify-center overflow-hidden">
            <video 
                ref={videoRef}
                className="w-full h-full object-cover"
                onEnded={onFinish}
                autoPlay
                muted={false} // Permitimos sonido para máxima inmersión
            >
                <source src="/intro.mp4" type="video/mp4" />
            </video>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />

            {/* Skip Button */}
            <button 
                onClick={onFinish}
                className="absolute bottom-12 right-12 z-[10000] group flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-racing-blue/50 px-6 py-3 rounded-full transition-all duration-500 backdrop-blur-md"
            >
                <div className="flex flex-col items-end">
                    <span className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.3em] group-hover:text-racing-blue transition-colors">Omitir Cinemática</span>
                    <span className="text-[10px] text-white font-bold uppercase tracking-widest">Saltar Video</span>
                </div>
                <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 24 24">
                        <path d="M6 18L14.5 12L6 6V18ZM16 6V18H18V6H16Z" />
                    </svg>
                </div>
            </button>

            {/* MDT Brand ID (Optional corner logo) */}
            <div className="absolute top-12 left-12 opacity-50 flex items-center gap-3">
                <div className="w-1 h-6 bg-racing-blue" />
                <span className="text-[10px] font-black tracking-[0.5em] text-white italic">MDT MOTORSPORT</span>
            </div>
        </div>
    );
};

export default VideoIntro;
