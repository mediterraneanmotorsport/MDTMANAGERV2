import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex-1 flex items-center justify-center bg-racing-black text-white p-10 font-sans">
                    <div className="max-w-2xl bg-red-900/20 border border-red-500/50 p-8 rounded-2xl shadow-2xl">
                        <h1 className="text-2xl font-bold text-red-500 mb-4 uppercase tracking-widest">⚠️ Error de Aplicación</h1>
                        <p className="text-zinc-400 mb-6">La aplicación ha detectado un error crítico al renderizar esta pantalla.</p>
                        <div className="bg-black/40 p-4 rounded-lg font-mono text-xs text-red-400 overflow-auto max-h-40 mb-6 border border-white/5">
                            {this.state.error && this.state.error.toString()}
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                        >
                            Reiniciar Aplicación
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
