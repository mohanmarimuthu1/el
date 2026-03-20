import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { X, Plus, Loader2, CheckCircle2 } from 'lucide-react'

const UNIT_OPTIONS = ['Nos', 'Kg', 'Mtr', 'Set', 'Pair', 'Ltr']

export default function CreateIntentModal({ open, onClose, onSuccess, selectedProjectId }) {
    const { user } = useAuth()
    const [form, setForm] = useState({
        model_code: '',
        description: '',
        unit: '',
        quantity_required: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    if (!open) return null

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value })
        setError('')
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        // Validate
        if (!form.model_code.trim()) return setError('Model Code is required')
        if (!form.description.trim()) return setError('Description is required')
        if (!form.unit) return setError('Please select a Unit')
        if (!form.quantity_required || Number(form.quantity_required) < 1)
            return setError('Quantity must be at least 1')

        setSubmitting(true)

        const { error: insertError } = await supabase.from('purchase_intents').insert({
            model_code: form.model_code.trim(),
            description: form.description.trim(),
            unit: form.unit,
            quantity_required: Number(form.quantity_required),
            requested_by: user?.id || null, // Changed back to ID (UUID) as per database schema requirement
            project_id: selectedProjectId || null,
            status: 'Requested',
        })

        if (insertError) {
            setError(insertError.message)
            setSubmitting(false)
            return
        }

        setSuccess(true)
        setTimeout(() => {
            setSuccess(false)
            setForm({ model_code: '', description: '', unit: '', quantity_required: '' })
            setSubmitting(false)
            onSuccess?.()
            onClose()
        }, 1200)
    }

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-surface-900/30 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="w-full max-w-lg bg-white rounded-2xl border border-surface-200 shadow-2xl shadow-surface-900/15 animate-in"
                    onClick={(e) => e.stopPropagation()}
                    style={{ animation: 'slideUp 0.3s ease-out' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
                        <div>
                            <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/25">
                                    <Plus size={16} className="text-white" />
                                </div>
                                New Purchase Intent
                            </h3>
                            <p className="text-xs text-surface-700/50 mt-0.5 ml-10">
                                Material Purchase Form — auto-captures timestamp & user
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-2 hover:bg-surface-100 text-surface-700/60 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* Model Code */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                Model Code <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                name="model_code"
                                value={form.model_code}
                                onChange={handleChange}
                                placeholder="e.g. ELM-FRC-2024"
                                className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                Description <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                placeholder="Describe the material requirement..."
                                rows={3}
                                className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-none"
                            />
                        </div>

                        {/* Unit + Qty Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                    Unit <span className="text-red-400">*</span>
                                </label>
                                <select
                                    name="unit"
                                    value={form.unit}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Select unit...</option>
                                    {UNIT_OPTIONS.map((u) => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                    Qty Required <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="quantity_required"
                                    value={form.quantity_required}
                                    onChange={handleChange}
                                    min="1"
                                    placeholder="0"
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                                />
                            </div>
                        </div>

                        {/* Auto-capture info */}
                        <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100">
                                <CheckCircle2 size={14} className="text-brand-600" />
                            </div>
                            <div className="text-xs text-brand-700">
                                <span className="font-semibold">Auto-captured:</span> Timestamp and User ID will be recorded on submission.
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 text-sm font-medium rounded-xl text-surface-700 hover:bg-surface-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || success}
                                className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl text-white transition-all shadow-lg ${success
                                        ? 'bg-emerald-500 shadow-emerald-500/25'
                                        : 'bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-brand-500/25 hover:shadow-brand-500/40'
                                    } disabled:opacity-70 disabled:cursor-not-allowed`}
                            >
                                {submitting ? (
                                    <><Loader2 size={15} className="animate-spin" /> Submitting...</>
                                ) : success ? (
                                    <><CheckCircle2 size={15} /> Submitted!</>
                                ) : (
                                    <><Plus size={15} /> Create Intent</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </>
    )
}
