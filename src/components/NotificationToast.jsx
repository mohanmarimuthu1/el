import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Bell, X, FileText } from 'lucide-react'

export default function NotificationToast() {
    const { role } = useAuth()
    const [toasts, setToasts] = useState([])
    const toastIdRef = useRef(0)

    // Only subscribe for Owner/Manager
    const shouldSubscribe = role === 'owner' || role === 'manager'

    useEffect(() => {
        if (!shouldSubscribe) return

        const channel = supabase
            .channel('intent-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'purchase_intents',
                },
                (payload) => {
                    const row = payload.new
                    const id = ++toastIdRef.current

                    // Play ping sound
                    playPingSound()

                    // Add toast
                    setToasts((prev) => [
                        ...prev,
                        {
                            id,
                            modelCode: row.model_code || 'Unknown',
                            description: row.description || '',
                            qty: row.quantity_required,
                            unit: row.unit,
                            timestamp: new Date().toLocaleTimeString(),
                        },
                    ])

                    // Auto-dismiss after 6 seconds
                    setTimeout(() => {
                        setToasts((prev) => prev.filter((t) => t.id !== id))
                    }, 6000)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [shouldSubscribe])

    function dismissToast(id) {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }

    if (toasts.length === 0) return null

    return (
        <div className="fixed top-20 right-4 z-[100] flex flex-col gap-3 w-80 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="pointer-events-auto bg-white rounded-2xl border border-surface-200 shadow-2xl shadow-surface-900/15 overflow-hidden"
                    style={{ animation: 'toastSlideIn 0.4s ease-out' }}
                >
                    <div className="flex items-start gap-3 p-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/25">
                            <Bell size={16} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-0.5">
                                New Material Intent
                            </p>
                            <p className="text-sm font-bold text-surface-900 truncate">
                                {toast.modelCode}
                            </p>
                            <p className="text-xs text-surface-700/60 truncate mt-0.5">
                                {toast.description}
                            </p>
                            {toast.qty && (
                                <p className="text-xs text-surface-700/50 mt-1 font-mono">
                                    Qty: {toast.qty} {toast.unit || ''}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => dismissToast(toast.id)}
                            className="shrink-0 p-1 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    {/* Progress bar for auto-dismiss */}
                    <div className="h-1 bg-surface-100">
                        <div
                            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full"
                            style={{ animation: 'toastProgress 6s linear forwards' }}
                        />
                    </div>
                </div>
            ))}

            <style>{`
                @keyframes toastSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes toastProgress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </div>
    )
}

// Professional subtle ping sound using Web Audio API
function playPingSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

        // Create a pleasant two-tone ping
        const osc1 = audioCtx.createOscillator()
        const osc2 = audioCtx.createOscillator()
        const gain = audioCtx.createGain()

        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(880, audioCtx.currentTime) // A5
        osc1.frequency.setValueAtTime(1318, audioCtx.currentTime + 0.08) // E6

        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(1100, audioCtx.currentTime)
        osc2.frequency.setValueAtTime(1650, audioCtx.currentTime + 0.08)

        gain.gain.setValueAtTime(0.08, audioCtx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4)

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(audioCtx.destination)

        osc1.start(audioCtx.currentTime)
        osc2.start(audioCtx.currentTime)
        osc1.stop(audioCtx.currentTime + 0.4)
        osc2.stop(audioCtx.currentTime + 0.4)

        // Clean up
        setTimeout(() => audioCtx.close(), 500)
    } catch {
        // Silently fail if audio is blocked
    }
}
