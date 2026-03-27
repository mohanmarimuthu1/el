import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Package, ArrowLeft, Globe, Loader2 } from 'lucide-react'

export default function PublicInventoryPage() {
    const { id } = useParams()
    const [item, setItem] = useState(null)
    const [allItems, setAllItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (id) {
            fetchSingleItem(id)
        } else {
            fetchAllPublicItems()
        }
    }, [id])

    async function fetchSingleItem(itemId) {
        setLoading(true)
        // Privacy: select ONLY safe columns — no serial_number, no price, no vendor data
        const { data, error: fetchErr } = await supabase
            .from('inventory')
            .select('id, manufacturer, model_number, quantity, description')
            .eq('id', itemId)
            .single()

        if (fetchErr) {
            setError('Item not found')
        } else {
            setItem(data)
        }
        setLoading(false)
    }

    async function fetchAllPublicItems() {
        setLoading(true)
        // Privacy: select ONLY safe columns
        const { data, error: fetchErr } = await supabase
            .from('inventory')
            .select('id, manufacturer, model_number, quantity, description')
            .order('manufacturer', { ascending: true })

        if (fetchErr) {
            setError('Unable to load inventory')
        } else {
            setAllItems(data || [])
        }
        setLoading(false)
    }

    // Single item detail view
    if (id) {
        return (
            <div className="min-h-screen bg-surface-50">
                {/* Public header */}
                <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-surface-200 bg-white/90 backdrop-blur-xl px-4 md:px-8 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-brand-500/25">
                        <span className="text-white font-bold text-xs">EL</span>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-surface-900">Elman Furnace Pvt. Ltd.</h1>
                        <p className="text-[10px] text-surface-700/50 font-medium uppercase tracking-wider">Public Inventory</p>
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-semibold ring-1 ring-emerald-200">
                        <Globe size={10} />
                        Public View
                    </div>
                </header>

                <main className="max-w-2xl mx-auto p-4 md:p-8">
                    <Link
                        to="/inventory/public"
                        className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium mb-6 transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Back to Inventory
                    </Link>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-brand-500" />
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl bg-red-50 border border-red-200 p-8 text-center">
                            <p className="text-red-700 font-semibold">{error}</p>
                            <p className="text-xs text-red-500 mt-1">The requested item may not exist or has been removed.</p>
                        </div>
                    ) : item ? (
                        <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-surface-200 bg-surface-50/50">
                                <h2 className="text-xl font-bold text-surface-900 flex items-center gap-2">
                                    <Package size={20} className="text-brand-500" />
                                    {item.model_number || 'Unnamed Item'}
                                </h2>
                                <p className="text-sm text-surface-700/60 mt-0.5">{item.manufacturer}</p>
                            </div>
                            <div className="p-6 space-y-4">
                                <DetailRow label="Manufacturer" value={item.manufacturer} />
                                <DetailRow label="Model Number" value={item.model_number} />
                                <DetailRow label="Stock Available" value={
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${item.quantity > 0
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}>
                                        {item.quantity} units
                                    </span>
                                } />
                                <DetailRow label="Description" value={item.description || '—'} />
                            </div>
                            <div className="px-6 py-3 bg-surface-50/50 border-t border-surface-200 text-[10px] text-surface-700/40 font-medium uppercase tracking-wider">
                                Sensitive data (serial numbers, pricing, vendor info) is excluded from this view
                            </div>
                        </div>
                    ) : null}
                </main>
            </div>
        )
    }

    // List view (no ID)
    return (
        <div className="min-h-screen bg-surface-50">
            {/* Public header */}
            <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-surface-200 bg-white/90 backdrop-blur-xl px-4 md:px-8 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-brand-500/25">
                    <span className="text-white font-bold text-xs">EL</span>
                </div>
                <div>
                    <h1 className="text-sm font-bold text-surface-900">Elman Furnace Pvt. Ltd.</h1>
                    <p className="text-[10px] text-surface-700/50 font-medium uppercase tracking-wider">Public Inventory Catalog</p>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-semibold ring-1 ring-emerald-200">
                    <Globe size={10} />
                    Public View
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 md:p-8">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <Package size={22} className="text-brand-500" />
                        Inventory Catalog
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">
                        Public listing — sensitive data (serial numbers, pricing) excluded
                    </p>
                </div>

                <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-50/80">
                                    <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Manufacturer</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Model No.</th>
                                    <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Stock</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b border-surface-100">
                                            {Array.from({ length: 4 }).map((_, j) => (
                                                <td key={j} className="px-5 py-3.5">
                                                    <div className="h-4 bg-surface-200 rounded animate-pulse w-24" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : allItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-12 text-center text-surface-700/40">
                                            <Package size={36} className="mx-auto mb-2 opacity-30" />
                                            <p className="font-medium">No inventory items available</p>
                                            <p className="text-xs mt-1">Check back later for updated stock information.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    allItems.map((row) => (
                                        <tr key={row.id} className="border-b border-surface-100 hover:bg-brand-50/30 transition-colors">
                                            <td className="px-5 py-3.5 font-medium text-surface-800">{row.manufacturer || '—'}</td>
                                            <td className="px-5 py-3.5 text-surface-700">
                                                <Link
                                                    to={`/inventory/public/${row.id}`}
                                                    className="text-brand-600 hover:text-brand-700 hover:underline font-medium transition-colors"
                                                >
                                                    {row.model_number || '—'}
                                                </Link>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${row.quantity > 0
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {row.quantity}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-surface-700 max-w-[250px] truncate">{row.description || '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!loading && (
                        <div className="px-5 py-3 bg-surface-50/50 border-t border-surface-200 text-xs text-surface-700/50 font-medium">
                            Showing {allItems.length} items — serial numbers, vendor quotes, and pricing excluded
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

function DetailRow({ label, value }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2 border-b border-surface-100 last:border-0">
            <span className="text-xs font-semibold text-surface-700/60 uppercase tracking-wider sm:w-36 shrink-0">{label}</span>
            <span className="text-sm text-surface-800 font-medium">{value}</span>
        </div>
    )
}
