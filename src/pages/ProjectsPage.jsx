import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Briefcase, Plus, Loader2, Search, RefreshCw, CheckCircle2, AlertTriangle, X, Calendar, User } from 'lucide-react'
import { formatTimestamp } from '@/lib/formatTime'

export default function ProjectsPage() {
    const { isAdmin, isOwner } = useAuth()
    const canCreate = isAdmin || isOwner
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [search, setSearch] = useState('')
    const [success, setSuccess] = useState('')
    const [error, setError] = useState('')

    // Form state
    const [name, setName] = useState('')
    const [client, setClient] = useState('')
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [status, setStatus] = useState('Active')

    useEffect(() => {
        fetchProjects()
    }, [])

    async function fetchProjects() {
        setLoading(true)
        const { data, error } = await supabase
            .from('projects_metadata')
            .select('*')
            .order('created_at', { ascending: false })
        if (!error) setProjects(data || [])
        setLoading(false)
    }

    async function handleCreateProject(e) {
        e.preventDefault()
        setError('')
        setSuccess('')
        setSubmitting(true)

        try {
            const { error: insertErr } = await supabase
                .from('projects_metadata')
                .insert({
                    name: name.trim(),
                    client: client.trim(),
                    start_date: startDate,
                    status,
                })

            if (insertErr) throw insertErr

            setSuccess('✅ Project created successfully!')
            setName('')
            setClient('')
            setFormOpen(false)
            fetchProjects()
        } catch (err) {
            setError(`Failed to create project: ${err.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    const filtered = projects.filter(p => 
        [p.name, p.client].some(v => v?.toLowerCase().includes(search.toLowerCase()))
    )

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <Briefcase size={22} className="text-brand-500" />
                        Project Management
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">Define and track all furnace installation projects</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all w-full sm:w-64"
                        />
                    </div>
                    {canCreate && (
                        <button
                            onClick={() => setFormOpen(!formOpen)}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/25 transition-all active:scale-95"
                        >
                            {formOpen ? <X size={16} /> : <Plus size={16} />}
                            {formOpen ? 'Cancel' : 'New Project'}
                        </button>
                    )}
                </div>
            </div>

            {/* Success/Error Toast */}
            {(success || error) && (
                <div className="space-y-3">
                    {success && (
                        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold shadow-sm animate-in zoom-in-95">
                            <CheckCircle2 size={20} />
                            {success}
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold shadow-sm animate-in zoom-in-95">
                            <AlertTriangle size={20} />
                            {error}
                        </div>
                    )}
                </div>
            )}

            {/* Create Form */}
            {formOpen && (
                <div className="bg-white rounded-3xl border border-surface-200 p-8 shadow-xl animate-in slide-in-from-top-4 duration-500">
                    <form onSubmit={handleCreateProject} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 text-left">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Project Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Reliance J3 Project"
                                className="w-full bg-surface-50 border-none rounded-2xl px-5 py-3.5 text-sm font-semibold text-surface-900 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-2 text-left">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Client Name</label>
                            <input
                                type="text"
                                value={client}
                                onChange={(e) => setClient(e.target.value)}
                                placeholder="e.g. Reliance Industries"
                                className="w-full bg-surface-50 border-none rounded-2xl px-5 py-3.5 text-sm font-semibold text-surface-900 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-2 text-left">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-surface-50 border-none rounded-2xl px-5 py-3.5 text-sm font-semibold text-surface-900 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-2 text-left">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Initial Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full bg-surface-100 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-surface-900 focus:ring-4 focus:ring-brand-500/10 transition-all cursor-pointer"
                            >
                                <option value="Active">Active</option>
                                <option value="On Hold">On Hold</option>
                                <option value="Completed">Completed</option>
                            </select>
                        </div>
                        <div className="md:col-span-2 flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-brand-600 text-white font-bold text-sm shadow-xl shadow-brand-500/20 hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                {submitting ? 'Creating...' : 'Create Project'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Projects List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-44 bg-surface-100 rounded-3xl animate-pulse" />
                    ))
                ) : filtered.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-surface-200">
                        <Briefcase size={48} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500 font-bold">No projects found</p>
                        <p className="text-sm text-surface-400">Add your first project to get started</p>
                    </div>
                ) : (
                    filtered.map((p) => (
                        <div key={p.id} className="group bg-white rounded-3xl border border-surface-200 p-6 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 rounded-2xl bg-surface-50 group-hover:bg-brand-50 transition-colors">
                                    <Briefcase size={24} className="text-surface-400 group-hover:text-brand-500 transition-colors" />
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    p.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                                    p.status === 'Completed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {p.status}
                                </span>
                            </div>
                            <h3 className="text-lg font-bold text-surface-900 group-hover:text-brand-600 transition-colors truncate mb-1">{p.name}</h3>
                            <div className="flex items-center gap-2 text-surface-500 mb-4">
                                <User size={12} />
                                <span className="text-xs font-medium truncate">{p.client || 'No Client'}</span>
                            </div>
                            <div className="pt-4 border-t border-surface-100 flex items-center justify-between text-[10px] font-bold text-surface-400 uppercase tracking-widest">
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={12} />
                                    {p.start_date || 'N/A'}
                                </div>
                                <div className="text-surface-300">
                                    {formatTimestamp(p.created_at)}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
