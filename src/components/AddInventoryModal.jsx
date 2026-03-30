import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { X, Plus, Loader2, Package, ToggleLeft, ToggleRight } from 'lucide-react'
import SearchableDropdown from '@/components/SearchableDropdown'

const UOM_OPTIONS = ['NOS', 'MTR', 'KG', 'SET', 'ROLL', 'BOX', 'PCS', 'PAIR', 'LOT', 'LTR']

const emptyForm = {
    product_name: '',
    department: '',
    manufacturer: '',
    model_number: '',
    serial_number: '',
    quantity: '0',
    uom: 'NOS',
    description: '',
    maintain_stock: false,
    min_stock_level: '0',
    max_stock_level: '0',
}

export default function AddInventoryModal({ open, onClose, onSuccess }) {
    const { user, role } = useAuth()
    const [form, setForm] = useState({ ...emptyForm })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (open) {
            setForm({ ...emptyForm })
            setError('')
            setSuccess(false)
        }
    }, [open])

    function handle(field, value) {
        setForm(prev => ({ ...prev, [field]: value }))
        setError('')
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.product_name.trim()) return setError('Product Name is required')
        if (!form.manufacturer.trim()) return setError('Make is required')

        setSubmitting(true)

        const { error: insertError } = await supabase.from('inventory').insert({
            product_name: form.product_name.trim(),
            department: form.department.trim() || null,
            manufacturer: form.manufacturer.trim().toUpperCase(),
            model_number: form.model_number.trim() || '-',
            serial_number: form.serial_number.trim() || null,
            quantity: parseInt(form.quantity) || 0,
            uom: form.uom || 'NOS',
            description: form.description.trim() || null,
            maintain_stock: form.maintain_stock,
            min_stock_level: form.maintain_stock ? (parseInt(form.min_stock_level) || 0) : 0,
            max_stock_level: form.maintain_stock ? (parseInt(form.max_stock_level) || 0) : 0,
        })

        if (insertError) {
            setError(insertError.message)
            setSubmitting(false)
            return
        }

        await supabase.from('activity_logs').insert({
            user_name: user?.user_metadata?.full_name || user?.email || 'User',
            user_role: role,
            action: `Added new inventory item: ${form.product_name.trim()} (${form.manufacturer.trim().toUpperCase()})${form.model_number ? ` - ${form.model_number}` : ''}`,
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
            <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-surface-200 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 bg-surface-50/50 sticky top-0">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/25">
                            <Package size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">Add New Product</h3>
                            <p className="text-[10px] text-surface-700/50">Add to inventory catalog</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Department */}
                    <div>
                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                            Department
                        </label>
                        <SearchableDropdown
                            category="department"
                            value={form.department}
                            onChange={val => handle('department', val)}
                            placeholder="Select or type..."
                        />
                    </div>

                    {/* Product Name */}
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

                    {/* Manufacturer + Model Number */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                                Make <span className="text-red-400">*</span>
                            </label>
                            <SearchableDropdown
                                category="manufacturer"
                                value={form.manufacturer}
                                onChange={val => handle('manufacturer', val)}
                                placeholder="Select or type..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                                Model Number
                            </label>
                            <SearchableDropdown
                                category="model_number"
                                value={form.model_number}
                                onChange={val => handle('model_number', val)}
                                placeholder="e.g. GV2-ME20"
                            />
                        </div>
                    </div>

                    {/* Serial Number */}
                    {/* <div>
                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                            Serial Number
                        </label>
                        <input
                            value={form.serial_number}
                            onChange={e => handle('serial_number', e.target.value)}
                            placeholder="If applicable..."
                            className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                        />
                    </div> */}

                    {/* Initial Qty */}
                    <div>
                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Initial Qty</label>
                        <input
                            type="number"
                            min="0"
                            value={form.quantity}
                            onChange={e => handle('quantity', e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                        />
                    </div>

                    {/* UOM */}
                    <div className="w-1/2 pr-2">
                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">UOM</label>
                        <SearchableDropdown
                            category="uom"
                            value={form.uom}
                            onChange={val => handle('uom', val)}
                            placeholder="Select UOM"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Product Description</label>
                        <input
                            value={form.description}
                            onChange={e => handle('description', e.target.value)}
                            placeholder="Brief notes..."
                            className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                        />
                    </div>

                    {/* Maintain Stock Toggle */}
                    <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-surface-800">Maintain Stock</p>
                            <p className="text-xs text-surface-500 mt-0.5">Enable minimum stock level tracking & alerts</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handle('maintain_stock', !form.maintain_stock)}
                            className={`transition-colors ${form.maintain_stock ? 'text-brand-500' : 'text-surface-300'}`}
                        >
                            {form.maintain_stock
                                ? <ToggleRight size={36} />
                                : <ToggleLeft size={36} />
                            }
                        </button>
                    </div>

                    {/* Min + Max Stock Level — conditional */}
                    {form.maintain_stock && (
                        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 animate-in fade-in duration-200 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-brand-700 uppercase tracking-wider mb-2">
                                        Minimum Quantity
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.min_stock_level}
                                        onChange={e => handle('min_stock_level', e.target.value)}
                                        placeholder="e.g. 5"
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                                    />
                                    <p className="text-[10px] text-brand-600 mt-1">Alert when stock falls below this.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">
                                        Maximum Quantity
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.max_stock_level}
                                        onChange={e => handle('max_stock_level', e.target.value)}
                                        placeholder="e.g. 50"
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-orange-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all font-mono"
                                    />
                                    <p className="text-[10px] text-orange-600 mt-1">Warning when stock exceeds this.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{error}</div>
                    )}

                    {success && (
                        <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-1.5">
                            <span>✓</span> Product added to inventory!
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-surface-700 rounded-xl border border-surface-200 hover:bg-surface-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60"
                        >
                            {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : <><Plus size={14} /> Submit</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
