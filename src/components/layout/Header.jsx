import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Menu, X, LogOut, Shield, ChevronDown } from 'lucide-react'

export default function Header({ sidebarOpen, setSidebarOpen }) {
    const { user, role, canViewFinancials, signOut, setDemoRole, availableRoles } = useAuth()
    const [roleDropdown, setRoleDropdown] = useState(false)
    const navigate = useNavigate()

    const roleBadgeColor = {
        owner: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
        manager: 'bg-blue-100 text-blue-700 ring-blue-300',
        supervisor: 'bg-amber-100 text-amber-700 ring-amber-300',
        admin: 'bg-rose-100 text-rose-700 ring-rose-300',
    }

    async function handleSignOut() {
        await signOut()
        navigate('/login', { replace: true })
    }

    return (
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-surface-200 bg-white/80 backdrop-blur-xl px-4 md:px-8 shadow-sm">
            {/* Mobile menu toggle */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden rounded-lg p-2 text-surface-700 hover:bg-surface-100 transition-colors"
                aria-label="Toggle sidebar"
            >
                {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Branding */}
            <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full shadow-md overflow-hidden bg-white">
                    <img src="/elman-logo.jpeg" alt="Elman" className="w-full h-full object-contain" />
                </div>
                <div className="hidden sm:block min-w-0">
                    <h1 className="text-base tracking-tight truncate" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                        <span style={{ color: '#1a2250', fontWeight: 700 }}>el</span>
                        <span style={{ color: '#b91c1c', fontWeight: 700 }}>man</span>
                        <span className="text-surface-300 mx-0.5">-</span>
                        <span style={{ color: '#1a2250', fontWeight: 600, fontSize: '0.8em', letterSpacing: '0.04em' }}>FURNACE PRIVATE LIMITED</span>
                    </h1>
                    <p className="text-[11px] text-surface-700/60 font-medium -mt-0.5 tracking-wide uppercase">
                        Enterprise Resource Planner
                    </p>
                </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Role badge (always shown) */}
            <div className="relative">
                {user ? (
                    /* Authenticated: show role badge only (no switcher) */
                    <div
                        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${roleBadgeColor[role] || 'bg-surface-100 text-surface-700 ring-surface-300'}`}
                    >
                        <Shield size={13} />
                        <span className="capitalize">{role}</span>
                    </div>
                ) : (
                    /* Demo mode: show role switcher */
                    <>
                        <button
                            onClick={() => setRoleDropdown(!roleDropdown)}
                            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-all hover:shadow-md cursor-pointer ${roleBadgeColor[role] || 'bg-surface-100 text-surface-700 ring-surface-300'}`}
                        >
                            <Shield size={13} />
                            <span className="capitalize">{role}</span>
                            <ChevronDown size={12} className={`transition-transform ${roleDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {roleDropdown && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setRoleDropdown(false)} />
                                <div className="absolute right-0 mt-2 w-44 rounded-xl bg-white border border-surface-200 shadow-xl shadow-surface-900/10 z-50 overflow-hidden">
                                    <div className="px-3 py-2 border-b border-surface-100">
                                        <p className="text-[10px] font-semibold text-surface-700/50 uppercase tracking-wider">Switch Role (Demo)</p>
                                    </div>
                                    {availableRoles.map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => { setDemoRole(r); setRoleDropdown(false) }}
                                            className={`w-full text-left px-3 py-2.5 text-sm font-medium capitalize transition-colors hover:bg-surface-50 flex items-center gap-2 ${r === role ? 'text-brand-600 bg-brand-50' : 'text-surface-700'
                                                }`}
                                        >
                                            <div className={`w-2 h-2 rounded-full ${r === role ? 'bg-brand-500' : 'bg-surface-300'}`} />
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* User info + Sign out */}
            <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-surface-200">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-xs font-bold shadow-sm">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="text-xs">
                    <div className="font-semibold text-surface-800 truncate max-w-[140px]">
                        {user?.email || 'Demo User'}
                    </div>
                    <div className="text-surface-700/50 font-medium">
                        {canViewFinancials ? 'Full Access' : 'Limited Access'}
                    </div>
                </div>
                {user && (
                    <button
                        onClick={handleSignOut}
                        className="ml-1 p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Sign out"
                    >
                        <LogOut size={16} />
                    </button>
                )}
            </div>
        </header>
    )
}
