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
        <div className="fixed inset-0 w-screen h-screen bg-wec-black z-[9999] flex items-center justify-center overflow-hidden">
            <video 
                ref={videoRef}
                className="w-full h-full object-cover"
                onEnded={onFinish}
                autoPlay
                muted={false}
            >
                <source src="intro.mp4" type="video/mp4" />
            </video>

            {/* Cinematic overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-wec-black/60 via-transparent to-wec-black/30 pointer-events-none" />
            <div className="absolute inset-0 wec-scanlines pointer-events-none opacity-20" />

            {/* Skip Button - WEC Style */}
            <button 
                onClick={onFinish}
                className="absolute bottom-10 right-10 z-[10000] group flex items-center gap-3 bg-wec-void/40 hover:bg-wec-void/70 border border-white/10 hover:border-wec-cyan/30 px-5 py-2.5 rounded-lg transition-all duration-300 backdrop-blur-lg"
            >
                <div className="flex flex-col items-end">
                    <span className="text-wec-display text-[7px] text-white/20 font-medium uppercase tracking-[0.2em] group-hover:text-wec-cyan/50 transition-colors">Skip</span>
                    <span className="text-wec-display text-[9px] text-white/60 font-bold uppercase tracking-wider group-hover:text-white transition-colors">Saltar Video</span>
                </div>
                <div className="w-7 h-7 rounded border border-white/10 flex items-center justify-center group-hover:border-wec-cyan/30 group-hover:scale-110 transition-all">
                    <svg className="w-3 h-3 text-white/40 group-hover:text-wec-cyan fill-current transition-colors" viewBox="0 0 24 24">
                        <path d="M6 18L14.5 12L6 6V18ZM16 6V18H18V6H16Z" />
                    </svg>
                </div>
            </button>

            {/* WEC Brand Corner */}
            <div className="absolute top-10 left-10 opacity-40 flex items-center gap-2">
                <div className="w-[2px] h-5 bg-wec-cyan" />
                <span className="text-wec-display text-[9px] font-bold tracking-[0.4em] text-white">MDT MOTORSPORT</span>
            </div>

            {/* Corner brackets */}
            <div className="absolute top-8 right-8 w-6 h-6 border-r border-t border-wec-cyan/15 pointer-events-none" />
            <div className="absolute bottom-8 left-8 w-6 h-6 border-l border-b border-wec-cyan/15 pointer-events-none" />
        </div>
    );
};

export default VideoIntro;
