import { NavLink } from 'react-router-dom'
import { LayoutDashboard, HardDrive, FileText, Users, X, ScrollText, Truck, ShieldCheck, LayoutGrid } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/inventory', label: 'Inventory', sublabel: 'Hardware Tracking', icon: HardDrive },
    { to: '/purchase-intents', label: 'Purchase Intents', sublabel: 'Ledger', icon: FileText },
    { to: '/vendors', label: 'Vendor Management', icon: Users, financialOnly: true },
    { to: '/dispatch', label: 'Dispatch', sublabel: 'Outbound Tracking', icon: Truck },
    { to: '/projects', label: 'Project Usage', sublabel: 'Material Allocation', icon: LayoutGrid },
    { to: '/audit-log', label: 'Audit Log', sublabel: 'Activity Trail', icon: ScrollText, ownerOnly: true },
    { to: '/user-management', label: 'User Management', sublabel: 'Admin Panel', icon: ShieldCheck, adminOrOwner: true },
]

export default function Sidebar({ open, setOpen }) {
    const { role, canViewFinancials, isAdmin, isOwner } = useAuth()
    const filteredNav = navItems.filter(item => {
        if (item.adminOnly && !isAdmin) return false
        if (item.adminOrOwner && !isAdmin && !isOwner) return false
        if (item.ownerOnly && role !== 'owner' && !isAdmin) return false
        if (item.financialOnly && !canViewFinancials) return false
        return true
    })

    return (
        <>
            {/* Mobile overlay */}
            {open && (
                <div
                    className="fixed inset-0 z-30 bg-surface-900/40 backdrop-blur-md md:hidden"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Sidebar panel */}
            <aside
                className={`
          fixed inset-y-0 left-0 z-30 w-[280px] m-4 md:m-0 
          md:sticky md:top-24 md:h-[calc(100vh-8rem)] md:translate-x-0
          bg-white/70 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl shadow-surface-900/10
          flex flex-col transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${open ? 'translate-x-0 scale-100 opacity-100' : '-translate-x-full scale-95 opacity-0 md:opacity-100 md:scale-100'}
        `}
            >
                {/* Mobile close */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200/50 md:hidden">
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Navigation</span>
                    <button onClick={() => setOpen(false)} className="p-2 rounded-xl border border-surface-200/50 hover:bg-white transition-all active:scale-95">
                        <X size={16} className="text-surface-600" />
                    </button>
                </div>

                {/* Nav links */}
                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                    {filteredNav.map(({ to, label, sublabel, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            onClick={() => setOpen(false)}
                            className={({ isActive }) =>
                                `group relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${isActive
                                    ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-xl shadow-brand-500/25 translate-x-1'
                                    : 'text-surface-500 hover:bg-white hover:text-surface-900 hover:shadow-lg hover:shadow-surface-900/5 hover:-translate-y-0.5'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${isActive ? 'bg-white/20 rotate-[10deg]' : 'bg-surface-50 group-hover:bg-white group-hover:rotate-0'
                                        }`}>
                                        <Icon size={18} className={isActive ? 'text-white' : 'text-surface-400 group-hover:text-brand-500'} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate tracking-tight">{label}</div>
                                        {sublabel && (
                                            <div className={`text-[9px] font-bold uppercase tracking-wider opacity-60 ${isActive ? 'text-white' : 'text-surface-400'
                                                }`}>
                                                {sublabel}
                                            </div>
                                        )}
                                    </div>
                                    {isActive && (
                                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-8 bg-white rounded-full blur-[2px] opacity-40" />
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-surface-200/50">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
                        </div>
                        <span className="text-[10px] font-bold text-surface-400 tracking-[0.2em] uppercase">Live System</span>
                    </div>
                </div>
            </aside>
        </>
    )
}
