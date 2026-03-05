import { NavLink } from 'react-router-dom'
import { LayoutDashboard, HardDrive, FileText, Users, X, ScrollText, Truck, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/inventory', label: 'Inventory', sublabel: 'Hardware Tracking', icon: HardDrive },
    { to: '/purchase-intents', label: 'Purchase Intents', sublabel: 'Ledger', icon: FileText },
    { to: '/vendors', label: 'Vendor Management', icon: Users, financialOnly: true },
    { to: '/dispatch', label: 'Dispatch', sublabel: 'Outbound Tracking', icon: Truck },
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
                    className="fixed inset-0 z-30 bg-surface-900/30 backdrop-blur-sm md:hidden"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Sidebar panel */}
            <aside
                className={`
          fixed inset-y-0 left-0 z-30 w-[260px] bg-white border-r border-surface-200
          flex flex-col transition-transform duration-300 ease-out
          md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:translate-x-0
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        `}
            >
                {/* Mobile close */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 md:hidden">
                    <span className="text-sm font-bold text-surface-800">Navigation</span>
                    <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-surface-100">
                        <X size={18} />
                    </button>
                </div>

                {/* Nav links */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {filteredNav.map(({ to, label, sublabel, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            onClick={() => setOpen(false)}
                            className={({ isActive }) =>
                                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/25'
                                    : 'text-surface-700 hover:bg-surface-100 hover:text-surface-900'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-white/20' : 'bg-surface-100 group-hover:bg-surface-200'
                                        }`}>
                                        <Icon size={17} className={isActive ? 'text-white' : 'text-surface-700/70'} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate">{label}</div>
                                        {sublabel && (
                                            <div className={`text-[10px] font-normal -mt-0.5 ${isActive ? 'text-white/70' : 'text-surface-700/40'
                                                }`}>
                                                {sublabel}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-surface-200">
                    <div className="flex items-center gap-2 text-[10px] text-surface-700/40 font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Connected
                    </div>
                </div>
            </aside>
        </>
    )
}
