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
            const { data: inventory } = await supabase.from('inventory').select('stock_count')
            const totalStock = inventory?.reduce((sum, r) => sum + (r.stock_count || 0), 0) || 0

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
            title: 'Total Stock',
            value: stats.totalStock.toLocaleString(),
            icon: Package,
            gradient: 'from-blue-500 to-indigo-600',
            shadow: 'shadow-blue-500/20',
            bgLight: 'bg-blue-50',
            textLight: 'text-blue-600',
            show: true,
        },
        {
            title: 'Pending Approvals',
            value: stats.pendingApprovals.toLocaleString(),
            icon: Clock,
            gradient: 'from-amber-400 to-orange-500',
            shadow: 'shadow-amber-500/20',
            bgLight: 'bg-amber-50',
            textLight: 'text-amber-600',
            show: true,
        },
        {
            title: 'Total Vendors',
            value: stats.totalVendors.toLocaleString(),
            icon: Users,
            gradient: 'from-emerald-400 to-teal-500',
            shadow: 'shadow-emerald-500/20',
            bgLight: 'bg-emerald-50',
            textLight: 'text-emerald-600',
            show: true,
        },
        {
            title: 'Monthly Spend',
            value: '₹' + stats.monthlySpend.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            icon: DollarSign,
            gradient: 'from-violet-500 to-purple-600',
            shadow: 'shadow-violet-500/20',
            bgLight: 'bg-violet-50',
            textLight: 'text-violet-600',
            show: canViewFinancials,
        },
    ]

    const visibleCards = cards.filter(c => c.show)

    return (
        <div className="space-y-8">
            {/* Page title */}
            <div>
                <h2 className="text-2xl font-bold text-surface-900 tracking-tight">Dashboard</h2>
                <p className="text-sm text-surface-700/60 mt-1">
                    Welcome back — here's an overview of your operations.
                </p>
            </div>

            {/* Stat cards */}
            <div className={`grid gap-5 ${visibleCards.length === 4 ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
                {visibleCards.map(({ title, value, icon: Icon, gradient, shadow, bgLight, textLight }) => (
                    <div
                        key={title}
                        className={`relative overflow-hidden rounded-2xl bg-white border border-surface-200/60 p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${shadow}`}
                    >
                        {/* Background decoration */}
                        <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-xl`} />

                        <div className="flex items-start justify-between relative">
                            <div className="space-y-3">
                                <div className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${bgLight} ${textLight}`}>
                                    <Icon size={13} />
                                    {title}
                                </div>
                                <div className={`text-3xl font-extrabold tracking-tight ${loading ? 'animate-pulse text-surface-300' : 'text-surface-900'}`}>
                                    {loading ? '—' : value}
                                </div>
                            </div>
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg ${shadow}`}>
                                <TrendingUp size={18} className="text-white" />
                            </div>
                        </div>

                        <div className="mt-3 flex items-center gap-1 text-xs text-surface-700/50 font-medium">
                            <ArrowUpRight size={12} className="text-emerald-500" />
                            Live from Supabase
                        </div>
                    </div>
                ))}
            </div>

            {/* Role notice for supervisors */}
            {!canViewFinancials && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 mt-0.5">
                        <Clock size={16} className="text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-amber-800">Restricted View</p>
                        <p className="text-xs text-amber-700/70 mt-0.5">
                            Financial data (prices, GST, monthly spend) is hidden for the <span className="font-semibold capitalize">{role}</span> role. Contact your manager for full access.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
