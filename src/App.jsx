import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import VideoIntro from './components/VideoIntro';
import UpdateNotification from './components/UpdateNotification';
import LiveTelemetry from './components/LiveTelemetry';

function App() {
  const isMobileLive = new URLSearchParams(window.location.search).get('mobile') === '1';

  if (isMobileLive) {
    return (
      <div className="w-screen h-screen bg-black overflow-hidden flex flex-col">
        <LiveTelemetry />
      </div>
    );
  }

  const [showIntro, setShowIntro] = useState(true);
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


  // Keyboard Shortcuts (F11 for Fullscreen)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F11') {
        e.preventDefault();
        if (window.electronAPI) window.electronAPI.toggleFullScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── LOADING SCREEN (WEC 2030 Holographic) ──
  if (loading || authLoading) {
    return (
      <div className="h-screen w-full bg-wec-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 wec-grid-pattern opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-wec-blue/5 blur-[150px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-wec-cyan/5 blur-[100px] rounded-full animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center">
          <img src="logo.png" alt="MDT" className="w-28 h-auto mb-10 drop-shadow-[0_0_40px_rgba(0,144,255,0.4)]" style={{ animation: 'pulseBlue 3s ease-in-out infinite' }} />
          
          {/* WEC-style loading bar */}
          <div className="w-72 h-[2px] bg-white/5 rounded-full overflow-hidden mb-6 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-wec-cyan to-transparent animate-pulse" style={{ animation: 'wecShimmer 2s linear infinite' }} />
          </div>
          
          <div className="text-wec-display text-[9px] text-wec-cyan/60 font-bold uppercase tracking-[0.5em]">
            Establishing Telemetry Uplink
          </div>
          <div className="text-wec-display text-[7px] text-white/20 font-medium uppercase tracking-[0.3em] mt-2">
            MDT MOTORSPORT TERMINAL v4.0
          </div>
        </div>

        {/* Corner brackets */}
        <div className="absolute top-8 left-8 w-8 h-8 border-l border-t border-wec-cyan/20" />
        <div className="absolute top-8 right-8 w-8 h-8 border-r border-t border-wec-cyan/20" />
        <div className="absolute bottom-8 left-8 w-8 h-8 border-l border-b border-wec-cyan/20" />
        <div className="absolute bottom-8 right-8 w-8 h-8 border-r border-b border-wec-cyan/20" />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-wec-black text-wec-white overflow-hidden flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
      {showIntro ? (
        <VideoIntro onFinish={() => setShowIntro(false)} />
      ) : !user ? (
        <Login error={accessError} />
      ) : (
        <>
          {/* ── WEC TOP BAR (Title Bar) ── */}
          <div className="h-9 w-full bg-wec-void/90 draggable border-b border-wec-border flex items-center px-4 select-none shrink-0 z-[1000] relative overflow-hidden">
            {/* Subtle animated gradient stripe */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-wec-blue/30 to-transparent" />
            
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-4 bg-wec-blue" />
              <span className="text-wec-display text-[9px] font-bold tracking-[0.3em] text-white/50">
                MDT<span className="text-wec-cyan ml-1">WEC</span>
              </span>
              <span className="text-wec-display text-[7px] text-white/20 font-medium tracking-wider">TERMINAL v4.0</span>
            </div>

            <div className="ml-auto no-drag flex items-center gap-3">
              {/* Live Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1 rounded bg-wec-green/5 border border-wec-green/10">
                <div className="w-1.5 h-1.5 rounded-full bg-wec-green wec-live-dot" />
                <span className="text-wec-display text-[7px] font-bold text-wec-green/80 uppercase tracking-wider">Live</span>
              </div>

              <button 
                onClick={() => window.electronAPI?.toggleFullScreen()}
                className="p-1.5 hover:bg-white/5 rounded transition-all group"
                title="Toggle Fullscreen"
              >
                <svg className="w-3 h-3 text-white/30 group-hover:text-wec-cyan transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                   <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>

              <div className="h-4 w-px bg-white/5" />

              <span className="text-wec-display text-[7px] px-2 py-0.5 rounded border border-wec-gold/30 text-wec-gold font-bold uppercase tracking-wider">
                {role}
              </span>
            </div>
          </div>

          {/* ── MAIN CONTENT ── */}
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

          {/* ── AUTO-UPDATE OVERLAY ── */}
          <UpdateNotification />
        </>
      )}
    </div>
  );
}

export default App;
