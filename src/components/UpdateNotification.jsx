import React, { useState, useEffect } from 'react';

/**
 * MDT WEC 2030 — Auto-Update Notification Overlay
 * 
 * Listens for update-status events from the Electron main process
 * and displays a sleek notification with download/install controls.
 */
export default function UpdateNotification() {
  const [updateState, setUpdateState] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    if (!window.electronAPI) return;

    // Get current app version
    window.electronAPI.getAppVersion?.().then(v => setAppVersion(v || ''));

    // Listen for update status events
    window.electronAPI.onUpdateStatus?.((data) => {
      console.log('[UpdateUI] Status:', data.status, data);
      setUpdateState(data);
      setDismissed(false); // Re-show on new events
    });
  }, []);

  // Nothing to show
  if (!updateState || dismissed) return null;

  // Don't show checking or up-to-date states
  if (updateState.status === 'checking' || updateState.status === 'up-to-date') return null;

  const handleDownload = () => {
    window.electronAPI?.downloadUpdate();
  };

  const handleInstall = () => {
    window.electronAPI?.installUpdate();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] wec-enter" style={{ maxWidth: '380px' }}>
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(12, 12, 20, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)',
          backdropFilter: 'blur(24px) saturate(1.8)',
          border: '1px solid rgba(0, 212, 255, 0.15)',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 144, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: updateState.status === 'error'
              ? 'linear-gradient(90deg, transparent, #ff2d55, transparent)'
              : updateState.status === 'ready'
              ? 'linear-gradient(90deg, transparent, #34d399, transparent)'
              : 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
          }}
        />

        {/* Shimmer overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(110deg, transparent 20%, rgba(0, 144, 255, 0.02) 40%, rgba(0, 212, 255, 0.04) 50%, rgba(0, 144, 255, 0.02) 60%, transparent 80%)',
            backgroundSize: '200% 100%',
            animation: 'wecShimmer 4s ease-in-out infinite',
          }}
        />

        <div className="relative p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              {/* Update icon */}
              <div
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{
                  background: updateState.status === 'error'
                    ? 'rgba(255, 45, 85, 0.1)'
                    : updateState.status === 'ready'
                    ? 'rgba(52, 211, 153, 0.1)'
                    : 'rgba(0, 212, 255, 0.1)',
                  border: `1px solid ${
                    updateState.status === 'error'
                      ? 'rgba(255, 45, 85, 0.2)'
                      : updateState.status === 'ready'
                      ? 'rgba(52, 211, 153, 0.2)'
                      : 'rgba(0, 212, 255, 0.2)'
                  }`,
                }}
              >
                {updateState.status === 'error' ? (
                  <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                ) : updateState.status === 'ready' ? (
                  <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    style={{ color: '#00d4ff', animation: updateState.status === 'downloading' ? 'spin 2s linear infinite' : 'none' }}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
                  </svg>
                )}
              </div>
              <div>
                <div className="text-wec-display text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">
                  {updateState.status === 'available' && 'ACTUALIZACIÓN DISPONIBLE'}
                  {updateState.status === 'downloading' && 'DESCARGANDO UPDATE'}
                  {updateState.status === 'ready' && 'LISTO PARA INSTALAR'}
                  {updateState.status === 'error' && 'ERROR DE ACTUALIZACIÓN'}
                </div>
                {updateState.version && (
                  <div className="text-wec-display text-[11px] font-bold tracking-wider mt-0.5" style={{
                    color: updateState.status === 'ready' ? '#34d399' : '#00d4ff'
                  }}>
                    v{updateState.version}
                  </div>
                )}
              </div>
            </div>

            {/* Dismiss button (not during download) */}
            {updateState.status !== 'downloading' && (
              <button
                onClick={handleDismiss}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors group"
              >
                <svg className="w-3 h-3 text-white/20 group-hover:text-white/50 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* ── STATUS: UPDATE AVAILABLE ── */}
          {updateState.status === 'available' && (
            <div>
              <p className="text-[12px] text-white/50 mb-3 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                Una nueva versión de <span className="text-wec-cyan font-semibold">MDT Manager</span> está disponible.
                {appVersion && <span className="text-white/30"> (actual: v{appVersion})</span>}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2 px-3 rounded text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300"
                  style={{
                    fontFamily: 'var(--font-display)',
                    background: 'linear-gradient(135deg, rgba(0, 144, 255, 0.15), rgba(0, 212, 255, 0.1))',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    color: '#00d4ff',
                    boxShadow: '0 0 15px rgba(0, 144, 255, 0.1)',
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'linear-gradient(135deg, rgba(0, 144, 255, 0.25), rgba(0, 212, 255, 0.2))';
                    e.target.style.boxShadow = '0 0 25px rgba(0, 144, 255, 0.2)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'linear-gradient(135deg, rgba(0, 144, 255, 0.15), rgba(0, 212, 255, 0.1))';
                    e.target.style.boxShadow = '0 0 15px rgba(0, 144, 255, 0.1)';
                  }}
                >
                  ⬇ Descargar
                </button>
                <button
                  onClick={handleDismiss}
                  className="py-2 px-3 rounded text-[10px] font-bold tracking-[0.15em] uppercase text-white/30 hover:text-white/50 transition-colors border border-white/5 hover:border-white/10"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Después
                </button>
              </div>
            </div>
          )}

          {/* ── STATUS: DOWNLOADING ── */}
          {updateState.status === 'downloading' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-wec-data text-[11px] text-wec-cyan font-bold tabular-nums">
                  {(updateState.percent || 0).toFixed(1)}%
                </span>
                <span className="text-wec-data text-[9px] text-white/30 tabular-nums">
                  {formatBytes(updateState.transferred)} / {formatBytes(updateState.total)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${updateState.percent || 0}%`,
                    background: 'linear-gradient(90deg, #0090ff, #00d4ff)',
                    boxShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
                  }}
                />
              </div>
              <div className="mt-2 text-wec-data text-[9px] text-white/20 tabular-nums">
                {formatBytes(updateState.bytesPerSecond)}/s
              </div>
            </div>
          )}

          {/* ── STATUS: READY TO INSTALL ── */}
          {updateState.status === 'ready' && (
            <div>
              <p className="text-[12px] text-white/50 mb-3 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                La actualización se ha descargado. Reinicia la app para aplicar los cambios.
              </p>
              <button
                onClick={handleInstall}
                className="w-full py-2.5 px-3 rounded text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300"
                style={{
                  fontFamily: 'var(--font-display)',
                  background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(16, 185, 129, 0.1))',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  color: '#34d399',
                  boxShadow: '0 0 15px rgba(52, 211, 153, 0.1)',
                }}
                onMouseEnter={e => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(52, 211, 153, 0.25), rgba(16, 185, 129, 0.2))';
                  e.target.style.boxShadow = '0 0 25px rgba(52, 211, 153, 0.2)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(16, 185, 129, 0.1))';
                  e.target.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.1)';
                }}
              >
                ⟳ Reiniciar e Instalar
              </button>
            </div>
          )}

          {/* ── STATUS: ERROR ── */}
          {updateState.status === 'error' && (
            <div>
              <p className="text-[11px] text-red-400/70 mb-2 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                {updateState.error || 'No se pudo verificar la actualización.'}
              </p>
              <button
                onClick={() => window.electronAPI?.checkForUpdates()}
                className="py-1.5 px-3 rounded text-[9px] font-bold tracking-[0.15em] uppercase text-white/30 hover:text-white/50 transition-colors border border-white/5 hover:border-white/10"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Corner brackets for WEC aesthetic */}
        <div className="absolute top-1.5 left-1.5 w-2 h-2 border-l border-t border-wec-cyan/20 pointer-events-none" />
        <div className="absolute top-1.5 right-1.5 w-2 h-2 border-r border-t border-wec-cyan/20 pointer-events-none" />
        <div className="absolute bottom-1.5 left-1.5 w-2 h-2 border-l border-b border-wec-cyan/20 pointer-events-none" />
        <div className="absolute bottom-1.5 right-1.5 w-2 h-2 border-r border-b border-wec-cyan/20 pointer-events-none" />
      </div>
    </div>
  );
}
