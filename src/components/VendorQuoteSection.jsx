import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Plus, Trash2, Loader2, CheckCircle2, Trophy, Send } from 'lucide-react'

const emptyQuote = { vendor_name: '', product_name: '', price_quoted: '', gst_rc: '' }

export default function VendorQuoteSection({ onSuccess, selectedProjectId }) {
    const { user } = useAuth()
    const [indents, setIntents] = useState([])
    const [selectedIntent, setSelectedIntent] = useState('')
    const [quotes, setQuotes] = useState([{ ...emptyQuote }])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loadingIntents, setLoadingIntents] = useState(true)

    useEffect(() => { fetchIntents() }, [selectedProjectId])

    async function fetchIntents() {
        setLoadingIntents(true)
        let query = supabase
            .from('purchase_intent_headers')
            .select('id, dept, status, raised_by, created_at, purchase_intent_items(product_name, quantity, uom)')
            .order('created_at', { ascending: false })
        
        if (selectedProjectId) {
            query = query.eq('project_id', selectedProjectId)
        }

        const { data } = await query
        setIntents(data || [])
        setLoadingIntents(false)
    }

    function handleQuoteChange(index, field, value) {
        const updated = [...quotes]
        updated[index] = { ...updated[index], [field]: value }
        setQuotes(updated)
        setError('')
    }

    function addVendorRow() {
        setQuotes([...quotes, { ...emptyQuote }])
    }

    function removeVendorRow(index) {
        if (quotes.length <= 1) return
        setQuotes(quotes.filter((_, i) => i !== index))
        setError('')
    }

    function findLowestPriceIndex() {
        let minIdx = -1
        let minPrice = Infinity
        quotes.forEach((q, i) => {
            const p = parseFloat(q.price_quoted)
            if (!isNaN(p) && p > 0 && p < minPrice) {
                minPrice = p
                minIdx = i
            }
        })
        return minIdx
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        if (!selectedIntent) return setError('Please select a Purchase Indent')

        // Validate all quotes have at least a name and price
        for (let i = 0; i < quotes.length; i++) {
            const q = quotes[i]
            if (!q.vendor_name.trim()) return setError(`Vendor ${i + 1}: Name is required`)
            if (!q.price_quoted || parseFloat(q.price_quoted) <= 0)
                return setError(`Vendor ${i + 1}: Price must be greater than 0`)
        }

        setSubmitting(true)
        const bestIdx = findLowestPriceIndex()

        const rows = quotes.map((q, i) => ({
            intent_id: selectedIntent,
            vendor_name: q.vendor_name.trim(),
            product_name: q.product_name.trim() || null,
            price_quoted: parseFloat(q.price_quoted),
            gst_rc: q.gst_rc.trim() || null,
            is_best_price: i === bestIdx,
            project_id: selectedProjectId || null,
        }))

        const { error: insertError } = await supabase.from('vendor_quotes').insert(rows)

        if (insertError) {
            setError(insertError.message)
            setSubmitting(false)
            return
        }

        // Audit log
        const intentInfo = indents.find(i => i.id === selectedIntent)
        const vendorNames = quotes.map(q => q.vendor_name.trim()).filter(Boolean).join(', ')
        const firstItem = intentInfo?.purchase_intent_items?.[0]
        await supabase.from('activity_logs').insert({
            user_name: user?.email || 'Unknown',
            user_role: 'manager',
            action: `Added vendor quotes (${vendorNames}) for Indent [${intentInfo?.dept || '?'}] ${firstItem?.product_name || intentInfo?.id}`,
            entity_type: 'vendor_quote',
            entity_id: selectedIntent,
        })

        setSuccess(true)
        setTimeout(() => {
            setSuccess(false)
            setQuotes([{ ...emptyQuote }])
            setSelectedIntent('')
            setSubmitting(false)
            onSuccess?.()
        }, 1200)
    }

    const bestIdx = findLowestPriceIndex()
    const selectedIntentData = indents.find(i => i.id === selectedIntent)

    return (
        <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
            {/* Section Header */}
            <div className="px-6 py-4 border-b border-surface-200 bg-gradient-to-r from-amber-50 to-orange-50">
                <h3 className="text-sm font-bold text-surface-800 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/25">
                        <Trophy size={13} className="text-white" />
                    </div>
                    Add Vendor Quotes
                </h3>
                <p className="text-[11px] text-surface-700/50 mt-0.5 ml-9">
                    Add as many vendors as needed — best value auto-detected
                </p>
            </div>

            {/* Inline Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Select Intent */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                        Purchase Indent <span className="text-red-400">*</span>
                    </label>
                    <select
                        value={selectedIntent}
                        onChange={(e) => { setSelectedIntent(e.target.value); setError('') }}
                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all appearance-none cursor-pointer"
                        disabled={loadingIntents}
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: 'right 0.75rem center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1.25rem',
                        }}
                    >
                        <option value="">{loadingIntents ? 'Loading indents...' : indents.length === 0 ? 'No indents found' : 'Select an indent...'}</option>
                        {indents.map((intent) => {
                            const items = intent.purchase_intent_items || []
                            const firstItem = items[0]
                            const label = firstItem
                                ? `[${intent.dept || 'No Dept'}] ${firstItem.product_name}${items.length > 1 ? ` +${items.length - 1} more` : ''} — ${intent.status}`
                                : `[${intent.dept || 'No Dept'}] — ${intent.status}`
                            return (
                                <option key={intent.id} value={intent.id}>
                                    {label}
                                </option>
                            )
                        })}
                    </select>
                </div>

                {selectedIntentData && (
                    <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-xs text-surface-700 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-surface-800">{selectedIntentData.dept || 'Unknown Dept'}</span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{selectedIntentData.status}</span>
                            <span className="text-surface-400">• Raised by {selectedIntentData.raised_by || 'Unknown'}</span>
                        </div>
                        {(selectedIntentData.purchase_intent_items || []).map((item, i) => (
                            <div key={i} className="text-surface-600">
                                <span className="font-mono mr-1 text-surface-400">{i + 1}.</span>
                                <span className="font-medium">{item.product_name}</span>
                                <span className="text-surface-400 ml-1">({item.quantity} {item.uom})</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Dynamic Vendor Rows */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                            Vendors ({quotes.length})
                        </span>
                        <button
                            type="button"
                            onClick={addVendorRow}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all"
                        >
                            <Plus size={13} />
                            Add Vendor
                        </button>
                    </div>

                    {quotes.map((q, idx) => (
                        <div
                            key={idx}
                            className={`rounded-xl border-2 p-4 transition-all duration-300 ${bestIdx === idx && q.price_quoted
                                ? 'border-amber-300 bg-amber-50/50 shadow-md shadow-amber-200/30'
                                : 'border-surface-200 bg-surface-50/30'
                                }`}
                            style={{ animation: 'fadeSlideIn 0.25s ease-out' }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-surface-700/70 uppercase tracking-wider">
                                    Vendor {idx + 1}
                                </span>
                                <div className="flex items-center gap-2">
                                    {bestIdx === idx && q.price_quoted && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                            <Trophy size={10} />
                                            Best Value
                                        </span>
                                    )}
                                    {quotes.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeVendorRow(idx)}
                                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg text-red-500 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 transition-all"
                                            title="Remove this vendor"
                                        >
                                            <Trash2 size={12} />
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    placeholder="Vendor Name *"
                                    value={q.vendor_name}
                                    onChange={(e) => handleQuoteChange(idx, 'vendor_name', e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                />
                                <input
                                    type="text"
                                    placeholder="Product Name"
                                    value={q.product_name}
                                    onChange={(e) => handleQuoteChange(idx, 'product_name', e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                />
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">₹</span>
                                    <input
                                        type="number"
                                        placeholder="Price *"
                                        value={q.price_quoted}
                                        onChange={(e) => handleQuoteChange(idx, 'price_quoted', e.target.value)}
                                        min="0"
                                        step="0.01"
                                        className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="GST RC"
                                    value={q.gst_rc}
                                    onChange={(e) => handleQuoteChange(idx, 'gst_rc', e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono text-xs"
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
                        {error}
                    </div>
                )}

                {/* Success */}
                {success && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        Quotes saved successfully!
                    </div>
                )}

                {/* Submit */}
                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={() => { setQuotes([{ ...emptyQuote }]); setSelectedIntent(''); setError('') }}
                        className="px-5 py-2.5 text-sm font-medium rounded-xl text-surface-700 hover:bg-surface-100 transition-colors"
                    >
                        Clear All
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || success}
                        className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl text-white transition-all shadow-lg ${success
                            ? 'bg-emerald-500 shadow-emerald-500/25'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25 hover:shadow-amber-500/40'
                            } disabled:opacity-70 disabled:cursor-not-allowed`}
                    >
                        {submitting ? (
                            <><Loader2 size={15} className="animate-spin" /> Submitting...</>
                        ) : success ? (
                            <><CheckCircle2 size={15} /> Saved!</>
                        ) : (
                            <><Send size={15} /> Submit {quotes.length} Quote{quotes.length !== 1 ? 's' : ''}</>
                        )}
                    </button>
                </div>
            </form>

            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
