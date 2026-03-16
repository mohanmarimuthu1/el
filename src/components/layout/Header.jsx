import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Menu, X, LogOut, Shield, ChevronDown, Search, LayoutGrid } from 'lucide-react'

export default function Header({ sidebarOpen, setSidebarOpen, selectedProjectId, setSelectedProjectId }) {
    const { user, role, canViewFinancials, signOut, setDemoRole, availableRoles } = useAuth()
    const [roleDropdown, setRoleDropdown] = useState(false)
    const [projects, setProjects] = useState([])
    const [loadingProjects, setLoadingProjects] = useState(false)
    const navigate = useNavigate()

    const roleBadgeColor = {
        owner: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
        manager: 'bg-blue-100 text-blue-700 ring-blue-300',
        supervisor: 'bg-amber-100 text-amber-700 ring-amber-300',
        admin: 'bg-rose-100 text-rose-700 ring-rose-300',
    }

    useEffect(() => {
        fetchProjects()
    }, [])

    async function fetchProjects() {
        setLoadingProjects(true)
        const { data, error } = await supabase
            .from('projects_metadata')
            .select('id, name')
            .eq('status', 'Active')
            .order('name')
        if (!error) setProjects(data || [])
        setLoadingProjects(false)
    }

    async function handleSignOut() {
        await signOut()
        navigate('/login', { replace: true })
    }

    const selectedProjectName = projects.find(p => p.id === selectedProjectId)?.name || 'All Projects'

    return (
        <header className="sticky top-0 z-40 flex h-20 items-center gap-4 border-b border-white/20 bg-white/70 backdrop-blur-2xl px-6 md:px-10 shadow-sm transition-all duration-300">
            {/* Mobile menu toggle */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden rounded-2xl p-2.5 text-surface-600 hover:bg-surface-100/50 hover:text-brand-600 transition-all active:scale-95"
                aria-label="Toggle sidebar"
            >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Branding */}
            <div className="flex items-center gap-4 min-w-0 group cursor-pointer" onClick={() => navigate('/')}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-xl shadow-brand-500/10 overflow-hidden bg-white ring-4 ring-white transition-transform duration-500 group-hover:rotate-[10deg]">
                    <img src="/elman-logo.jpeg" alt="Elman" className="w-full h-full object-contain" />
                </div>
                <div className="hidden lg:block min-w-0">
                    <h1 className="text-xl tracking-tighter leading-none" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                        <span className="font-extrabold text-[#1a2250]">el</span>
                        <span className="font-extrabold text-[#b91c1c]">man</span>
                    </h1>
                </div>
            </div>

            {/* Global Project Search */}
            <div className="hidden md:flex flex-1 items-center max-w-md ml-4">
                <div className="relative w-full group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-brand-500 transition-colors pointer-events-none">
                        <LayoutGrid size={18} />
                    </div>
                    <select
                        value={selectedProjectId || ''}
                        onChange={(e) => setSelectedProjectId(e.target.value || null)}
                        className="w-full bg-surface-100 border-none rounded-2xl pl-12 pr-10 py-2.5 text-sm font-bold text-surface-900 appearance-none focus:ring-4 focus:ring-brand-500/10 transition-all cursor-pointer"
                    >
                        <option value="">Global Search: All Projects</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none">
                        <ChevronDown size={14} />
                    </div>
                </div>
            </div>

            {/* Mobile Project Selector (Icon only) */}
            <div className="md:hidden flex items-center ml-auto">
                 <select
                    value={selectedProjectId || ''}
                    onChange={(e) => setSelectedProjectId(e.target.value || null)}
                    className="bg-transparent border-none text-[10px] font-black uppercase tracking-tighter text-brand-600 focus:ring-0"
                >
                    <option value="">All Projects</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name.substring(0, 10)}</option>
                    ))}
                </select>
            </div>

            {/* Desktop Actions */}
            <div className="flex items-center gap-3 md:gap-6 ml-auto">
                {/* Role badge */}
                <div className="relative">
                    {user ? (
                        <div
                            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-wide uppercase ring-1 ring-inset shadow-sm ${roleBadgeColor[role] || 'bg-surface-100 text-surface-700 ring-surface-300'}`}
                        >
                            <Shield size={12} className="opacity-70" />
                            {role}
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setRoleDropdown(!roleDropdown)}
                                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-wide uppercase ring-1 ring-inset transition-all hover:shadow-lg active:scale-95 cursor-pointer ${roleBadgeColor[role] || 'bg-surface-100 text-surface-700 ring-surface-300'}`}
                            >
                                <Shield size={12} className="opacity-70" />
                                {role}
                                <ChevronDown size={12} className={`transition-transform duration-300 ${roleDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {roleDropdown && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setRoleDropdown(false)} />
                                    <div className="absolute right-0 mt-3 w-52 rounded-2xl bg-white/90 backdrop-blur-xl border border-surface-200 shadow-2xl shadow-surface-900/10 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="px-4 py-3 border-b border-surface-100 bg-surface-50/50">
                                            <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Switch Role (Demo)</p>
                                        </div>
                                        <div className="p-1.5">
                                            {availableRoles.map((r) => (
                                                <button
                                                    key={r}
                                                    onClick={() => { setDemoRole(r); setRoleDropdown(false) }}
                                                    className={`w-full text-left px-3 py-2.5 text-xs font-semibold capitalize rounded-xl transition-all hover:bg-white flex items-center gap-3 ${r === role ? 'text-brand-600 bg-white shadow-sm ring-1 ring-surface-200/50' : 'text-surface-600 hover:text-surface-900'
                                                        }`}
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full transition-all ${r === role ? 'bg-brand-500 scale-125 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-surface-300'}`} />
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* User Profile & Logout */}
                <div className="flex items-center gap-3 pl-3 md:pl-6 border-l border-surface-200/50">
                    <div className="hidden md:block text-right">
                        <div className="text-xs font-bold text-surface-900 truncate max-w-[140px]">
                            {user?.email?.split('@')[0] || 'Demo User'}
                        </div>
                    </div>
                    <div className="group relative">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white text-sm font-bold shadow-lg shadow-brand-500/20 transition-transform group-hover:scale-110 active:scale-95 cursor-pointer">
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        {user && (
                            <button
                                onClick={handleSignOut}
                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white border border-surface-200 flex items-center justify-center text-surface-400 hover:text-red-500 hover:scale-110 transition-all shadow-sm"
                                title="Sign out"
                            >
                                <LogOut size={10} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}
