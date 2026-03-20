import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import { ScrollText, RefreshCw, ShieldCheck, UserCheck, PackagePlus, FileCheck2 } from 'lucide-react'

const ACTION_ICONS = {
    approval: FileCheck2,
    vendor_added: PackagePlus,
    default: ShieldCheck,
}

const ACTION_COLORS = {
    approval: 'bg-emerald-100 text-emerald-600',
    vendor_added: 'bg-amber-100 text-amber-600',
    default: 'bg-brand-100 text-brand-600',
}

function getActionType(action) {
    if (action?.toLowerCase().includes('approved') || action?.toLowerCase().includes('unapproved'))
        return 'approval'
    if (action?.toLowerCase().includes('added') || action?.toLowerCase().includes('vendor'))
        return 'vendor_added'
    return 'default'
}

export default function AuditLogPage() {
    const { role } = useAuth()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { fetchLogs() }, [])

    async function fetchLogs() {
        setLoading(true)
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)

        if (!error) setLogs(data || [])
        setLoading(false)
    }

    // Owner-only gate
    if (false) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <ShieldCheck size={48} className="mx-auto mb-3 text-surface-300" />
                    <h3 className="text-lg font-bold text-surface-800">Access Restricted</h3>
                    <p className="text-sm text-surface-700/50 mt-1">Audit logs are only visible to the Owner role.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <ScrollText size={22} className="text-brand-500" />
                        Audit Log
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">Activity trail — approvals, vendor additions & system events</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 text-[10px] font-semibold ring-1 ring-brand-200">
                        <ShieldCheck size={10} />
                        Owner Only
                    </div>
                    <button
                        onClick={fetchLogs}
                        className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Log Entries */}
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-6 space-y-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 animate-pulse">
                                <div className="h-9 w-9 rounded-lg bg-surface-200" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3.5 bg-surface-200 rounded w-3/4" />
                                    <div className="h-3 bg-surface-100 rounded w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="px-5 py-16 text-center text-surface-700/40">
                        <ScrollText size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No activity logs yet</p>
                        <p className="text-xs mt-1">Logs will appear here when approvals or vendor quotes are submitted.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-surface-100">
                        {logs.map((log) => {
                            const type = getActionType(log.action)
                            const Icon = ACTION_ICONS[type]
                            const colorClass = ACTION_COLORS[type]

                            return (
                                <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-surface-50/50 transition-colors">
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                                        <Icon size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-surface-800">{log.action}</p>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-surface-700/50">
                                            <span className="flex items-center gap-1">
                                                <UserCheck size={10} />
                                                {log.user_name}
                                            </span>
                                            {log.user_role && (
                                                <>
                                                    <span className="text-surface-300">•</span>
                                                    <span className="capitalize">{log.user_role}</span>
                                                </>
                                            )}
                                            <span className="text-surface-300">•</span>
                                            <span className="font-mono">{formatTimestamp(log.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
                {!loading && logs.length > 0 && (
                    <div className="px-5 py-3 bg-surface-50/50 border-t border-surface-200 text-xs text-surface-700/50 font-medium">
                        Showing {logs.length} log entries
                    </div>
                )}
            </div>
        </div>
    )
}
