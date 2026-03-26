import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { X, Plus, Loader2, ShoppingBag } from 'lucide-react'

const UOM_OPTIONS = ['NOS', 'MTR', 'KG', 'SET', 'ROLL', 'BOX', 'PCS', 'PAIR', 'LOT', 'LTR']

const emptyForm = {
    product_name: '',
    manufacturer: '',
    model_number: '',
    serial_number: '',
    stock_count: '1',
    uom: 'NOS',
    description: '',
    invoice_no: '',
    vendor_name: '',
    invoice_date: '',
}

export default function PurchaseEntryModal({ open, onClose, onSuccess }) {
    const { user, role } = useAuth()
    const [form, setForm] = useState({ ...emptyForm })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [vendors, setVendors] = useState([])

    useEffect(() => {
        if (open) {
            setForm({ ...emptyForm })
            setError('')
            setSuccess(false)
            fetchVendors()
        }
    }, [open])

    async function fetchVendors() {
        const { data } = await supabase.from('vendors').select('id, name').order('name')
        setVendors(data || [])
    }

    function handle(field, value) {
        setForm(prev => ({ ...prev, [field]: value }))
        setError('')
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.product_name.trim()) return setError('Product Name is required')
        if (!form.manufacturer.trim()) return setError('Manufacturer is required')
        if (!form.vendor_name.trim()) return setError('Vendor Name is required')
        if (!form.invoice_no.trim()) return setError('Invoice No. is required')
        if (!form.invoice_date) return setError('Invoice Date is required')

        setSubmitting(true)

        const { error: insertError } = await supabase.from('inventory').insert({
            product_name: form.product_name.trim(),
            manufacturer: form.manufacturer.trim().toUpperCase(),
            model_number: form.model_number.trim().toUpperCase() || null,
            serial_number: form.serial_number.trim() || null,
            stock_count: parseInt(form.stock_count) || 0,
            uom: form.uom || 'NOS',
            description: form.description.trim() || null,
        })

        if (insertError) {
            setError(insertError.message)
            setSubmitting(false)
            return
        }

        await supabase.from('activity_logs').insert({
            user_name: user?.user_metadata?.full_name || user?.email || 'User',
            user_role: role,
            action: `Purchase entry: ${form.product_name.trim()} × ${form.stock_count} | Vendor: ${form.vendor_name} | Invoice: ${form.invoice_no} (${form.invoice_date})`,
            entity_type: 'inventory',
        })

        setSuccess(true)
        setTimeout(() => {
            setSuccess(false)
            setForm({ ...emptyForm })
            setSubmitting(false)
            onSuccess?.()
            onClose()
        }, 1000)
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-900/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-surface-200 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 bg-surface-50/50 sticky top-0">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 shadow-md shadow-violet-500/25">
                            <ShoppingBag size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">New Purchase Entry</h3>
                            <p className="text-[10px] text-surface-700/50">Record a purchase receipt with invoice details</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* ─── Invoice Details ─── */}
                    <div>
                        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-violet-100 text-violet-600 text-[9px] font-bold">1</span>
                            Invoice Details
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                                    Vendor Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    value={form.vendor_name}
                                    onChange={e => handle('vendor_name', e.target.value)}
                                    list="vendor-list"
                                    placeholder="Select or type..."
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                                />
                                <datalist id="vendor-list">
                                    {vendors.map(v => <option key={v.id} value={v.name} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                                    Invoice No. <span className="text-red-400">*</span>
                                </label>
                                <input
                                    value={form.invoice_no}
                                    onChange={e => handle('invoice_no', e.target.value)}
                                    placeholder="e.g. INV-2026-001"
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                                    Invoice Date <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={form.invoice_date}
                                    onChange={e => handle('invoice_date', e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ─── Product Details ─── */}
                    <div>
                        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-brand-100 text-brand-600 text-[9px] font-bold">2</span>
                            Product Details
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                                    Product Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    value={form.product_name}
                                    onChange={e => handle('product_name', e.target.value)}
                                    placeholder="e.g. MCB 25A 3-Pole"
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                                        Manufacturer <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        value={form.manufacturer}
                                        onChange={e => handle('manufacturer', e.target.value)}
                                        placeholder="e.g. SIEMENS"
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Model No.</label>
                                    <input
                                        value={form.model_number}
                                        onChange={e => handle('model_number', e.target.value)}
                                        placeholder="e.g. 5SL4416-7RC"
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono uppercase"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Serial No.</label>
                                    <input
                                        value={form.serial_number}
                                        onChange={e => handle('serial_number', e.target.value)}
                                        placeholder="SN-..."
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Qty</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.stock_count}
                                        onChange={e => handle('stock_count', e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">UOM</label>
                                    <select
                                        value={form.uom}
                                        onChange={e => handle('uom', e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all cursor-pointer"
                                    >
                                        {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Description</label>
                                <input
                                    value={form.description}
                                    onChange={e => handle('description', e.target.value)}
                                    placeholder="Brief notes..."
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{error}</div>
                    )}
                    {success && (
                        <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-1.5">
                            <span>✓</span> Purchase entry recorded!
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-surface-700 rounded-xl border border-surface-200 hover:bg-surface-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 shadow-lg shadow-violet-500/25 transition-all disabled:opacity-60"
                        >
                            {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Plus size={14} /> Record Purchase</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
