import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../firebase/config';
import { onSnapshot, collection, addDoc, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth } from '../firebase/config';
import { sendDiscordNotification } from '../services/discordService';

const TeamManagement = () => {
    const [webhook, setWebhook] = useState('');
    const [members, setMembers] = useState([]);
    const [newMember, setNewMember] = useState('');
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'settings', 'discord'));
                if (docSnap.exists()) setWebhook(docSnap.data().url || '');
            } catch (err) { console.error("Error loading settings:", err); }
        };
        loadSettings();
        const unsubMembers = onSnapshot(collection(db, 'mdt_members'), (snapshot) => {
            setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubMembers();
    }, []);

    const saveWebhook = async () => {
        await setDoc(doc(db, 'settings', 'discord'), { url: webhook });
        alert("✅ Webhook guardado");
    };

    const testDiscord = async () => {
        if (!webhook) return alert("⚠️ Pega primero la URL del Webhook");
        setTesting(true);
        try {
            await sendDiscordNotification(webhook, {
                pilot: "Aitor Moduga",
                circuit: "Paul Ricard - 1A-V2",
                car: "Ginetta G61-LT-P325 Evo",
                lapTime: 112.500, // 1:52.500
                category: "LMP3",
                improvement: 0.740,
                previousTime: 113.240, // 1:53.240
                sectors: { s1: 28.452, s2: 38.120, s3: 45.928 },
                topSpeed: "284.5",
                isTest: false
            });
            alert("🚀 Mensaje de prueba de Aitor Moduga forzado a Discord");
        } catch (err) {
            alert("❌ Error al enviar: " + err.message);
        } finally {
            setTesting(false);
        }
    };

    const addMember = async () => {
        if (!newMember.trim()) return;
        await addDoc(collection(db, 'mdt_members'), { name: newMember.trim() });
        setNewMember('');
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto p-4 bg-wec-void/80 rounded-xl border border-white/5 relative z-[100] pointer-events-auto">
            <div className="space-y-4">
                <h3 className="text-white font-bold uppercase text-xs">Configuración Discord</h3>
                <input 
                    type="text" 
                    value={webhook} 
                    onChange={(e) => { console.log("Webhook Change:", e.target.value); setWebhook(e.target.value); }}
                    className="w-full bg-white/10 border border-white/20 p-3 rounded text-white pointer-events-auto text-sm"
                    placeholder="URL del Webhook..."
                />
                <div className="flex gap-2">
                    <button onClick={saveWebhook} className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white font-bold text-[10px] uppercase tracking-widest transition-all">Guardar Webhook</button>
                    <button 
                        onClick={testDiscord} 
                        disabled={testing}
                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded text-white font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        {testing ? 'Enviando...' : (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-racing-success animate-pulse" />
                                Probar Conexión
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="space-y-4 pt-8 border-t border-white/10">
                <h3 className="text-white font-bold uppercase text-xs">Añadir Piloto Oficial</h3>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        autoFocus
                        value={newMember} 
                        onChange={(e) => { console.log("New Member Change:", e.target.value); setNewMember(e.target.value); }}
                        className="flex-1 bg-white/10 border border-white/20 p-3 rounded text-white pointer-events-auto"
                        placeholder="Nombre del piloto..."
                    />
                    <button onClick={addMember} className="bg-orange-600 px-4 py-2 rounded text-white font-bold">Añadir</button>
                </div>
                <div className="space-y-2">
                    {members.map(m => (
                        <div key={m.id} className="flex justify-between p-2 bg-white/5 rounded border border-white/5">
                            <span className="text-white">{m.name}</span>
                            <button onClick={() => deleteDoc(doc(db, 'mdt_members', m.id))} className="text-red-500">Eliminar</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const AdminPanel = ({ onClose, circuits, cars }) => {
    console.log("AdminPanel: Rendering start...");
    const [activeTab, setActiveTab] = useState('setups');
    const [loading, setLoading] = useState(false);

    // New state for setups management
    const [setups, setSetups] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [quickUpload, setQuickUpload] = useState(null); // { car, files }
    
    // New state for leaderboard
    const [leaderboardRecords, setLeaderboardRecords] = useState([]);
    const [filterCircuit, setFilterCircuit] = useState('ALL');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterVersion, setFilterVersion] = useState('ALL');

    useEffect(() => {
        const unsubSetups = onSnapshot(collection(db, 'setups'), (snapshot) => {
            setSetups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubLeaderboard = onSnapshot(collection(db, 'lmu_leaderboard'), (snapshot) => {
            setLeaderboardRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => {
            unsubSetups();
            unsubLeaderboard();
        };
    }, []);

    const [circuitForm, setCircuitForm] = useState({ name: '', country: '', countryCode: '', layouts: '' });
    const [carForm, setCarForm] = useState({ category: '', model: '' });
    const [setupForm, setSetupForm] = useState({ 
        name: '', 
        author: '', 
        circuit: '', 
        car: '', 
        files: [], // Changed from 'file' to 'files' for bulk
        gameVersion: '',
        tags: [],
        engineerNotes: ''
    });

    const handleTagToggle = (tag) => {
        setSetupForm(prev => ({
            ...prev,
            tags: prev.tags.includes(tag) 
                ? prev.tags.filter(t => t !== tag) 
                : [...prev.tags, tag]
        }));
    };

    const handleAddCircuit = async (e) => {
        e.preventDefault();
        console.log("Admin: [START] Processing circuit:", circuitForm.name);
        setLoading(true);
        try {
            const data = {
                ...circuitForm,
                countryCode: circuitForm.countryCode.toLowerCase().trim(),
                layouts: circuitForm.layouts.split(',').map(l => l.trim())
            };

            if (editingId) {
                await updateDoc(doc(db, 'circuits', editingId), data);
                alert("✅ Circuito actualizado");
            } else {
                await addDoc(collection(db, 'circuits'), data);
                alert("✅ Circuito añadido");
            }

            setCircuitForm({ name: '', country: '', countryCode: '', layouts: '' });
            setEditingId(null);
        } catch (err) {
            console.error("Admin: [ERROR] Processing circuit:", err);
            alert("❌ Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCar = async (e) => {
        e.preventDefault();
        console.log("Admin: [START] Processing car:", carForm.model);
        setLoading(true);
        try {
            if (editingId) {
                await updateDoc(doc(db, 'cars', editingId), carForm);
                alert("✅ Vehículo actualizado");
            } else {
                await addDoc(collection(db, 'cars'), carForm);
                alert("✅ Vehículo añadido");
            }
            setCarForm({ category: '', model: '' });
            setEditingId(null);
        } catch (err) {
            console.error("Admin: [ERROR] Processing car:", err);
            alert("❌ Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadSetups = async (e) => {
        e.preventDefault();
        if (setupForm.files.length === 0) {
            alert("⚠️ Selecciona al menos un archivo .svm primero");
            return;
        }
        
        console.log(`Admin: [START] Uploading ${setupForm.files.length} setups...`);
        setLoading(true);
        let successCount = 0;

        try {
            for (const file of setupForm.files) {
                // 1. Upload to Storage
                const storagePath = `setups/${setupForm.circuit}/${file.name}`;
                const fileRef = ref(storage, storagePath);
                await uploadBytes(fileRef, file);

                // 2. Save to Firestore
                await addDoc(collection(db, 'setups'), {
                    name: setupForm.files.length === 1 ? setupForm.name : file.name.replace('.svm', ''),
                    author: setupForm.author,
                    circuit: setupForm.circuit,
                    car: setupForm.car,
                    file: file.name,
                    storagePath: storagePath,
                    gameVersion: setupForm.gameVersion,
                    tags: setupForm.tags,
                    engineerNotes: setupForm.engineerNotes,
                    downloadCount: 0,
                    lastUpdated: new Date().toISOString()
                });
                successCount++;
            }
            
            alert(`✅ ${successCount} Setups subidos con éxito`);
            setSetupForm({ 
                name: '', author: '', circuit: '', car: '', files: [], 
                gameVersion: '', tags: [], engineerNotes: '' 
            });
        } catch (err) {
            console.error("Admin: [ERROR] Adding setups:", err);
            alert("❌ Error al subir: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCircuit = async (id) => {
        if (!window.confirm("¿Seguro que quieres borrar este circuito? Se borrarán todos los trazados asociados.")) return;
        try {
            await deleteDoc(doc(db, 'circuits', id));
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteCar = async (id) => {
        if (!window.confirm("¿Seguro que quieres borrar este vehículo?")) return;
        try {
            await deleteDoc(doc(db, 'cars', id));
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteSetup = async (setup) => {
        if (!window.confirm("¿Seguro que quieres borrar este setup y su archivo asociado?")) return;
        setLoading(true);
        try {
            // 1. Delete Firestore entry
            await deleteDoc(doc(db, 'setups', setup.id));

            // 2. Delete from Storage
            const fileRef = ref(storage, setup.storagePath);
            await deleteObject(fileRef);

            alert("✅ Setup eliminado correctamente");
        } catch (err) {
            console.error("Error deleting setup:", err);
            alert("❌ Error al eliminar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickUpload = async (e) => {
        e.preventDefault();
        if (!quickUpload?.circuit) {
            alert("⚠️ Selecciona un circuito");
            return;
        }
        
        setLoading(true);
        let successCount = 0;
        try {
            for (const file of quickUpload.files) {
                const storagePath = `setups/${quickUpload.circuit}/${file.name}`;
                const fileRef = ref(storage, storagePath);
                await uploadBytes(fileRef, file);

                await addDoc(collection(db, 'setups'), {
                    name: file.name.replace('.svm', ''),
                    author: auth.currentUser?.displayName || 'Ingeniero MDT',
                    circuit: quickUpload.circuit,
                    car: quickUpload.car.model,
                    file: file.name,
                    storagePath: storagePath,
                    gameVersion: '1.0',
                    tags: ['QUICK-LOAD'],
                    engineerNotes: 'Subida rápida mediante Drag & Drop',
                    downloadCount: 0,
                    lastUpdated: new Date().toISOString()
                });
                successCount++;
            }
            alert(`✅ ${successCount} Setups subidos (Modo Quick)`);
            setQuickUpload(null);
        } catch (err) {
            console.error(err);
            alert("❌ Error en subida rápida");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteLeaderboardRecord = async (record) => {
        if (!window.confirm(`¿Seguro que quieres borrar el tiempo de ${record.name} (${record.bestLap.toFixed(3)}s) del Leaderboard Global? (Se ignorará permanentemente)`)) return;
        setLoading(true);
        try {
            // Normalización para bloqueo total
            const circ = (record.circuit || '').trim().toLowerCase();
            const cat = (record.category || '').trim().toLowerCase();
            const name = (record.name || '').trim().toLowerCase();
            const baseKey = `${circ}_${cat}_${name}`;

            // 1. Borrar de la tabla principal
            await deleteDoc(doc(db, 'lmu_leaderboard', record.id));
            
            // 2. Bloqueo de ID exacto
            await setDoc(doc(db, 'ignored_records', record.id), {
                deletedAt: new Date().toISOString(),
                bestLap: record.bestLap,
                reason: 'Deletion from Admin Panel',
                type: 'specific'
            });

            // 3. Bloqueo de IDENTIDAD base (Para que no suba variantes)
            await setDoc(doc(db, 'ignored_records', baseKey), {
                deletedAt: new Date().toISOString(),
                bestLap: record.bestLap,
                reason: 'Identity block from Admin Panel',
                type: 'base'
            });

            alert("✅ Tiempo eliminado e identidad bloqueada para futuras sincronizaciones");
        } catch (err) {
            console.error("Error deleting leaderboard record:", err);
            alert("❌ Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredLeaderboardRecords = useMemo(() => {
        let filtered = leaderboardRecords;
        if (filterCircuit !== 'ALL') filtered = filtered.filter(e => e.circuit === filterCircuit);
        if (filterCategory !== 'ALL') filtered = filtered.filter(e => e.category === filterCategory);
        if (filterVersion !== 'ALL') filtered = filtered.filter(e => e.gameVersion === filterVersion);
        return filtered.sort((a, b) => a.bestLap - b.bestLap);
    }, [leaderboardRecords, filterCircuit, filterCategory, filterVersion]);

    const handleClearAllLeaderboard = async () => {
        const isFiltered = filterCircuit !== 'ALL' || filterCategory !== 'ALL' || filterVersion !== 'ALL';
        const msg = isFiltered 
            ? `⚠️ PELIGRO: Vas a borrar ${filteredLeaderboardRecords.length} tiempos que coinciden con los filtros actuales.\n\n¿Estás seguro de continuar?` 
            : `⚠️ PELIGRO EXTREMO: Vas a borrar TODOS los tiempos globales de Firebase.\n\n¿Estás absolutamente seguro?`;
            
        if (!window.confirm(msg)) {
            return;
        }
        
        if (!window.confirm("¿Última oportunidad, confirmar el borrado de estos registros de la nube?")) {
            return;
        }

        setLoading(true);
        try {
            for (const record of filteredLeaderboardRecords) {
                await deleteDoc(doc(db, 'lmu_leaderboard', record.id));
            }
            alert(`✅ ¡Se han borrado ${filteredLeaderboardRecords.length} registros!`);
        } catch (err) {
            console.error("Error clearing leaderboard:", err);
            alert("❌ Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full bg-wec-carbon flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-wec-border flex items-center justify-between bg-wec-void/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-wec-orange to-wec-red flex items-center justify-center">
                            <span className="text-wec-display text-[10px] text-white font-bold">A</span>
                        </div>
                        <h2 className="text-lg font-bold tracking-tight text-white uppercase" style={{fontFamily:'var(--font-body)'}}>Panel de <span className="text-wec-cyan">Administración</span></h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition text-white/20 hover:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex bg-wec-void/80 border-b border-wec-border p-1 gap-0.5">
                    {['setups', 'circuits', 'cars', 'manage-setups', 'leaderboard', 'team'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => {
                                setActiveTab(tab);
                                setEditingId(null);
                                setCircuitForm({ name: '', country: '', countryCode: '', layouts: '' });
                                setCarForm({ category: '', model: '' });
                                setSetupForm({ 
                                    name: '', author: '', circuit: '', car: '', 
                                    files: [], gameVersion: '', tags: [], engineerNotes: '' 
                                });
                            }}
                            className={`flex-1 py-2.5 text-wec-display text-[8px] font-bold uppercase tracking-wider transition-all rounded-md
                                ${activeTab === tab ? 'bg-wec-blue/10 text-wec-cyan border border-wec-blue/20' : 'text-white/25 hover:text-white/50 border border-transparent'}`}
                        >
                            {tab === 'setups' ? 'Subir' :
                                tab === 'manage-setups' ? 'Gestionar' :
                                    tab === 'circuits' ? 'Circuitos' : 
                                        tab === 'leaderboard' ? 'Records' : 
                                            tab === 'team' ? 'Equipo' : 'Coches'}
                        </button>
                    ))}
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto wec-scrollbar p-6 relative z-10">
                    {activeTab === 'manage-setups' && (
                        <div className="space-y-4 relative z-20">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Lista de Setups Existentes</h3>
                                <div className="text-[10px] text-zinc-600 font-mono">Total: {setups.length}</div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {setups.map(s => (
                                    <div key={s.id} className="bg-[#1a1a1a] border border-white/5 p-4 rounded-xl flex items-center justify-between group pointer-events-auto">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-white">{s.name}</h4>
                                                {s.tags?.map(t => (
                                                    <span key={t} className="text-[8px] bg-racing-blue/10 text-racing-blue px-1.5 py-0.5 rounded border border-racing-blue/20">{t}</span>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{s.car} • {circuits.find(c => c.id === s.circuit)?.name || 'Unknown'} • v{s.gameVersion || '1.0'}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right mr-4">
                                                <div className="text-[10px] font-bold text-racing-orange">{s.downloadCount || 0}</div>
                                                <div className="text-[8px] text-zinc-600 uppercase font-black">Descargas</div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteSetup(s)}
                                                className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTab === 'setups' && (
                        <form onSubmit={handleUploadSetups} className="space-y-6 max-w-lg mx-auto relative z-20 pointer-events-auto">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Nueva Configuración (Setup)</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Nombre del Setup (ignorado en carga masiva)</label>
                                    <input type="text" value={setupForm.name} onChange={e => setSetupForm({ ...setupForm, name: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue outline-none transition-all placeholder:text-zinc-700" placeholder="Ej: Quali Setup Le Mans" />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Autor</label>
                                    <input required type="text" value={setupForm.author} onChange={e => setSetupForm({ ...setupForm, author: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Versión Juego</label>
                                    <input required type="text" value={setupForm.gameVersion} onChange={e => setSetupForm({ ...setupForm, gameVersion: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue outline-none transition-all" placeholder="v1.2.3" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Seleccionar Circuito</label>
                                    <select required value={setupForm.circuit} onChange={e => setSetupForm({ ...setupForm, circuit: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue outline-none cursor-pointer">
                                        <option value="" className="bg-racing-carbon">Selecciona...</option>
                                        {(circuits || []).map(c => (
                                            <option key={c?.id} value={c?.id} className="bg-racing-carbon">{c?.name || 'Unnamed'}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Seleccionar Vehículo</label>
                                    <select required value={setupForm.car} onChange={e => setSetupForm({ ...setupForm, car: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue outline-none cursor-pointer">
                                        <option value="" className="bg-racing-carbon">Selecciona...</option>
                                        {(cars || []).map(c => (
                                            <option key={c?.id} value={c?.model} className="bg-racing-carbon">{c?.category || 'No Cat'} - {c?.model || 'No Model'}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Etiquetas</label>
                                <div className="flex flex-wrap gap-2">
                                    {['DRY', 'WET', 'QUALY', 'RACE', 'SPRINT', 'ENDURANCE'].map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => handleTagToggle(tag)}
                                            className={`px-3 py-1.5 rounded-full text-[9px] font-bold border transition-all ${setupForm.tags.includes(tag) ? 'bg-racing-orange border-racing-orange text-white' : 'bg-white/5 border-white/10 text-zinc-500 hover:text-white'}`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Notas del Ingeniero</label>
                                <textarea 
                                    rows="3" 
                                    value={setupForm.engineerNotes} 
                                    onChange={e => setSetupForm({ ...setupForm, engineerNotes: e.target.value })}
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-xs text-white focus:border-racing-blue outline-none transition-all placeholder:text-zinc-700" 
                                    placeholder="Recomendaciones de uso..."
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Archivo(s) .svm (Soporta múltiple selección)</label>
                                <input 
                                    required 
                                    type="file" 
                                    accept=".svm" 
                                    multiple 
                                    onChange={e => setSetupForm({ ...setupForm, files: Array.from(e.target.files) })} 
                                    className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-white/5 file:text-white hover:file:bg-white/10" 
                                />
                                {setupForm.files.length > 0 && (
                                    <div className="mt-2 text-[10px] text-zinc-500 italic">
                                        {setupForm.files.length} archivos seleccionados
                                    </div>
                                )}
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-4 bg-racing-blue text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-racing-blue/90 transition-all shadow-lg shadow-racing-blue/20">
                                {loading ? 'Subiendo...' : `Subir ${setupForm.files.length} Setup(s)`}
                            </button>
                        </form>
                    )}

                    {activeTab === 'circuits' && (
                        <form onSubmit={handleAddCircuit} className="space-y-6 max-w-lg mx-auto relative z-20 pointer-events-auto">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Añadir Nuevo Trazado</h3>
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Nombre del Circuito</label>
                                <input required type="text" value={circuitForm.name} onChange={e => setCircuitForm({ ...circuitForm, name: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue focus:ring-1 focus:ring-racing-blue/50 outline-none transition-all placeholder:text-zinc-700 cursor-text" placeholder="Ej: Spa-Francorchamps" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">País</label>
                                    <input required type="text" value={circuitForm.country} onChange={e => setCircuitForm({ ...circuitForm, country: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue focus:ring-1 focus:ring-racing-blue/50 outline-none transition-all cursor-text" />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Código ISO (bh, us, es...)</label>
                                    <input required type="text" value={circuitForm.countryCode} onChange={e => setCircuitForm({ ...circuitForm, countryCode: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue focus:ring-1 focus:ring-racing-blue/50 outline-none transition-all cursor-text text-uppercase" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Trazados (separados por coma)</label>
                                <input required type="text" value={circuitForm.layouts} onChange={e => setCircuitForm({ ...circuitForm, layouts: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue focus:ring-1 focus:ring-racing-blue/50 outline-none transition-all placeholder:text-zinc-700 cursor-text" placeholder="Ej: Classic, GP, National" />
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-4 bg-racing-blue text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-racing-blue/90 transition-all shadow-lg shadow-racing-blue/20">
                                {loading ? 'Procesando...' : editingId ? 'Actualizar Circuito' : 'Añadir Circuito'}
                            </button>

                            {editingId && (
                                <button type="button" onClick={() => { setEditingId(null); setCircuitForm({ name: '', country: '', countryCode: '', layouts: '' }); }} className="w-full text-[10px] text-zinc-500 uppercase font-bold hover:text-white transition-all">Cancelar Edición</button>
                            )}

                            <div className="mt-12 pt-8 border-t border-white/5 space-y-4">
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Circuitos Existentes</h4>
                                {circuits.map(c => (
                                    <div key={c.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5 group">
                                        <span className="text-xs font-bold text-zinc-300">{c.name} ({c.country})</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingId(c.id); setCircuitForm({ name: c.name, country: c.country, countryCode: c.countryCode, layouts: c.layouts.join(', ') }); }} className="p-2 text-zinc-500 hover:text-racing-blue transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                            <button onClick={() => handleDeleteCircuit(c.id)} className="p-2 text-zinc-500 hover:text-red-500 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </form>
                    )}

                    {activeTab === 'cars' && (
                        <form onSubmit={handleAddCar} className="space-y-6 max-w-lg mx-auto relative z-20 pointer-events-auto">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">{editingId ? 'Editar Vehículo' : 'Añadir Vehículo'}</h3>
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Categoría (Hypercar, LMGT3...)</label>
                                <input required type="text" value={carForm.category} onChange={e => setCarForm({ ...carForm, category: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue focus:ring-1 focus:ring-racing-blue/50 outline-none transition-all cursor-text" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-2">Modelo del Coche</label>
                                <input required type="text" value={carForm.model} onChange={e => setCarForm({ ...carForm, model: e.target.value })} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-racing-blue focus:ring-1 focus:ring-racing-blue/50 outline-none transition-all cursor-text" />
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-4 bg-racing-blue text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-racing-blue/90 transition-all shadow-lg shadow-racing-blue/20">
                                {loading ? 'Procesando...' : editingId ? 'Actualizar Vehículo' : 'Añadir Vehículo'}
                            </button>

                            {editingId && (
                                <button type="button" onClick={() => { setEditingId(null); setCarForm({ category: '', model: '' }); }} className="w-full text-[10px] text-zinc-500 uppercase font-bold hover:text-white transition-all">Cancelar Edición</button>
                            )}

                            <div className="mt-12 pt-8 border-t border-white/5 space-y-4">
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Vehículos Existentes</h4>
                                {cars.map(c => (
                                    <div 
                                        key={c.id} 
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.add('border-racing-blue', 'bg-racing-blue/5');
                                        }}
                                        onDragLeave={(e) => {
                                            e.currentTarget.classList.remove('border-racing-blue', 'bg-racing-blue/5');
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('border-racing-blue', 'bg-racing-blue/5');
                                            const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.svm'));
                                            if (files.length > 0) {
                                                setQuickUpload({ car: c, files });
                                            }
                                        }}
                                        className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 group transition-all relative overflow-hidden"
                                    >
                                        <div className="flex-1">
                                            <span className="text-xs font-bold text-zinc-300 group-hover:text-racing-blue transition-colors">{c.model}</span>
                                            <div className="text-[8px] text-zinc-600 uppercase font-black tracking-widest mt-0.5">[{c.category}] • Soltar .svm aquí para subir</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingId(c.id); setCarForm({ category: c.category, model: c.model }); }} className="p-2 text-zinc-500 hover:text-racing-blue transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                            <button onClick={() => handleDeleteCar(c.id)} className="p-2 text-zinc-500 hover:text-red-500 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </form>
                    )}

                    {activeTab === 'leaderboard' && (() => {
                        const availableCircuits = Array.from(new Set(leaderboardRecords.map(r => r.circuit))).sort();
                        const availableCategories = Array.from(new Set(leaderboardRecords.map(r => r.category))).sort();
                        const availableVersions = Array.from(new Set(leaderboardRecords.map(r => r.gameVersion).filter(v => v && v !== 'Unknown'))).sort((a,b)=>b.localeCompare(a));
                        
                        return (
                        <div className="space-y-6 max-w-4xl mx-auto relative z-20 pointer-events-auto w-full">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Gestión de Récords</h3>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                                        {filteredLeaderboardRecords.length} Tiempos listados (Total en nube: {leaderboardRecords.length})
                                    </p>
                                </div>
                                <button 
                                    onClick={handleClearAllLeaderboard}
                                    disabled={loading || filteredLeaderboardRecords.length === 0}
                                    className="px-6 py-3 bg-red-600/20 text-red-500 border border-red-600/50 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Procesando...' : (filterCircuit !== 'ALL' || filterCategory !== 'ALL' || filterVersion !== 'ALL') ? 'Borrar Filtrados' : 'Borrar Todos (Wipe)'}
                                </button>
                            </div>

                            {/* Filtros */}
                            <div className="flex flex-wrap gap-4 mb-6 bg-black/40 p-4 rounded-xl border border-white/5">
                                <select 
                                    className="bg-black/60 border border-white/10 rounded-lg px-4 py-2 text-xs font-bold text-white uppercase outline-none"
                                    value={filterCircuit} onChange={(e) => setFilterCircuit(e.target.value)}
                                >
                                    <option value="ALL">Todos los Circuitos</option>
                                    {availableCircuits.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select 
                                    className="bg-black/60 border border-white/10 rounded-lg px-4 py-2 text-xs font-bold text-white uppercase outline-none"
                                    value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                                >
                                    <option value="ALL">Todas las Categorías</option>
                                    {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select 
                                    className="bg-black/60 border border-white/10 rounded-lg px-4 py-2 text-xs font-bold text-white uppercase outline-none"
                                    value={filterVersion} onChange={(e) => setFilterVersion(e.target.value)}
                                >
                                    <option value="ALL">Todas las Versiones</option>
                                    {availableVersions.map(v => <option key={v} value={v}>v{v}</option>)}
                                </select>
                            </div>

                            <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-black/40">
                                            <th className="px-4 py-3 text-[9px] font-black text-zinc-600 uppercase tracking-widest">Piloto</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-zinc-600 uppercase tracking-widest">Circuito / Categoría</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-zinc-600 uppercase tracking-widest">Coche</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-zinc-600 uppercase tracking-widest">Tiempo</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-zinc-600 uppercase tracking-widest text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.02]">
                                        {filteredLeaderboardRecords.map((record) => (
                                            <tr key={record.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="text-xs font-bold text-white">{record.name}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-zinc-300">{record.circuit}</span>
                                                        <span className="text-[9px] font-bold text-racing-orange">{record.category}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs text-zinc-400">{record.car}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm font-black italic text-racing-blue tabular-nums">{record.bestLap.toFixed(3)}s</span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button 
                                                        onClick={() => handleDeleteLeaderboardRecord(record)}
                                                        className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors text-[9px] font-bold uppercase"
                                                    >
                                                        Borrar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredLeaderboardRecords.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="px-4 py-8 text-center text-sm font-bold text-zinc-600 uppercase tracking-widest">
                                                    {leaderboardRecords.length === 0 ? "La base de datos está vacía." : "No hay registros con los filtros seleccionados."}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        );
                    })()}

                    {activeTab === 'team' && <TeamManagement />}

                    {/* Quick Upload Overlay */}
                    {quickUpload && (
                        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
                            <div className="w-full max-w-md liquid-glass rounded-3xl p-8 border-racing-blue/30 shadow-[0_0_50px_rgba(0,112,243,0.3)]">
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 rounded-2xl bg-racing-blue/10 flex items-center justify-center mx-auto mb-4 border border-racing-blue/20">
                                        <svg className="w-8 h-8 text-racing-blue animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    </div>
                                    <h3 className="text-xl font-black text-racing-italic mb-2 italic">CARGA RÁPIDA MDT</h3>
                                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                        Subiendo {quickUpload.files.length} setup(s) para {quickUpload.car.model}
                                    </p>
                                </div>

                                <form onSubmit={handleQuickUpload} className="space-y-6">
                                    <div>
                                        <label className="block text-[9px] uppercase font-bold text-zinc-600 mb-3 tracking-widest">¿Para qué circuito?</label>
                                        <select 
                                            required 
                                            value={quickUpload.circuit || ''} 
                                            onChange={e => setQuickUpload({ ...quickUpload, circuit: e.target.value })} 
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm text-white focus:border-racing-blue outline-none cursor-pointer"
                                        >
                                            <option value="" className="bg-racing-carbon">Selecciona circuito...</option>
                                            {(circuits || []).map(c => (
                                                <option key={c.id} value={c.id} className="bg-racing-carbon">{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex gap-3">
                                        <button 
                                            type="button" 
                                            onClick={() => setQuickUpload(null)} 
                                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={loading}
                                            className="flex-[2] py-4 bg-racing-blue text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-racing-blue/90 transition-all shadow-lg shadow-racing-blue/20"
                                        >
                                            {loading ? 'Subiendo...' : 'Iniciar Carga'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
        </div>
    );
};

export default AdminPanel;
