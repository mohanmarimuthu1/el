import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { X, Plus, Loader2, CheckCircle2, ListChecks, Warehouse, Briefcase, Trash2, Search, Palette } from 'lucide-react'
import SearchableDropdown from '@/components/SearchableDropdown'

const BLANK_PRODUCT = () => ({
    key: crypto.randomUUID(),
    description: '',
    quantity_required: '',
    unit_of_measurement: '',
    make: '',
    model_number: '',
})

export default function CreateIntentModal({ open, onClose, onSuccess, selectedProjectId }) {
    const { user } = useAuth()

    // Mode: 'project_intent' | 'general_stock'
    const [indentType, setIndentType] = useState(selectedProjectId ? 'project_intent' : 'general_stock')

    // Shared fields
    const [department, setDepartment] = useState('Electrical')
    const [raisedBy, setRaisedBy] = useState('')
    const [projectId, setProjectId] = useState(selectedProjectId || '')
    const [projects, setProjects] = useState([])

    // Product rows (for project indent bulk-add)
    const [products, setProducts] = useState([BLANK_PRODUCT()])

    // General stock uses a single flat form
    const [generalForm, setGeneralForm] = useState({
        department: '',
        description: '',
        quantity_required: '',
        unit_of_measurement: '',
        make: '',
        model_number: '',
        raised_by: '',
    })

    // Inventory suggestions (for project indent)
    const [inventorySuggestions, setInventorySuggestions] = useState([])

    // Project specs & designs
    const [specs, setSpecs] = useState([])
    const [specsLoading, setSpecsLoading] = useState(false)
    const [designs, setDesigns] = useState([])
    const [designsLoading, setDesignsLoading] = useState(false)

    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (open) {
            setIndentType(selectedProjectId ? 'project_intent' : 'general_stock')
            setDepartment('Electrical')
            setRaisedBy(user?.user_metadata?.full_name || user?.email || '')
            setProducts([BLANK_PRODUCT()])
            setGeneralForm({
                department: '',
                description: '',
                quantity_required: '',
                unit_of_measurement: '',
                make: '',
                make: '',
                raised_by: user?.user_metadata?.full_name || user?.email || '',
            })
            setError('')
            setSuccess(false)

            if (selectedProjectId) {
                setProjectId(selectedProjectId)
                fetchSpecs()
                fetchDesigns()
                fetchInventorySuggestions()
            } else {
                setProjectId('')
                fetchProjects()
                fetchInventorySuggestions()
            }
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

    async function fetchDesigns() {
        if (!selectedProjectId) return
        setDesignsLoading(true)
        const { data } = await supabase
            .from('project_designs')
            .select('*')
            .eq('project_id', selectedProjectId)
            .is('file_url', null)
            .order('created_at', { ascending: true })
        setDesigns(data || [])
        setDesignsLoading(false)
    }

    async function fetchInventorySuggestions() {
        const { data } = await supabase
            .from('inventory')
            .select('id, product_name, manufacturer, quantity, uom')
            .order('product_name', { ascending: true })
            .limit(200)
        setInventorySuggestions(data || [])
    }

    async function fetchProjects() {
        const { data } = await supabase
            .from('projects_metadata')
            .select('id, name')
            .order('name')
        setProjects(data || [])
    }

    if (!open) return null

    // ─── Product row helpers ───
    function updateProduct(key, field, value) {
        setProducts(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p))
        setError('')
    }

    function addProductRow() {
        setProducts(prev => [...prev, BLANK_PRODUCT()])
    }

    function removeProductRow(key) {
        setProducts(prev => prev.filter(p => p.key !== key))
    }

    function applyInventorySuggestion(key, suggestion) {
        setProducts(prev => prev.map(p =>
            p.key === key ? {
                ...p,
                description: suggestion.product_name || suggestion.manufacturer || '',
                unit_of_measurement: suggestion.uom || '',
                make: suggestion.manufacturer || '',
                model_number: suggestion.model_number || '',
            } : p
        ))
    }

    // ─── Submit ───
    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        if (indentType === 'project_intent') {
            if (!projectId) return setError('Please select a project')
            // Validate all rows
            for (const p of products) {
                if (!p.description.trim()) return setError('Product description is required for all rows')
                if (!p.quantity_required || Number(p.quantity_required) < 1) return setError('Quantity must be ≥ 1 for all rows')
                if (!p.unit_of_measurement) return setError('Unit is required for all rows')
            }
            setSubmitting(true)

            // Insert ONE header
            const { data: headerData, error: headerError } = await supabase.from('purchase_intent_headers').insert({
                project_id: projectId,
                intent_type: 'Project Stock',
                raised_by: raisedBy.trim() || null,
                dept: department,
                status: 'Requested'
            }).select('id').single()

            if (headerError) { setError(headerError.message); setSubmitting(false); return }

            const headerId = headerData.id

            const inserts = products.map(p => ({
                header_id: headerId,
                product_name: p.description.trim(),
                quantity: Number(p.quantity_required),
                uom: p.unit_of_measurement,
                make: p.make || null,
                model_number: p.model_number || null
            }))

            const { error: itemsError } = await supabase.from('purchase_intent_items').insert(inserts)
            if (itemsError) { setError(itemsError.message); setSubmitting(false); return }
        } else {
            // General stock
            if (!generalForm.department) return setError('Department is required')
            if (!generalForm.description.trim()) return setError('Product description is required')
            if (!generalForm.quantity_required || Number(generalForm.quantity_required) < 1)
                return setError('Quantity must be at least 1')
            if (!generalForm.unit_of_measurement) return setError('Unit is required')

            setSubmitting(true)

            const { data: headerData, error: headerError } = await supabase.from('purchase_intent_headers').insert({
                project_id: null,
                intent_type: 'General Stock',
                raised_by: generalForm.raised_by.trim() || null,
                dept: generalForm.department,
                status: 'Requested'
            }).select('id').single()

            if (headerError) { setError(headerError.message); setSubmitting(false); return }

            const headerId = headerData.id

            const { error: itemsError } = await supabase.from('purchase_intent_items').insert({
                header_id: headerId,
                product_name: generalForm.description.trim(),
                quantity: Number(generalForm.quantity_required),
                uom: generalForm.unit_of_measurement,
                make: generalForm.make || null,
                model_number: generalForm.model_number || null
            })
            if (itemsError) { setError(itemsError.message); setSubmitting(false); return }
        }

        setSuccess(true)
        setTimeout(() => {
            setSuccess(false)
            setSubmitting(false)
            onSuccess?.()
            onClose()
        }, 1200)
    }

    return (
        <>
            <div className="fixed inset-0 z-50 bg-surface-900/30 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="w-full max-w-2xl bg-white rounded-2xl border border-surface-200 shadow-2xl shadow-surface-900/15 max-h-[92vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                    style={{ animation: 'slideUp 0.3s ease-out' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 sticky top-0 bg-white z-10">
                        <div>
                            <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/25">
                                    <Plus size={16} className="text-white" />
                                </div>
                                New Purchase Indent
                            </h3>
                            <p className="text-xs text-surface-700/50 mt-0.5 ml-10">Raise a material procurement request</p>
                        </div>
                        <button onClick={onClose} className="rounded-lg p-2 hover:bg-surface-100 text-surface-700/60 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* ── Intent Type Selector ── */}
                        {!selectedProjectId && (
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIndentType('project_intent')}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${indentType === 'project_intent'
                                            ? 'border-brand-400 bg-brand-50 text-brand-700'
                                            : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'
                                        }`}
                                >
                                    <Briefcase size={18} className={indentType === 'project_intent' ? 'text-brand-500' : 'text-surface-400'} />
                                    <div>
                                        <p className="text-sm font-bold">Project Stock</p>
                                        <p className="text-[10px] mt-0.5 opacity-70">Linked to a project</p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIntentType('general_stock')}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${indentType === 'general_stock'
                                            ? 'border-amber-400 bg-amber-50 text-amber-700'
                                            : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'
                                        }`}
                                >
                                    <Warehouse size={18} className={indentType === 'general_stock' ? 'text-amber-500' : 'text-surface-400'} />
                                    <div>
                                        <p className="text-sm font-bold">General Stock</p>
                                        <p className="text-[10px] mt-0.5 opacity-70">Warehouse replenishment</p>
                                    </div>
                                </button>
                            </div>
                        )}

                        {/* ── PROJECT INTENT MODE ── */}
                        {indentType === 'project_intent' && (
                            <>
                                {/* Project Selector (if not in project context) */}
                                {!selectedProjectId && (
                                    <div className="space-y-1.5 p-4 rounded-xl bg-brand-50 border-2 border-brand-200">
                                        <label className="block text-xs font-bold text-brand-700 uppercase tracking-wider flex items-center justify-between">
                                            <span>Target Project <span className="text-red-500">*</span></span>
                                            <span className="text-[9px] bg-brand-200 px-1.5 py-0.5 rounded text-brand-700">MANDATORY</span>
                                        </label>
                                        <select
                                            value={projectId}
                                            onChange={e => setProjectId(e.target.value)}
                                            className="w-full px-4 py-2.5 text-sm font-bold rounded-xl border border-brand-300 bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all cursor-pointer text-brand-900"
                                        >
                                            <option value="">Select a Project...</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Department (fixed) + Raised By */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">Department</label>
                                        <SearchableDropdown
                                            category="department"
                                            value={department}
                                            onChange={val => setDepartment(val)}
                                            placeholder="Select department..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">Raised By</label>
                                        <select
                                            value={raisedBy}
                                            onChange={e => setRaisedBy(e.target.value)}
                                            className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all cursor-pointer"
                                        >
                                            <option value="">Select Name...</option>
                                            <option value="MR.Sarath">MR.Sarath</option>
                                            <option value="MR.Gopi">MR.Gopi</option>
                                            <option value="MR.Parthiban">MR.Parthiban</option>
                                            <option value="MR.Bhuvanesh">MR.Bhuvanesh</option>
                                        </select>
                                    </div>
                                </div>


                                {/* Product rows — only shown once project is selected (or inside project context) */}
                                {(selectedProjectId || projectId) ? (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-xs font-bold text-surface-700/70 uppercase tracking-wider">Design Input List</label>
                                            <span className="text-[10px] text-surface-400">{products.length} item{products.length !== 1 ? 's' : ''}</span>
                                        </div>

                                        <div className="space-y-3">
                                            {products.map((product, idx) => (
                                                <ProductRow
                                                    key={product.key}
                                                    product={product}
                                                    index={idx}
                                                    suggestions={inventorySuggestions}
                                                    onChange={(field, val) => updateProduct(product.key, field, val)}
                                                    onSuggestion={(s) => applyInventorySuggestion(product.key, s)}
                                                    onRemove={products.length > 1 ? () => removeProductRow(product.key) : null}
                                                />
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addProductRow}
                                            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-brand-300 text-brand-600 text-sm font-semibold hover:bg-brand-50 hover:border-brand-400 transition-all"
                                        >
                                            <Plus size={15} /> Add Another Product
                                        </button>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-center">
                                        <p className="text-sm font-semibold text-amber-700">Select a project first</p>
                                        <p className="text-xs text-amber-600 mt-1">You must choose a target project before adding items.</p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── GENERAL STOCK MODE ── */}
                        {indentType === 'general_stock' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                        Department <span className="text-red-400">*</span>
                                    </label>
                                    <SearchableDropdown
                                        category="department"
                                        value={generalForm.department}
                                        onChange={val => setGeneralForm(p => ({ ...p, department: val }))}
                                        placeholder="Select department..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                        Product Name <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        value={generalForm.description}
                                        onChange={e => setGeneralForm(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Describe the product/material..."
                                        rows={2}
                                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                            Qty <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={generalForm.quantity_required}
                                            onChange={e => setGeneralForm(p => ({ ...p, quantity_required: e.target.value }))}
                                            placeholder="0"
                                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5 col-span-2">
                                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                            Unit <span className="text-red-400">*</span>
                                        </label>
                                        <SearchableDropdown
                                            category="unit"
                                            value={generalForm.unit_of_measurement}
                                            onChange={val => setGeneralForm(p => ({ ...p, unit_of_measurement: val }))}
                                            placeholder="Unit..."
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">Make</label>
                                        <SearchableDropdown
                                            category="make"
                                            value={generalForm.make}
                                            onChange={val => setGeneralForm(p => ({ ...p, make: val }))}
                                            placeholder="Search or add make..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">Model No.</label>
                                        <SearchableDropdown
                                            category="model_number"
                                            value={generalForm.model_number}
                                            onChange={val => setGeneralForm(p => ({ ...p, model_number: val }))}
                                            placeholder="Search or add model..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">Raised By <span className="text-red-400">*</span></label>
                                        <select
                                            value={generalForm.raised_by}
                                            onChange={e => setGeneralForm(p => ({ ...p, raised_by: e.target.value }))}
                                            className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all cursor-pointer"
                                        >
                                            <option value="">Select Name...</option>
                                            <option value="MR.Sarath">MR.Sarath</option>
                                            <option value="MR.Gopi">MR.Gopi</option>
                                            <option value="MR.Parthiban">MR.Parthiban</option>
                                            <option value="MR.Bhuvanesh">MR.Bhuvanesh</option>
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Project Specs Footer */}
                        {selectedProjectId && (
                            <div className="rounded-xl border border-surface-200 bg-surface-50 overflow-hidden mt-2">
                                <div className="px-4 py-2.5 border-b border-surface-200 bg-surface-100/50 flex items-center gap-2">
                                    <ListChecks size={14} className="text-surface-500" />
                                    <span className="text-xs font-bold text-surface-600 uppercase tracking-wider">Project Specifications</span>
                                </div>
                                <div className="p-4">
                                    {specsLoading ? (
                                        <div className="text-xs text-surface-400 animate-pulse">Loading specs...</div>
                                    ) : specs.length === 0 ? (
                                        <div className="text-xs text-surface-400 italic">No specifications defined for this project</div>
                                    ) : (
                                        <div className="space-y-1.5 flex flex-wrap gap-x-4">
                                            {specs.map((s, idx) => (
                                                <div key={s.id} className="flex items-start gap-2 text-xs text-surface-700">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-100 text-brand-600 text-[9px] font-bold shrink-0">{idx + 1}</span>
                                                    <span className="font-medium">{s.spec_detail}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Project Designs Footer */}
                        {selectedProjectId && (
                            <div className="rounded-xl border border-surface-200 bg-surface-50 overflow-hidden mt-3">
                                <div className="px-4 py-2.5 border-b border-surface-200 bg-surface-100/50 flex items-center gap-2">
                                    <Palette size={14} className="text-violet-500" />
                                    <span className="text-xs font-bold text-surface-600 uppercase tracking-wider">Design Inputs</span>
                                </div>
                                <div className="p-4">
                                    {designsLoading ? (
                                        <div className="text-xs text-surface-400 animate-pulse">Loading design inputs...</div>
                                    ) : designs.length === 0 ? (
                                        <div className="text-xs text-surface-400 italic">No design inputs defined for this project</div>
                                    ) : (
                                        <div className="flex flex-col gap-1.5">
                                            {designs.map((d, idx) => (
                                                <div key={d.id} className="flex items-center gap-2 text-xs text-surface-700">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-100 text-violet-600 text-[9px] font-bold shrink-0">{idx + 1}</span>
                                                    <span className="font-medium">{d.description || d.design_name}</span>
                                                    {d.size && <span className="text-surface-500 font-mono ml-2 border border-surface-200 px-1.5 py-0.5 rounded uppercase">{d.size}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Auto-capture info */}
                        <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100">
                                <CheckCircle2 size={14} className="text-brand-600" />
                            </div>
                            <div className="text-xs text-brand-700">
                                <span className="font-semibold">Auto-captured:</span> Timestamp, User ID and Intent Type will be recorded on submission.
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">{error}</div>
                        )}

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
                                        : indentType === 'general_stock'
                                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/25'
                                            : 'bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-brand-500/25'
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

// ─── Per-product row for bulk indent creation ───
function ProductRow({ product, index, suggestions, onChange, onSuggestion, onRemove }) {
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [filteredSuggestions, setFilteredSuggestions] = useState([])
    const sugRef = useRef(null)

    useEffect(() => {
        function handleClick(e) {
            if (sugRef.current && !sugRef.current.contains(e.target)) setShowSuggestions(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    function handleDescriptionChange(val) {
        onChange('description', val)
        if (val.trim().length > 1) {
            const lower = val.toLowerCase()
            const filtered = suggestions.filter(s =>
                s.product_name?.toLowerCase().includes(lower) ||
                s.manufacturer?.toLowerCase().includes(lower) ||
                s.model_number?.toLowerCase().includes(lower)
            ).slice(0, 6)
            setFilteredSuggestions(filtered)
            setShowSuggestions(filtered.length > 0)
        } else {
            setShowSuggestions(false)
        }
    }

    return (
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-100 text-brand-600 text-[10px] font-bold">{index + 1}</span>
                {onRemove && (
                    <button type="button" onClick={onRemove} className="p-1 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                    </button>
                )}
            </div>

            {/* Description with inventory suggestions */}
            <div className="relative" ref={sugRef}>
                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                    Product Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300 pointer-events-none" />
                    <input
                        type="text"
                        value={product.description}
                        onChange={e => handleDescriptionChange(e.target.value)}
                        onFocus={() => product.description.trim().length > 1 && setShowSuggestions(filteredSuggestions.length > 0)}
                        placeholder="Type to search inventory or describe product..."
                        className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                    />
                </div>
                {showSuggestions && (
                    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-surface-200 shadow-xl overflow-hidden">
                        <div className="px-3 py-1.5 bg-surface-50 border-b border-surface-100">
                            <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">From Inventory</p>
                        </div>
                        {filteredSuggestions.map(s => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => { onSuggestion(s); setShowSuggestions(false) }}
                                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-brand-50 transition-colors text-left"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-surface-800">{s.product_name || s.manufacturer}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.quantity > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                        {s.quantity} {s.uom}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Qty + Unit + Make + Model */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Qty <span className="text-red-400">*</span></label>
                    <input
                        type="number"
                        min="1"
                        value={product.quantity_required}
                        onChange={e => onChange('quantity_required', e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Unit <span className="text-red-400">*</span></label>
                    <SearchableDropdown
                        category="unit"
                        value={product.unit_of_measurement}
                        onChange={val => onChange('unit_of_measurement', val)}
                        placeholder="Unit..."
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Make</label>
                    <SearchableDropdown
                        category="manufacturer"
                        value={product.make}
                        onChange={val => onChange('make', val)}
                        placeholder="Make..."
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Model No.</label>
                    <SearchableDropdown
                        category="model_number"
                        value={product.model_number || ''}
                        onChange={val => onChange('model_number', val)}
                        placeholder="Model..."
                    />
                </div>
            </div>
        </div>
    )
}
