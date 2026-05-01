import React from 'react';

const CircuitCard = ({ circuit, isSelected, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`group relative w-full aspect-[16/10] rounded-3xl overflow-hidden transition-all duration-700 bg-racing-carbon/50
                ${isSelected 
                    ? 'ring-2 ring-racing-blue shadow-[0_0_50px_rgba(0,112,243,0.3)] scale-[1.02]' 
                    : 'hover:scale-[1.03] hover:ring-1 hover:ring-white/20'}`}
        >
            {/* Immersive Image Layer */}
            <div className="absolute inset-0 z-0">
                {circuit.image ? (
                    <img
                        src={circuit.image}
                        alt={circuit.name}
                        className={`w-full h-full object-cover transition-all duration-1000 
                            ${isSelected ? 'scale-110 blur-[2px]' : 'group-hover:scale-110 group-hover:blur-[1px] brightness-75'}`}
                    />
                ) : (
                    <div className="w-full h-full bg-racing-carbon flex items-center justify-center overflow-hidden">
                        {circuit.countryCode && (
                            <img
                                src={`https://flagcdn.com/w640/${circuit.countryCode.toLowerCase()}.png`}
                                alt={circuit.country}
                                className={`w-full h-full object-cover opacity-20 filter grayscale group-hover:grayscale-0 transition-all duration-1000 
                                    ${isSelected ? 'scale-125 blur-sm' : 'group-hover:scale-110'}`}
                            />
                        )}
                        <div className="absolute inset-0 bg-racing-blue/5" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-racing-black via-racing-black/40 to-transparent" />
                <div className="absolute inset-0 racing-stripes opacity-10" />
            </div>

            {/* Liquid Glass Overlay */}
            <div className={`absolute bottom-0 left-0 right-0 p-6 transition-all duration-700
                ${isSelected ? 'bg-racing-blue/20 backdrop-blur-md' : 'bg-transparent'}`}>
                
                <div className="flex flex-col gap-1 relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] text-racing-blue font-black uppercase tracking-[0.3em]">
                            {circuit.country || 'Internacional'}
                        </span>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>
                    
                    <h3 className="text-2xl font-black text-racing-italic text-white truncate group-hover:text-racing-blue transition-colors">
                        {circuit.name}
                    </h3>
                    
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex gap-2">
                            {circuit.layouts?.slice(0, 1).map(layout => (
                                <span key={layout} className="text-[9px] font-black text-zinc-500 uppercase tracking-widest bg-black/40 px-2.5 py-1 rounded-md border border-white/5">
                                    {layout}
                                </span>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[8px] font-black uppercase text-racing-blue tracking-widest">Analizar</span>
                            <svg className="w-4 h-4 text-racing-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Selection Glow */}
            {isSelected && (
                <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-racing-blue animate-ping shadow-[0_0_20px_rgba(0,112,243,1)]" />
            )}
        </button>
    );
};

export default CircuitCard;
