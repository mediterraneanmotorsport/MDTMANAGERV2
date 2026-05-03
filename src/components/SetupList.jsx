import React, { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase/config';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, increment, orderBy } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';

const SetupList = ({ circuit, car, gamePath, onClose, userRole, installedSetups, userFavorites }) => {
    const [setups, setSetups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState(null);
    const [installed, setInstalled] = useState({});
    const [localManifest, setLocalManifest] = useState({});
    const [remoteStatus, setRemoteStatus] = useState({});
    const [comments, setComments] = useState({});
    const [newComment, setNewComment] = useState({});
    const [expandedSetup, setExpandedSetup] = useState(null);

    useEffect(() => {
        if (!circuit?.id || !car) {
            setSetups([]);
            setLoading(false);
            return;
        }
        setLoading(true);

        const q = query(
            collection(db, 'setups'),
            where('circuit', '==', circuit.id),
            where('car', '==', car)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSetups(results);

            if (window.electronAPI && gamePath) {
                const status = {};
                const manifest = await window.electronAPI.getLocalManifest({
                    circuit: circuit.name,
                    gamePath
                });
                setLocalManifest(manifest);

                for (const setup of results) {
                    const exists = await window.electronAPI.checkFileExists({
                        circuit: circuit.name,
                        fileName: setup.file,
                        gamePath
                    });
                    if (exists) status[setup.id] = true;
                }
                setInstalled(status);
            }
            setLoading(false);
        }, (err) => {
            console.error("SetupList Error:", err);
            setLoading(false); // Liberar carga incluso si hay error
        });

        const unsubComments = onSnapshot(
            query(collection(db, 'setup_comments'), where('circuitId', '==', circuit.id), orderBy('timestamp', 'asc')),
            (snapshot) => {
                const comms = {};
                snapshot.docs.forEach(doc => {
                    const d = doc.data();
                    if (!comms[d.setupId]) comms[d.setupId] = [];
                    comms[d.setupId].push({ id: doc.id, ...d });
                });
                setComments(comms);
            }
        );

        return () => {
            unsubscribe();
            unsubComments();
        };
    }, [circuit, car, gamePath]);

    const handleInstall = async (setup) => {
        setInstalling(setup.id);
        try {
            const storageRef = ref(storage, setup.storagePath);
            const downloadUrl = await getDownloadURL(storageRef);

            if (window.electronAPI) {
                await window.electronAPI.downloadSetup({
                    url: downloadUrl,
                    circuit: circuit.name,
                    fileName: setup.file,
                    gamePath,
                    version: setup.gameVersion,
                    lastUpdated: setup.lastUpdated
                });
                setInstalled(prev => ({ ...prev, [setup.id]: true }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setInstalling(null);
        }
    };

    const handleToggleFavorite = async (setupId) => {
        if (!auth.currentUser) return;
        const isFav = userFavorites.includes(setupId);
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
            favorites: isFav ? arrayRemove(setupId) : arrayUnion(setupId)
        });
    };

    const handleAddComment = async (setupId) => {
        const text = newComment[setupId];
        if (!text?.trim() || !auth.currentUser) return;
        await addDoc(collection(db, 'setup_comments'), {
            setupId,
            circuitId: circuit.id,
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
            text,
            timestamp: serverTimestamp()
        });
        setNewComment({ ...newComment, [setupId]: "" });
    };

    const handleDeleteLocal = async (setup) => {
        console.log("SetupList: [INTENT] Borrado local de:", setup.file);
        if (!gamePath || !window.electronAPI) {
            console.error("SetupList: Error, faltan dependencias para borrar");
            return;
        }
        
        if (!window.confirm(`¿Seguro que quieres eliminar "${setup.file}" de tu PC?`)) return;
        
        try {
            const success = await window.electronAPI.deleteSetup({
                circuit: circuit.name,
                fileName: setup.file,
                gamePath
            });
            console.log("SetupList: [RESULT] Borrado exitoso:", success);
            if (success) {
                setInstalled(prev => ({ ...prev, [setup.id]: false }));
            }
        } catch (err) {
            console.error("SetupList: [ERROR] Error al borrar setup local:", err);
        }
    };

    return (
        <div 
            className="w-screen lg:w-[580px] h-full wec-glass border-l border-wec-border flex flex-col overflow-hidden pointer-events-auto shadow-[0_0_80px_rgba(0,0,0,0.7)] wec-slide-left"
            style={{ WebkitAppRegion: 'no-drag' }}
        >
            {/* Tactical Header */}
            <header className="p-6 border-b border-wec-border relative overflow-hidden shrink-0">
                <div className="absolute inset-0 wec-shimmer opacity-10" />
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-wec-cyan via-wec-blue to-transparent" />
                <div className="flex items-center justify-between relative z-10">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-wec-gold" />
                            <span className="wec-label text-wec-gold/70">Circuito</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white uppercase tracking-tight truncate max-w-sm" style={{fontFamily:'var(--font-body)'}}>{circuit.name}</h3>
                        <p className="text-[10px] text-white/20 font-medium uppercase tracking-wider">{car} • Setups</p>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{ WebkitAppRegion: 'no-drag' }}
                        className="p-2.5 bg-white/3 hover:bg-white/5 rounded-lg transition-all border border-white/5 text-white/30 hover:text-white"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </header>

            {/* Setups Container */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 wec-scrollbar bg-wec-void/40">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-5">
                        <div className="w-10 h-10 rounded-full border-2 border-wec-blue/20 border-t-wec-cyan animate-spin" />
                        <div className="text-center space-y-1">
                            <span className="text-wec-display text-[8px] font-bold uppercase tracking-[0.4em] text-wec-cyan/50 block">Conectando</span>
                            <span className="text-wec-display text-[7px] text-white/10 uppercase tracking-wider block">Sincronizando...</span>
                        </div>
                    </div>
                ) : setups.length > 0 ? (
                    setups.map((setup, idx) => (
                        <div 
                            key={setup.id} 
                            className="motion-blur-in"
                            style={{ animationDelay: `${idx * 0.1}s` }}
                        >
                            <div className={`p-5 rounded-lg border transition-all duration-300 group relative
                                ${userFavorites.includes(setup.id) 
                                    ? 'bg-wec-blue/5 border-wec-blue/20 shadow-[0_0_20px_rgba(0,144,255,0.05)]' 
                                    : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.02]'}`}>
                                
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all">
                                    <div className="text-[8px] font-black text-racing-blue uppercase tracking-widest bg-racing-blue/10 px-2 py-1 rounded">ARCHIVO SVM</div>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => handleToggleFavorite(setup.id)}
                                                className={`transition-all active:scale-150 ${userFavorites.includes(setup.id) ? 'text-racing-orange' : 'text-zinc-700 hover:text-white'}`}
                                            >
                                                <svg className="w-6 h-6" fill={userFavorites.includes(setup.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-lg font-black text-white italic tracking-tight truncate">{setup.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-zinc-500 font-mono">v{setup.gameVersion || '1.0'}</span>
                                                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{setup.engineer || 'Lab MDT'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {setup.tags?.map(tag => (
                                                <span key={tag} className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black text-zinc-500 uppercase tracking-widest italic hover:text-racing-blue transition-all">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            disabled={installing === setup.id}
                                            onClick={() => handleInstall(setup)}
                                            className={`
                                                px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] transition-all min-w-[110px] shadow-lg
                                                ${(installed[setup.id])
                                                    ? 'bg-racing-success/10 text-racing-success border border-racing-success/20'
                                                    : 'bg-racing-blue hover:scale-105 active:scale-95 text-white shadow-racing-blue/20'}
                                            `}
                                        >
                                            {installing === setup.id ? 'Refrescando...' : installed[setup.id] ? 'Activo' : 'Instalar'}
                                        </button>
                                        
                                        {installed[setup.id] && (
                                            <button
                                                onClick={() => handleDeleteLocal(setup)}
                                                className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20"
                                                title="Eliminar de mi PC"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                        
                                        <button 
                                            onClick={() => setExpandedSetup(expandedSetup === setup.id ? null : setup.id)}
                                            className={`p-3 rounded-xl transition-all border ${expandedSetup === setup.id ? 'bg-white/10 border-white/20' : 'bg-transparent border-white/5 hover:bg-white/5'}`}
                                        >
                                            <svg className={`w-4 h-4 text-zinc-500 transition-transform duration-500 ${expandedSetup === setup.id ? 'rotate-180 text-racing-blue' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {expandedSetup === setup.id && (
                                    <div className="mt-8 pt-8 border-t border-white/5 animate-in slide-in-from-top duration-500">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-8 h-0.5 bg-zinc-800 rounded-full" />
                                            <h5 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Feedback del Equipo</h5>
                                        </div>
                                        
                                        <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar mb-6">
                                            {comments[setup.id]?.map((comment, cidx) => (
                                                <div key={cidx} className="bg-white/5 p-4 rounded-xl border border-white/5">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-black text-racing-blue uppercase tracking-widest">{comment.userName}</span>
                                                        <span className="text-[9px] text-zinc-600 font-mono italic">
                                                            {comment.timestamp?.toDate ? comment.timestamp.toDate().toLocaleTimeString() : 'AHORA'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-zinc-400 leading-relaxed">{comment.text}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={newComment[setup.id] || ''}
                                                onChange={(e) => setNewComment({ ...newComment, [setup.id]: e.target.value })}
                                                placeholder="Añadir nota de telemetría..."
                                                className="flex-1 bg-white/5 border border-white/5 rounded-xl px-5 py-3 text-xs focus:outline-none focus:border-racing-blue transition-all selection:bg-racing-blue select-text relative z-20 pointer-events-auto"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddComment(setup.id)}
                                            />
                                            <button 
                                                onClick={() => handleAddComment(setup.id)}
                                                className="p-3 bg-racing-blue/10 text-racing-blue rounded-xl hover:bg-racing-blue/20 transition-all border border-racing-blue/20"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 opacity-20">
                        <svg className="w-16 h-16 mb-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Sin Datos Recibidos</p>
                    </div>
                )}
            </div>

            <footer className="p-4 bg-wec-void/50 border-t border-wec-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-wec-green wec-live-dot" />
                    <span className="text-wec-display text-[7px] font-bold uppercase tracking-wider text-white/15">Link Active</span>
                </div>
                <div className="text-wec-display text-[7px] text-white/10 font-medium uppercase tracking-wider">MDT Terminal v4.0</div>
            </footer>
        </div>
    );
};

export default SetupList;
