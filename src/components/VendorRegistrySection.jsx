import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Building2, Plus, Loader2, Search, CheckCircle2, AlertTriangle, Copy, X } from 'lucide-react'

function generateVendorId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = 'el_vendor_'
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return id
}

export default function VendorRegistrySection({ projectId }) {
    const { role } = useAuth()
    const [vendors, setVendors] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [copied, setCopied] = useState(null)

    // Form
    const [name, setName] = useState('')
    const [contactPerson, setContactPerson] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [address, setAddress] = useState('')
    const [gstNumber, setGstNumber] = useState('')

    useEffect(() => { fetchVendors() }, [])

    async function fetchVendors() {
        setLoading(true)
        const { data } = await supabase
            .from('vendors')
            .select('*')
            .order('created_at', { ascending: false })
        setVendors(data || [])
        setLoading(false)
    }

    async function handleCreate(e) {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (!name.trim()) return setError('Vendor name is required')

        setSubmitting(true)
        const vendorId = generateVendorId()

        const { error: insertErr } = await supabase
            .from('vendors')
            .insert({
                id: vendorId,
                name: name.trim(),
                contact_person: contactPerson.trim() || null,
                phone: phone.trim() || null,
                email: email.trim() || null,
                address: address.trim() || null,
                gst_number: gstNumber.trim() || null,
            })

        if (insertErr) {
            setError(`Failed: ${insertErr.message}`)
        } else {
            setSuccess(`Vendor registered: ${vendorId}`)
            setName('')
            setContactPerson('')
            setPhone('')
            setEmail('')
            setAddress('')
            setGstNumber('')
            setFormOpen(false)
            fetchVendors()
            setTimeout(() => setSuccess(''), 4000)
        }
        setSubmitting(false)
    }

    function copyId(id) {
        navigator.clipboard.writeText(id)
        setCopied(id)
        setTimeout(() => setCopied(null), 2000)
    }

    const filtered = vendors.filter(v =>
        [v.id, v.name, v.contact_person, v.email]
            .some(val => val?.toLowerCase().includes(search.toLowerCase()))
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                        <Building2 size={20} className="text-brand-500" />
                        Vendor Registry
                    </h3>
                    <p className="text-xs text-surface-400 mt-0.5">Registered vendors with unique IDs</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search vendors..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 w-full sm:w-56"
                        />
                    </div>
                    <button
                        onClick={() => setFormOpen(!formOpen)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/25 transition-all active:scale-95"
                    >
                        {formOpen ? <X size={15} /> : <Plus size={15} />}
                        {formOpen ? 'Cancel' : 'Register Vendor'}
                    </button>
                </div>
            </div>

            {/* Toasts */}
            {success && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold animate-in zoom-in-95">
                    <CheckCircle2 size={18} />
                    {success}
                </div>
            )}
            {error && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold animate-in zoom-in-95">
                    <AlertTriangle size={18} />
                    {error}
                </div>
            )}

            {/* Registration Form */}
            {formOpen && (
                <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-lg animate-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Vendor Name *</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Sri Muthu Traders" required
                                className="w-full bg-surface-50 border-none rounded-xl px-4 py-3 text-sm font-semibold text-surface-900 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Contact Person</label>
                            <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)}
                                placeholder="Contact name"
                                className="w-full bg-surface-50 border-none rounded-xl px-4 py-3 text-sm font-semibold text-surface-900 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Phone</label>
                            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                                placeholder="+91 98765 43210"
                                className="w-full bg-surface-50 border-none rounded-xl px-4 py-3 text-sm font-semibold text-surface-900 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Email</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                placeholder="vendor@email.com"
                                className="w-full bg-surface-50 border-none rounded-xl px-4 py-3 text-sm font-semibold text-surface-900 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Address</label>
                            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                                placeholder="Full address"
                                className="w-full bg-surface-50 border-none rounded-xl px-4 py-3 text-sm font-semibold text-surface-900 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">GST Number</label>
                            <input type="text" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)}
                                placeholder="e.g. 33AAACR5055K1Z0"
                                className="w-full bg-surface-50 border-none rounded-xl px-4 py-3 text-sm font-mono font-semibold text-surface-900 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all" />
                        </div>
                        <div className="md:col-span-2 flex justify-end pt-2">
                            <button type="submit" disabled={submitting}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50">
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                {submitting ? 'Registering...' : 'Register Vendor'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Vendor Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1,2,3].map(i => <div key={i} className="h-36 bg-surface-100 rounded-2xl animate-pulse" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-surface-200">
                    <Building2 size={36} className="mx-auto text-surface-200 mb-3" />
                    <p className="text-surface-500 font-semibold text-sm">No vendors registered</p>
                    <p className="text-xs text-surface-400 mt-1">Register a vendor to get started</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(v => (
                        <div key={v.id} className="bg-white rounded-2xl border border-surface-200 p-5 hover:shadow-lg hover:border-brand-200 transition-all group">
                            <div className="flex items-start justify-between mb-3">
                                <button
                                    onClick={() => copyId(v.id)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-50 border border-surface-200 text-[10px] font-mono font-bold text-surface-600 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-all"
                                    title="Click to copy"
                                >
                                    {v.id}
                                    {copied === v.id ? <CheckCircle2 size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                </button>
                            </div>
                            <h4 className="text-sm font-bold text-surface-900 mb-2 truncate group-hover:text-brand-600 transition-colors">{v.name}</h4>
                            <div className="space-y-1 text-xs text-surface-500">
                                {v.contact_person && <div>📋 {v.contact_person}</div>}
                                {v.phone && <div>📞 {v.phone}</div>}
                                {v.email && <div>✉️ {v.email}</div>}
                                {v.gst_number && <div className="font-mono text-[10px] text-surface-400">GST: {v.gst_number}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
