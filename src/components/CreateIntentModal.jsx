import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { X, Plus, Loader2, CheckCircle2, ListChecks } from 'lucide-react'
import SearchableDropdown from '@/components/SearchableDropdown'

export default function CreateIntentModal({ open, onClose, onSuccess, selectedProjectId }) {
    const { user } = useAuth()
    const [form, setForm] = useState({
        department: '',
        description: '',
        quantity_required: '',
        unit_of_measurement: '',
        make: '',
        raised_by: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [specs, setSpecs] = useState([])
    const [specsLoading, setSpecsLoading] = useState(false)

    useEffect(() => {
        if (open && selectedProjectId) {
            fetchSpecs()
            // Auto-fill raised_by with user email/name
            setForm(prev => ({
                ...prev,
                raised_by: prev.raised_by || user?.user_metadata?.full_name || user?.email || ''
            }))
        }
    }, [open, selectedProjectId])

    async function fetchSpecs() {
        if (!selectedProjectId) return
        setSpecsLoading(true)
        const { data } = await supabase
            .from('project_specs')
            .select('*')
            .eq('project_id', selectedProjectId)
            .order('created_at', { ascending: true })
        setSpecs(data || [])
        setSpecsLoading(false)
    }

    if (!open) return null

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value })
        setError('')
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        if (!form.department) return setError('Department is required')
        if (!form.description.trim()) return setError('Product description is required')
        if (!form.quantity_required || Number(form.quantity_required) < 1)
            return setError('Quantity must be at least 1')
        if (!form.unit_of_measurement) return setError('Unit is required')

        setSubmitting(true)

        const { error: insertError } = await supabase.from('purchase_intents').insert({
            department: form.department,
            description: form.description.trim(),
            quantity_required: Number(form.quantity_required),
            unit_of_measurement: form.unit_of_measurement,
            make: form.make || null,
            raised_by: form.raised_by.trim() || null,
            requested_by: user?.id || null,
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
            setForm({
                department: '',
                description: '',
                quantity_required: '',
                unit_of_measurement: '',
                make: '',
                raised_by: user?.user_metadata?.full_name || user?.email || '',
            })
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
                    className="w-full max-w-2xl bg-white rounded-2xl border border-surface-200 shadow-2xl shadow-surface-900/15 max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                    style={{ animation: 'slideUp 0.3s ease-out' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 sticky top-0 bg-white z-10">
                        <div>
                            <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/25">
                                    <Plus size={16} className="text-white" />
                                </div>
                                New Purchase Intent
                            </h3>
                            <p className="text-xs text-surface-700/50 mt-0.5 ml-10">
                                Smart material purchase form
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
                        {/* Department */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                Department <span className="text-red-400">*</span>
                            </label>
                            <select
                                name="department"
                                value={form.department}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all appearance-none cursor-pointer"
                            >
                                <option value="">Select department...</option>
                                <option value="Mechanical">Mechanical</option>
                                <option value="Electrical">Electrical</option>
                                <option value="Fabrication">Fabrication</option>
                            </select>
                        </div>

                        {/* Product (Description) */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                Product <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                placeholder="Describe the product/material..."
                                rows={2}
                                className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-none"
                            />
                        </div>

                        {/* Qty + Unit Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                    Quantity <span className="text-red-400">*</span>
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
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                    Unit <span className="text-red-400">*</span>
                                </label>
                                <SearchableDropdown
                                    category="unit"
                                    value={form.unit_of_measurement}
                                    onChange={(val) => setForm(prev => ({ ...prev, unit_of_measurement: val }))}
                                    placeholder="Search or add unit..."
                                />
                            </div>
                        </div>

                        {/* Make + Raised By */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                    Make
                                </label>
                                <SearchableDropdown
                                    category="make"
                                    value={form.make}
                                    onChange={(val) => setForm(prev => ({ ...prev, make: val }))}
                                    placeholder="Search or add make..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                    Raised By
                                </label>
                                <input
                                    type="text"
                                    name="raised_by"
                                    value={form.raised_by}
                                    onChange={handleChange}
                                    placeholder="Your name"
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
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

                        {/* Project Specs Panel */}
                        {selectedProjectId && (
                            <div className="rounded-xl border border-surface-200 bg-surface-50 overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-surface-200 bg-surface-100/50 flex items-center gap-2">
                                    <ListChecks size={14} className="text-surface-500" />
                                    <span className="text-xs font-bold text-surface-600 uppercase tracking-wider">
                                        Project Specifications
                                    </span>
                                </div>
                                <div className="p-4">
                                    {specsLoading ? (
                                        <div className="text-xs text-surface-400 animate-pulse">Loading specs...</div>
                                    ) : specs.length === 0 ? (
                                        <div className="text-xs text-surface-400 italic">No specifications defined for this project</div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {specs.map((s, idx) => (
                                                <div key={s.id} className="flex items-start gap-2 text-xs text-surface-700">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-100 text-brand-600 text-[9px] font-bold shrink-0 mt-0.5">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="font-medium">{s.spec_detail}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

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
