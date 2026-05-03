import React from 'react';

const CircuitCard = ({ circuit, isSelected, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`group relative w-full aspect-[16/10] overflow-hidden transition-all duration-500
                ${isSelected 
                    ? 'scale-[1.02] z-10' 
                    : 'hover:scale-[1.02]'}`}
        >
            {/* WEC Angular Clip Container */}
            <div className={`absolute inset-0 wec-clip-notch rounded-lg overflow-hidden transition-all duration-500
                ${isSelected 
                    ? 'ring-1 ring-wec-cyan shadow-[0_0_40px_rgba(0,212,255,0.2)]' 
                    : 'ring-1 ring-white/5 hover:ring-wec-blue/30'}`}>
                
                {/* Image Layer */}
                <div className="absolute inset-0 z-0">
                    {circuit.image ? (
                        <img
                            src={circuit.image}
                            alt={circuit.name}
                            className={`w-full h-full object-cover transition-all duration-700 
                                ${isSelected ? 'scale-110 brightness-50' : 'group-hover:scale-105 brightness-[0.4] group-hover:brightness-50'}`}
                        />
                    ) : (
                        <div className="w-full h-full bg-wec-surface flex items-center justify-center overflow-hidden">
                            {circuit.countryCode && (
                                <img
                                    src={`https://flagcdn.com/w640/${circuit.countryCode.toLowerCase()}.png`}
                                    alt={circuit.country}
                                    className={`w-full h-full object-cover opacity-15 filter grayscale group-hover:grayscale-0 group-hover:opacity-25 transition-all duration-700 
                                        ${isSelected ? 'scale-125 opacity-25 grayscale-0' : 'group-hover:scale-105'}`}
                                />
                            )}
                        </div>
                    )}
                    {/* Gradient overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-wec-black via-wec-black/50 to-transparent" />
                    <div className="absolute inset-0 wec-stripes opacity-20" />
                    {isSelected && <div className="absolute inset-0 bg-wec-cyan/5" />}
                </div>

                {/* Top-left corner accent (WEC-style category marker) */}
                <div className={`absolute top-0 left-0 transition-all duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <div className="w-8 h-8">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-wec-cyan to-transparent" />
                        <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-wec-cyan to-transparent" />
                    </div>
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-5 relative z-10">
                    {/* Country tag */}
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-1 h-3 transition-colors duration-300 ${isSelected ? 'bg-wec-cyan' : 'bg-wec-blue/50 group-hover:bg-wec-blue'}`} />
                        <span className="text-wec-display text-[8px] font-bold uppercase tracking-[0.25em] text-white/40 group-hover:text-wec-cyan/70 transition-colors">
                            {circuit.country || 'Internacional'}
                        </span>
                    </div>
                    
                    {/* Circuit name */}
                    <h3 className={`text-xl font-bold text-white uppercase tracking-tight leading-tight truncate transition-colors duration-300
                        ${isSelected ? 'text-wec-cyan' : 'group-hover:text-white'}`}
                        style={{ fontFamily: 'var(--font-body)' }}>
                        {circuit.name}
                    </h3>
                    
                    {/* Bottom info bar */}
                    <div className="flex items-center justify-between mt-3">
                        <div className="flex gap-1.5">
                            {circuit.layouts?.slice(0, 2).map(layout => (
                                <span key={layout} className="text-wec-display text-[7px] font-bold text-white/25 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                    {layout}
                                </span>
                            ))}
                        </div>
                        <div className={`flex items-center gap-1.5 transition-all duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'}`}>
                            <span className="text-wec-display text-[7px] font-bold uppercase text-wec-cyan tracking-wider">Abrir</span>
                            <svg className="w-3 h-3 text-wec-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </div>
                </div>

                {/* Selection indicator dot */}
                {isSelected && (
                    <div className="absolute top-3 right-3">
                        <div className="w-2 h-2 rounded-full bg-wec-cyan wec-live-dot shadow-[0_0_10px_rgba(0,212,255,0.6)]" />
                    </div>
                )}
            </div>
        </button>
    );
};

export default CircuitCard;
