import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { X, Plus, Loader2, Package } from 'lucide-react'

const emptyForm = { manufacturer: '', serial_number: '', model_number: '', stock_count: '0', description: '' }

export default function AddInventoryModal({ open, onClose, onSuccess }) {
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
        if (!form.manufacturer.trim()) return setError('Manufacturer is required')
        if (!form.model_number.trim()) return setError('Model Number is required')

        setSubmitting(true)

        const { error: insertError } = await supabase.from('inventory').insert({
            manufacturer: form.manufacturer.trim().toUpperCase(),
            serial_number: form.serial_number.trim() || null,
            model_number: form.model_number.trim().toUpperCase(),
            stock_count: parseInt(form.stock_count) || 0,
            description: form.description.trim() || null,
        })

        if (insertError) {
            setError(insertError.message)
            setSubmitting(false)
            return
        }

        // Audit log
        await supabase.from('activity_logs').insert({
            user_name: 'Demo User',
            user_role: 'owner',
            action: `Added new inventory item: ${form.model_number.trim().toUpperCase()} (${form.manufacturer.trim().toUpperCase()})`,
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
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-surface-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 bg-surface-50/50">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/25">
                            <Package size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">Add New Item</h3>
                            <p className="text-[10px] text-surface-700/50">Add to inventory catalog</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Manufacturer *</label>
                            <input
                                value={form.manufacturer}
                                onChange={e => handle('manufacturer', e.target.value)}
                                placeholder="e.g. SIEMENS"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Serial Number</label>
                            <input
                                value={form.serial_number}
                                onChange={e => handle('serial_number', e.target.value)}
                                placeholder="e.g. ELM-EL-027"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Model Number *</label>
                            <input
                                value={form.model_number}
                                onChange={e => handle('model_number', e.target.value)}
                                placeholder="e.g. 5SL4416-7RC"
                                className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all uppercase font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Initial Stock</label>
                            <input
                                type="number"
                                min="0"
                                value={form.stock_count}
                                onChange={e => handle('stock_count', e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Description</label>
                        <input
                            value={form.description}
                            onChange={e => handle('description', e.target.value)}
                            placeholder="e.g. MCB - 25A, 3 POLE"
                            className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                        />
                    </div>

                    {error && (
                        <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{error}</div>
                    )}

                    {success && (
                        <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-1.5">
                            <span>✓</span> Item added to inventory!
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
                            {submitting ? (
                                <><Loader2 size={14} className="animate-spin" /> Adding...</>
                            ) : (
                                <><Plus size={14} /> Add Item</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
