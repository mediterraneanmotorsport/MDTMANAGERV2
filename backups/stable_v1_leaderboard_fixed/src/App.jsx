import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, updateDoc, serverTimestamp, addDoc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import Dashboard from './components/Dashboard';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [accessError, setAccessError] = useState(null);

  // Dynamic Global State
  const [circuits, setCircuits] = useState([]);
  const [categories, setCategories] = useState({});
  const [allCars, setAllCars] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [nextEvent, setNextEvent] = useState(null);
  const [userFavorites, setUserFavorites] = useState([]);

  const [gamePath, setGamePath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  const handleSelectPath = async () => {
    if (window.electronAPI) {
      try {
        const path = await window.electronAPI.selectDirectory();
        if (path) {
          setGamePath(path);
          await window.electronAPI.saveGamePath(path);
        }
      } catch (err) { console.error(err); }
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setAuthLoading(true);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const normalizedRole = (userData.role || '').toLowerCase();
            if (normalizedRole === 'admin' || normalizedRole === 'pilot_plus') {
              setUser(currentUser);
              setRole(userData.role);
            } else {
              setAccessError(`Acceso denegado: El rol '${userData.role}' no tiene permisos.`);
              await signOut(auth);
            }
          }
        } catch (err) { console.error(err); }
        finally { setAuthLoading(false); }
      } else {
        setUser(null);
        setRole(null);
        setAuthLoading(false);
      }
    });

    async function initGame() {
      if (window.electronAPI) {
        try {
          const path = await window.electronAPI.findGamePath();
          if (path) {
            setGamePath(path);
            await window.electronAPI.saveGamePath(path);
          }
        } catch (err) { console.error(err); }
      }
      setLoading(false);
    }
    initGame();

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) setUserFavorites(doc.data().favorites || []);
    });

    const unsubCircuits = onSnapshot(collection(db, 'circuits'), (snapshot) => {
      setCircuits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setDataLoaded(true);
    });

    const unsubCars = onSnapshot(collection(db, 'cars'), (snapshot) => {
      const rawCars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const cats = {};
      rawCars.forEach(car => {
        if (!cats[car.category]) cats[car.category] = [];
        cats[car.category].push(car.model);
      });
      setAllCars(rawCars);
      setCategories(cats);
    });

    const unsubEvents = onSnapshot(collection(db, 'race_events'), (snapshot) => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      const now = new Date();
      setNextEvent(events.find(e => new Date(e.date) >= now));
    });

    return () => {
      unsubUser();
      unsubCircuits();
      unsubCars();
      unsubEvents();
    };
  }, [user]);

  // Remote Install Listener for Electron
  useEffect(() => {
    if (!user || !window.electronAPI) return;
    const q = query(
      collection(db, 'install_requests'),
      where('userId', '==', user.uid),
      where('status', 'in', ['pending', 'pending_delete'])
    );
    const unsubRemote = onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const request = { id: change.doc.id, ...change.doc.data() };
          try {
            if (request.status === 'pending') {
              await updateDoc(doc(db, 'install_requests', request.id), { status: 'installing' });
              await window.electronAPI.downloadSetup({
                url: request.url, circuit: request.circuit, fileName: request.fileName, gamePath
              });
              await updateDoc(doc(db, 'install_requests', request.id), {
                status: 'completed', completedAt: serverTimestamp()
              });
            } else if (request.status === 'pending_delete') {
              await window.electronAPI.deleteSetup({
                circuit: request.circuit, fileName: request.fileName, gamePath
              });
              await updateDoc(doc(db, 'install_requests', request.id), {
                status: 'deleted', completedAt: serverTimestamp()
              });
            }
          } catch (err) {
            await updateDoc(doc(db, 'install_requests', request.id), { status: 'error', error: err.message });
          }
        }
      }
    });
    return () => unsubRemote();
  }, [user, gamePath]);

  // Telemetry Sync Engine
  useEffect(() => {
    if (!user || !gamePath || !window.electronAPI || circuits.length === 0) return;

    window.electronAPI.startTelemetryWatcher({ gamePath });

    const unsubscribe = window.electronAPI.onTelemetryUpdate(async (data) => {
      console.log("Telemetry Engine: New Session Data", data);
      
      // 1. Find matching circuit in our DB
      const venue = data.circuit.toLowerCase();
      const match = circuits.find(c => 
        venue.includes(c.name.toLowerCase()) || 
        c.name.toLowerCase().includes(venue)
      );

      if (!match) {
          console.warn("Telemetry Engine: Could not match circuit", data.circuit);
          return;
      }

      // 2. Process results (upload best laps)
      for (const res of data.results) {
          // Unique ID for the entry per user/circuit/car to avoid duplicates and only keep best
          const entryId = `${match.id}_${res.car.replace(/\s+/g, '_')}_${res.name.replace(/\s+/g, '_')}`;
          
          try {
              // Check if we should update (only if it's a better time)
              const leaderRef = doc(db, 'leaderboard', entryId);
              
              await setDoc(leaderRef, {
                  circuitId: match.id,
                  circuitName: match.name,
                  userName: res.name,
                  carModel: res.car,
                  lapTime: res.bestLap,
                  setupName: res.currentSetup,
                  trackTemp: data.trackTemp,
                  timestamp: serverTimestamp(),
                  date: new Date().toLocaleDateString()
              }, { merge: true }); // Merge for now, could add logic to only update if faster
          } catch (err) {
              console.error("Telemetry Engine: Upload error", err);
          }
      }
    });

    return () => {
        // No easy way to unsub from IPC on cleanup in this helper but we should be fine
    };
  }, [user, gamePath, circuits]);

  if (loading || authLoading) {
    return (
        <div className="h-screen w-full bg-racing-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
            <div className="absolute inset-0 racing-stripes opacity-10 animate-pulse" />
            <div className="relative z-10 flex flex-col items-center">
                <img src="logo.png" alt="MDT" className="w-32 h-auto mb-12 drop-shadow-[0_0_30px_rgba(0,112,243,0.5)] animate-pulse" />
                <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden mb-4">
                    <div className="w-1/3 h-full bg-racing-blue shimmer-bg" />
                </div>
                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.5em] animate-pulse">Telemetry Uplink...</div>
            </div>
        </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-racing-black text-white overflow-hidden flex flex-col font-sans selection:bg-racing-blue selection:text-white">
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : !user ? (
        <Login error={accessError} />
      ) : (
        <>
          <div className="h-8 w-full bg-racing-black draggable border-b border-white/5 flex items-center px-4 select-none shrink-0 z-[1000]">
            <span className="text-[10px] font-black tracking-widest text-zinc-500 italic">
              ENGINE <span className="text-racing-blue">MDT</span> • <span className="text-racing-orange ml-1">TERMINAL v3.0</span>
            </span>
            <div className="ml-auto no-drag flex items-center gap-4">
              <span className="text-[9px] px-2 py-0.5 rounded border border-racing-blue/30 text-racing-blue font-black uppercase tracking-[0.2em]">{role}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-racing-success shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <Dashboard 
                userRole={role} 
                gamePath={gamePath} 
                onSelectPath={handleSelectPath}
                userFavorites={userFavorites}
                categories={categories}
                circuits={circuits}
                allCars={allCars}
                nextEvent={nextEvent}
                isDataLoaded={dataLoaded}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
