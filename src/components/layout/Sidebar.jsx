import { NavLink } from 'react-router-dom'
import { LayoutDashboard, HardDrive, FileText, Users, X, ScrollText, Truck, ShieldCheck, LayoutGrid, Briefcase, Building2, Lock, FolderKey, Bell, ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { useState, useEffect } from 'react'

const navSections = [
    {
        title: 'Core',
        items: [
            {
                to: '/', label: 'Dashboard', icon: LayoutDashboard,
                subItems: [
                    { to: '/purchase-entries', label: 'Purchase Entries', icon: FileText },
                ]
            },
        ]
    },
    {
        title: 'Product Management',
        items: [
            { to: '/inventory', label: 'Inventory', sublabel: 'Live Stock Tracking', icon: HardDrive },
        ]
    },
    {
        title: 'Vendor Management',
        items: [
            { to: '/vendors', label: 'Vendor Directory', sublabel: 'All Registered Vendors', icon: Users },
        ]
    },
    {
        title: 'Projects',
        items: [
            { to: '/projects', label: 'Active Projects', sublabel: 'Manager', icon: Briefcase },
            { to: '/despatch', label: 'Despatch', sublabel: 'Outbound', icon: Truck, designGated: true },
            { to: '/purchase-intents', label: 'Approvals', sublabel: 'Purchase Request Ledger', icon: FileText, designGated: true },
            { to: '/project-usage', label: 'Despatch History', sublabel: 'Material Allocation Log', icon: LayoutGrid, designGated: true },
        ]
    },
    {
        title: 'System',
        items: [
            { to: '/audit-log', label: 'Audit Log', sublabel: 'Activity Trail', icon: ScrollText, ownerOnly: true },
            { to: '/user-management', label: 'User Management', sublabel: 'Admin Panel', icon: ShieldCheck, adminOrOwner: true },
            { to: '/role-management', label: 'Role Management', sublabel: 'Permissions', icon: FolderKey, adminOnly: true },
        ]
    }
]

export default function Sidebar({ open, setOpen, selectedProjectId, setSelectedProjectId }) {
    const { role, canViewFinancials, isAdmin, isOwner } = useAuth()
    const [activeProject, setActiveProject] = useState(null)
    const [designApproved, setDesignApproved] = useState(false)
    const [pendingApprovals, setPendingApprovals] = useState(0)
    const [expandedItems, setExpandedItems] = useState({})

    useEffect(() => {
        if (selectedProjectId) {
            fetchProjectInfo()
        } else {
            setActiveProject(null)
            setDesignApproved(false)
        }
    }, [selectedProjectId])

    useEffect(() => {
        fetchPendingApprovals()
        const interval = setInterval(fetchPendingApprovals, 30000)
        return () => clearInterval(interval)
    }, [role, selectedProjectId])

    async function fetchPendingApprovals() {
        let query = supabase
            .from('purchase_intent_headers')
            .select('id, approved_manager, approved_store, approved_purchase, approved_md, status')
            .neq('status', 'Delivered')

        if (selectedProjectId) {
            query = query.eq('project_id', selectedProjectId)
        }

        const { data } = await query

        if (data) {
            const pending = data.filter(item => {
                if ((role === 'manager' || isAdmin) && !item.approved_manager) return true
                if ((role === 'store' || isAdmin) && item.approved_manager && !item.approved_store) return true
                if ((role === 'supervisor' || isAdmin) && item.approved_store && !item.approved_purchase) return true
                if ((role === 'owner' || isAdmin) && item.approved_purchase && !item.approved_md) return true
                return false
            })
            setPendingApprovals(pending.length)
        }
    }

    async function fetchProjectInfo() {
        const { data, error } = await supabase
            .from('projects_metadata')
            .select('name, design_approved')
            .eq('id', selectedProjectId)
            .single()
        if (!error && data) {
            setActiveProject(data.name)
            setDesignApproved(data.design_approved || false)
        }
    }

    const filterItems = (items) => items.filter(item => {
        if (item.adminOnly && !isAdmin) return false
        if (item.adminOrOwner && !isAdmin && !isOwner) return false
        if (item.ownerOnly && role !== 'owner' && !isAdmin) return false
        if (item.financialOnly && !canViewFinancials) return false
        return true
    })

    const isItemGated = (item) => {
        return item.designGated && selectedProjectId && !designApproved
    }

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

                {/* Active Project Context */}
                {selectedProjectId && (
                    <div className="mx-4 mt-6 p-4 rounded-2xl bg-brand-50 border border-brand-100 animate-in slide-in-from-left-4 duration-500">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">Active Project</span>
                            <button
                                onClick={() => setSelectedProjectId(null)}
                                className="p-1 rounded-lg hover:bg-brand-100 text-brand-600 transition-colors"
                                title="Clear Project Context"
                            >
                                <X size={12} />
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-brand-900 truncate">{activeProject || 'Loading...'}</div>
                            </div>
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white shadow-sm shadow-brand-500/20">
                                <Briefcase size={14} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Nav links */}
                <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar">
                    {navSections.map((section) => {
                        const filteredItems = filterItems(section.items)
                        if (filteredItems.length === 0) return null

                        return (
                            <div key={section.title} className="space-y-3">
                                <h3 className="px-5 text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em]">
                                    {section.title}
                                </h3>
                                <div className="space-y-1">
                                    {filteredItems.map(({ to, label, sublabel, icon: Icon, designGated, showNotification, subItems }) => {
                                        const gated = isItemGated({ designGated })
                                        const isPurchaseIndent = to === '/purchase-intents'
                                        const showBadge = isPurchaseIndent && pendingApprovals > 0
                                        const hasSubItems = subItems && subItems.length > 0
                                        const isExpanded = expandedItems[to]

                                        if (gated) {
                                            return (
                                                <div
                                                    key={to}
                                                    className="group relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-surface-300 cursor-not-allowed opacity-60"
                                                    title="Upload a design first to unlock this module"
                                                >
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-50">
                                                        <Lock size={16} className="text-surface-300" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="truncate tracking-tight">{label}</div>
                                                        <div className="text-[9px] font-bold uppercase tracking-wider text-surface-300">
                                                            Design required
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }

                                        return (
                                            <div key={to}>
                                                <div className="flex items-center">
                                                    <NavLink
                                                        to={to}
                                                        end={to === '/'}
                                                        onClick={() => setOpen(false)}
                                                        className={({ isActive }) =>
                                                            `group relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 flex-1 ${isActive
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
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="truncate tracking-tight">{label}</div>
                                                                    {sublabel && (
                                                                        <div className={`text-[9px] font-bold uppercase tracking-wider opacity-60 ${isActive ? 'text-white' : 'text-surface-400'
                                                                            }`}>
                                                                            {sublabel}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {showBadge && (
                                                                    <div className="flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse shadow-lg shadow-red-500/30">
                                                                        <Bell size={10} />
                                                                        {pendingApprovals}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </NavLink>
                                                    {hasSubItems && (
                                                        <button
                                                            onClick={() => setExpandedItems(prev => ({ ...prev, [to]: !prev[to] }))}
                                                            className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-all mr-1"
                                                            title="Expand"
                                                        >
                                                            <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    )}
                                                </div>
                                                {/* Sub-items dropdown */}
                                                {hasSubItems && isExpanded && (
                                                    <div className="ml-8 mt-1 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                                                        {subItems.map(({ to: subTo, label: subLabel, icon: SubIcon }) => (
                                                            <NavLink
                                                                key={subTo}
                                                                to={subTo}
                                                                onClick={() => setOpen(false)}
                                                                className={({ isActive }) =>
                                                                    `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${isActive
                                                                        ? 'bg-brand-100 text-brand-700'
                                                                        : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700'
                                                                    }`
                                                                }
                                                            >
                                                                <SubIcon size={14} />
                                                                {subLabel}
                                                            </NavLink>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
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
