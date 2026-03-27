import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Package, Clock, Users, DollarSign, TrendingUp, ArrowUpRight } from 'lucide-react'

export default function DashboardPage() {
    const { canViewFinancials, role } = useAuth()
    const [stats, setStats] = useState({
        totalStock: 0,
        pendingApprovals: 0,
        totalVendors: 0,
        monthlySpend: 0,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStats()
    }, [])

    async function fetchStats() {
        setLoading(true)
        try {
            // Total Stock
            const { data: inventory } = await supabase.from('inventory').select('quantity')
            const totalStock = inventory?.reduce((sum, r) => sum + (r.quantity || 0), 0) || 0

            // Pending Approvals
            const { count: pendingApprovals } = await supabase
                .from('purchase_intents')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'Pending')

            // Total Vendors
            const { data: vendors } = await supabase.from('vendor_quotes').select('vendor_name')
            const uniqueVendors = new Set(vendors?.map(v => v.vendor_name) || [])
            const totalVendors = uniqueVendors.size

            // Monthly Spend
            const now = new Date()
            const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
            const { data: quotes } = await supabase
                .from('vendor_quotes')
                .select('price_quoted')
                .gte('created_at', startOfMonth)
            const monthlySpend = quotes?.reduce((sum, r) => sum + (parseFloat(r.price_quoted) || 0), 0) || 0

            setStats({ totalStock, pendingApprovals: pendingApprovals || 0, totalVendors, monthlySpend })
        } catch (err) {
            console.error('Error fetching stats:', err)
        }
        setLoading(false)
    }

    const cards = [
        {
            title: 'Inventory Stock',
            value: stats.totalStock.toLocaleString(),
            icon: Package,
            gradient: 'from-brand-500 to-brand-600',
            glow: 'shadow-brand-500/20',
            bgLight: 'bg-brand-50',
            textLight: 'text-brand-600',
            show: true,
        },
        {
            title: 'Pending Approvals',
            value: stats.pendingApprovals.toLocaleString(),
            icon: Clock,
            gradient: 'from-amber-400 to-orange-500',
            glow: 'shadow-amber-500/20',
            bgLight: 'bg-amber-50',
            textLight: 'text-amber-600',
            show: true,
        },
        {
            title: 'Active Vendors',
            value: stats.totalVendors.toLocaleString(),
            icon: Users,
            gradient: 'from-emerald-400 to-teal-500',
            glow: 'shadow-emerald-500/20',
            bgLight: 'bg-emerald-50',
            textLight: 'text-emerald-600',
            show: true,
        },
        {
            title: 'Monthly Spend',
            value: '₹' + stats.monthlySpend.toLocaleString('en-IN', { minimumFractionDigits: 0 }),
            icon: DollarSign,
            gradient: 'from-violet-500 to-purple-600',
            glow: 'shadow-violet-500/20',
            bgLight: 'bg-violet-50',
            textLight: 'text-violet-600',
            show: canViewFinancials,
        },
    ]

    const visibleCards = cards.filter(c => c.show)

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Page title */}
            <div>
                <h2 className="text-3xl font-extrabold text-surface-900 tracking-tighter">Overview</h2>
                <p className="text-sm text-surface-400 font-medium mt-2">
                    Operational pulse and key performance metrics.
                </p>
            </div>

            {/* Stat cards */}
            <div className={`grid gap-6 ${visibleCards.length === 4 ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
                {visibleCards.map(({ title, value, icon: Icon, gradient, glow, bgLight, textLight }) => (
                    <div
                        key={title}
                        className={`group relative overflow-hidden rounded-[2.5rem] bg-white border border-surface-200/50 p-7 transition-all duration-500 hover:shadow-2xl hover:shadow-brand-500/10 hover:-translate-y-2`}
                    >
                        {/* Background decoration */}
                        <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${gradient} opacity-[0.03] blur-2xl group-hover:opacity-10 transition-opacity duration-500`} />

                        <div className="flex flex-col gap-6 relative">
                            <div className="flex items-center justify-between">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-lg ${glow} transition-transform duration-500 group-hover:rotate-[10deg]`}>
                                    <Icon size={20} className="text-white" />
                                </div>
                                <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${bgLight} ${textLight}`}>
                                    {title}
                                    <ArrowUpRight size={12} className="opacity-50" />
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <div className={`text-4xl font-extrabold tracking-tighter ${loading ? 'animate-pulse text-surface-200' : 'text-surface-900'}`}>
                                    {loading ? '—' : value}
                                </div>
                                <div className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">
                                    {loading ? 'Fetching records...' : 'Real-time update'}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Role notice for supervisors */}
            {!canViewFinancials && (
                <div className="rounded-3xl bg-amber-50/50 border border-amber-200/50 p-6 flex items-start gap-4 backdrop-blur-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 mt-0.5">
                        <Clock size={18} className="text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-amber-900 uppercase tracking-tight">Access Restricted</p>
                        <p className="text-xs text-amber-700/60 mt-1 leading-relaxed">
                            Financial details and spend analytics are currently hidden for the <span className="font-bold text-amber-700 underline decoration-amber-300 decoration-2 underline-offset-2 capitalize">{role}</span> role. Contact an administrator to upgrade your permissions.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
