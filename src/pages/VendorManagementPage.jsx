import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Users, Search, RefreshCw, Plus, Loader2, Pencil, Check, X, Phone, Mail, MapPin, Hash, Trash2, Landmark } from 'lucide-react'

const emptyForm = { name: '', contact_person: '', phone: '', email: '', address: '', gst_number: '', landline_number: '' }

function generateVendorId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = 'el_vendor_'
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return id
}

export default function VendorManagementPage() {
    const [vendors, setVendors] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [form, setForm] = useState({ ...emptyForm })
    const [submitting, setSubmitting] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({ ...emptyForm })
    const [savingId, setSavingId] = useState(null)
    
    // Delete state
    const [deletingId, setDeletingId] = useState(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    useEffect(() => { fetchVendors() }, [])

    async function fetchVendors() {
        setLoading(true)
        const { data, error } = await supabase.from('vendors').select('*').order('name')
        if (!error) setVendors(data || [])
        setLoading(false)
    }

    const filtered = vendors.filter(v =>
        [v.name, v.contact_person, v.phone, v.email, v.address, v.gst_number]
            .some(f => f?.toLowerCase().includes(search.toLowerCase()))
    )

    async function handleAdd(e) {
        e.preventDefault()
        if (!form.name.trim()) return
        setSubmitting(true)
        const vendorId = generateVendorId()
        const { error } = await supabase.from('vendors').insert({
            id: vendorId,
            name: form.name.trim(),
            contact_person: form.contact_person.trim() || null,
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            address: form.address.trim() || null,
            gst_number: form.gst_number.trim() || null,
            landline_number: form.landline_number.trim() || null,
        })
        if (error) {
            alert(`Failed to add vendor: ${error.message}`)
        } else {
            setForm({ ...emptyForm })
            setFormOpen(false)
            fetchVendors()
        }
        setSubmitting(false)
    }

    function startEdit(v) {
        setEditingId(v.id)
        setEditForm({
            name: v.name || '',
            contact_person: v.contact_person || '',
            phone: v.phone || '',
            email: v.email || '',
            address: v.address || '',
            gst_number: v.gst_number || '',
            landline_number: v.landline_number || '',
        })
    }

    async function saveEdit(id) {
        setSavingId(id)
        await supabase.from('vendors').update({
            name: editForm.name.trim(),
            contact_person: editForm.contact_person.trim() || null,
            phone: editForm.phone.trim() || null,
            email: editForm.email.trim() || null,
            address: editForm.address.trim() || null,
            gst_number: editForm.gst_number.trim() || null,
            landline_number: editForm.landline_number.trim() || null,
        }).eq('id', id)
        setEditingId(null)
        setSavingId(null)
        fetchVendors()
    }

    async function deleteVendor(vendor) {
        if (confirmDeleteId !== vendor.id) {
            setConfirmDeleteId(vendor.id)
            setTimeout(() => setConfirmDeleteId(prev => (prev === vendor.id ? null : prev)), 4000)
            return
        }
        setConfirmDeleteId(null)
        setDeletingId(vendor.id)

        const { error } = await supabase.from('vendors').delete().eq('id', vendor.id)
        if (error) {
            console.error('Delete failed:', error)
            alert(`Failed to delete vendor: ${error.message}`)
            setDeletingId(null)
            return
        }

        setVendors(prev => prev.filter(v => v.id !== vendor.id))
        setDeletingId(null)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <Users size={22} className="text-brand-500" />
                        Vendor Management
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">Contact directory & vendor registry</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search vendors..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all w-full sm:w-56"
                        />
                    </div>
                    <button onClick={fetchVendors} className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 transition-colors">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setFormOpen(v => !v)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/25 transition-all"
                    >
                        <Plus size={15} /> Add Vendor
                    </button>
                </div>
            </div>

            {/* Add Vendor Form */}
            {formOpen && (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 animate-in fade-in duration-200">
                    <h3 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-brand-100 flex items-center justify-center">
                            <Plus size={13} className="text-brand-600" />
                        </div>
                        Register New Vendor
                    </h3>
                    <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
                        {[
                            { key: 'name', label: 'Company Name', required: true, icon: null },
                            { key: 'contact_person', label: 'Contact Person', icon: null },
                            { key: 'phone', label: 'Phone Number', icon: null },
                            { key: 'landline_number', label: 'Landline Number', icon: null },
                            { key: 'email', label: 'Email', type: 'email', icon: null },
                            { key: 'gst_number', label: 'GST Number', icon: null },
                            { key: 'address', label: 'Address', icon: null, colSpan: true },
                        ].map(f => (
                            <div key={f.key} className={f.colSpan ? 'col-span-2' : ''}>
                                <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                                    {f.label} {f.required && <span className="text-red-400">*</span>}
                                </label>
                                <input
                                    type={f.type || 'text'}
                                    value={form[f.key]}
                                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    required={f.required}
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                    placeholder={f.label}
                                />
                            </div>
                        ))}
                        <div className="col-span-2 flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-surface-700 rounded-xl border border-surface-200 hover:bg-surface-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={submitting} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl text-white bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60">
                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Submit
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Vendor Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-44 bg-surface-100 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-16 text-center">
                    <Users size={36} className="mx-auto text-surface-200 mb-3" />
                    <p className="text-surface-400 font-medium">No vendors found</p>
                    <p className="text-xs text-surface-300 mt-1">Add vendors using the button above</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(v => (
                        <div key={v.id} className="bg-white rounded-2xl border border-surface-200 p-5 shadow-sm hover:shadow-md hover:border-brand-200 transition-all group">
                            {editingId === v.id ? (
                                /* Inline edit form */
                                <div className="space-y-3">
                                    {[
                                        { key: 'name', label: 'Company Name' },
                                        { key: 'contact_person', label: 'Contact Person' },
                                        { key: 'phone', label: 'Phone Number' },
                                        { key: 'landline_number', label: 'Landline Number' },
                                        { key: 'email', label: 'Email' },
                                        { key: 'gst_number', label: 'GST Number' },
                                        { key: 'address', label: 'Address' },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">{f.label}</label>
                                            <input
                                                value={editForm[f.key]}
                                                onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                                                className="w-full mt-1 px-3 py-1.5 text-sm rounded-lg border border-surface-200 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                                            />
                                        </div>
                                    ))}
                                    <div className="flex gap-2 justify-end pt-1">
                                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 transition-colors">
                                            <X size={14} className="text-surface-600" />
                                        </button>
                                        <button onClick={() => saveEdit(v.id)} disabled={savingId === v.id} className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 transition-colors">
                                            {savingId === v.id ? <Loader2 size={14} className="animate-spin text-white" /> : <Check size={14} className="text-white" />}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* View mode */
                                <>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 font-bold text-sm shrink-0">
                                                {v.name?.[0]?.toUpperCase() || 'V'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-surface-900 text-sm leading-snug">{v.name}</p>
                                                {v.contact_person && <p className="text-xs text-surface-500">{v.contact_person}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => startEdit(v)}
                                                className="p-1.5 rounded-lg hover:bg-brand-50 text-surface-400 hover:text-brand-600 transition-colors"
                                                title="Edit Vendor"
                                            >
                                                <Pencil size={13} />
                                            </button>
                                            {confirmDeleteId === v.id ? (
                                                <button
                                                    onClick={() => deleteVendor(v)}
                                                    disabled={deletingId === v.id}
                                                    className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold shadow-sm transition-all disabled:opacity-40 animate-pulse"
                                                    title="Click again to confirm delete"
                                                >
                                                    {deletingId === v.id ? <Loader2 size={11} className="animate-spin" /> : 'Confirm?'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => deleteVendor(v)}
                                                    className="p-1.5 rounded-lg hover:bg-red-100 text-surface-400 hover:text-red-600 transition-colors"
                                                    title="Delete Vendor"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {v.phone && (
                                            <div className="flex items-center gap-2 text-xs text-surface-600">
                                                <Phone size={11} className="text-surface-400 shrink-0" />
                                                <span>{v.phone}</span>
                                            </div>
                                        )}
                                        {v.landline_number && (
                                            <div className="flex items-center gap-2 text-xs text-surface-600">
                                                <Landmark size={11} className="text-surface-400 shrink-0" />
                                                <span>{v.landline_number}</span>
                                            </div>
                                        )}
                                        {v.email && (
                                            <div className="flex items-center gap-2 text-xs text-surface-600">
                                                <Mail size={11} className="text-surface-400 shrink-0" />
                                                <span className="truncate">{v.email}</span>
                                            </div>
                                        )}
                                        {v.address && (
                                            <div className="flex items-start gap-2 text-xs text-surface-600">
                                                <MapPin size={11} className="text-surface-400 shrink-0 mt-0.5" />
                                                <span className="line-clamp-2">{v.address}</span>
                                            </div>
                                        )}
                                        {v.gst_number && (
                                            <div className="flex items-center gap-2 text-xs text-surface-600">
                                                <Hash size={11} className="text-surface-400 shrink-0" />
                                                <span className="font-mono text-[11px]">{v.gst_number}</span>
                                            </div>
                                        )}
                                    </div>

                                    {v.vendor_unique_id && (
                                        <div className="mt-3 pt-3 border-t border-surface-100">
                                            <span className="text-[10px] font-mono text-surface-400">{v.vendor_unique_id}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
