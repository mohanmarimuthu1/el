import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { formatTimestamp } from '@/lib/formatTime'
import { Building2, Search, RefreshCw, Plus, Edit2, Trash2, AlertCircle, Clock, ArrowLeft, FileText, Upload, ExternalLink, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function CompanyPaymentsPage() {
    const [payments, setPayments] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [editingId, setEditingId] = useState(null)

    // Form state
    const [companyName, setCompanyName] = useState('')
    const [pendingAmount, setPendingAmount] = useState('')
    const [status, setStatus] = useState('unpaid')
    const [priority, setPriority] = useState('later')
    const [bankStatementUrl, setBankStatementUrl] = useState('')
    const [expectedDate, setExpectedDate] = useState('')
    const [address, setAddress] = useState('')
    const [gstNumber, setGstNumber] = useState('')
    const [contactName, setContactName] = useState('')
    const [contactNumber, setContactNumber] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedFile, setSelectedFile] = useState(null)

    useEffect(() => {
        fetchPayments()
    }, [])

    async function fetchPayments() {
        setLoading(true)
        const { data, error } = await supabase
            .from('company_payments')
            .select('*')
            .order('priority', { ascending: true }) // immediate first (assuming alphabetically 'immediate' < 'later' isn't helpful, but let's just order by name or date)
            .order('created_at', { ascending: false })
        
        if (!error && data) setPayments(data)
        setLoading(false)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSubmitting(true)

        let finalUrl = bankStatementUrl

        // If a new file is selected, upload it first
        if (selectedFile) {
            setUploading(true)
            const fileExt = selectedFile.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
            const filePath = `statements/${fileName}`

            const { data, error: uploadError } = await supabase.storage
                .from('bank-statements')
                .upload(filePath, selectedFile)

            if (uploadError) {
                console.error('Upload error:', uploadError)
                alert('File upload failed. Please try again.')
                setUploading(false)
                setSubmitting(false)
                return
            }

            const { data: { publicUrl } } = supabase.storage
                .from('bank-statements')
                .getPublicUrl(filePath)
            
            finalUrl = publicUrl
            setUploading(false)
        }

        const payload = {
            company_name: companyName,
            pending_amount: parseFloat(pendingAmount),
            status,
            priority,
            bank_statement_url: finalUrl,
            expected_date: expectedDate || null,
            address,
            gst_number: gstNumber,
            contact_name: contactName,
            contact_number: contactNumber
        }

        let error;
        if (editingId) {
            const { error: updateError } = await supabase
                .from('company_payments')
                .update(payload)
                .eq('id', editingId)
            error = updateError
        } else {
            const { error: insertError } = await supabase
                .from('company_payments')
                .insert(payload)
            error = insertError
        }

        if (!error) {
            resetForm()
            fetchPayments()
        }
        setSubmitting(false)
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this record?')) return
        const { error } = await supabase
            .from('company_payments')
            .delete()
            .eq('id', id)
        if (!error) fetchPayments()
    }

    function resetForm() {
        setCompanyName('')
        setPendingAmount('')
        setStatus('unpaid')
        setPriority('later')
        setBankStatementUrl('')
        setExpectedDate('')
        setAddress('')
        setGstNumber('')
        setContactName('')
        setContactNumber('')
        setSelectedFile(null)
        setEditingId(null)
        setModalOpen(false)
    }

    function handleEdit(item) {
        setEditingId(item.id)
        setCompanyName(item.company_name)
        setPendingAmount(item.pending_amount)
        setStatus(item.status)
        setPriority(item.priority)
        setBankStatementUrl(item.bank_statement_url || '')
        setExpectedDate(item.expected_date || '')
        setAddress(item.address || '')
        setGstNumber(item.gst_number || '')
        setContactName(item.contact_name || '')
        setContactNumber(item.contact_number || '')
        setSelectedFile(null)
        setModalOpen(true)
    }

    function calculateDaysPending(createdAt) {
        if (!createdAt) return 0
        const start = new Date(createdAt)
        const end = new Date()
        const diffTime = Math.abs(end - start)
        return Math.floor(diffTime / (1000 * 60 * 60 * 24))
    }

    const filtered = payments.filter(row => {
        const matchesSearch = row.company_name?.toLowerCase().includes(search.toLowerCase()) ||
            row.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
            row.gst_number?.toLowerCase().includes(search.toLowerCase())
        
        const matchesStatus = statusFilter === 'all' ? true : row.status === statusFilter
        
        return matchesSearch && matchesStatus
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link 
                        to="/" 
                        className="p-2.5 rounded-xl border border-surface-200 bg-white text-surface-500 hover:text-brand-500 hover:border-brand-200 hover:shadow-lg transition-all active:scale-95 group"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                            <Building2 size={24} className="text-brand-500" />
                            Company Payments
                        </h2>
                        <p className="text-sm text-surface-700/60 mt-0.5">Manage outstanding balances and payment priorities</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search companies..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all w-full sm:w-64"
                        />
                    </div>
                    <div className="flex bg-surface-100 p-1 rounded-xl">
                        {['all', 'unpaid', 'paid'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setStatusFilter(f)}
                                className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                                    statusFilter === f 
                                    ? 'bg-white text-brand-600 shadow-sm' 
                                    : 'text-surface-500 hover:text-surface-700'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchPayments}
                        className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => { resetForm(); setModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 active:scale-95"
                    >
                        <Plus size={16} />
                        Add Company
                    </button>
                </div>
            </div>

            {/* Stats Overview (Optional but premium) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-surface-200 bg-white shadow-sm">
                    <div className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-1">Total Outstanding</div>
                    <div className="text-2xl font-bold text-surface-900 font-mono">
                        ₹{payments.filter(p => p.status === 'unpaid').reduce((sum, p) => sum + parseFloat(p.pending_amount), 0).toLocaleString('en-IN')}
                    </div>
                </div>
                <div className="p-4 rounded-2xl border border-surface-200 bg-brand-50 shadow-sm border-brand-100">
                    <div className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1">Immediate Priority</div>
                    <div className="text-2xl font-bold text-brand-900 font-mono">
                        {payments.filter(p => p.status === 'unpaid' && p.priority === 'immediate').length} Companies
                    </div>
                </div>
                <div className="p-4 rounded-2xl border border-surface-200 bg-emerald-50 shadow-sm border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Paid (This Month)</div>
                    <div className="text-2xl font-bold text-emerald-900 font-mono">
                        ₹{payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + parseFloat(p.pending_amount), 0).toLocaleString('en-IN')}
                    </div>
                </div>
            </div>

            {/* Payments Table */}
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-surface-200 bg-surface-50/80">
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider">Company Name</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider">Pending Amount</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Status</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Priority</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Statement</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Expected Date</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Duration</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider">Created</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-5 py-4"><div className="h-4 bg-surface-100 rounded w-32" /></td>
                                        <td className="px-5 py-4"><div className="h-4 bg-surface-100 rounded w-20" /></td>
                                        <td className="px-5 py-4"><div className="h-6 bg-surface-100 rounded-full w-16 mx-auto" /></td>
                                        <td className="px-5 py-4"><div className="h-6 bg-surface-100 rounded-full w-20 mx-auto" /></td>
                                        <td className="px-5 py-4"><div className="h-4 bg-surface-100 rounded w-32" /></td>
                                        <td className="px-5 py-4"><div className="h-8 bg-surface-100 rounded w-16 ml-auto" /></td>
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-5 py-12 text-center text-surface-400">
                                        <Building2 size={40} className="mx-auto mb-3 opacity-20" />
                                        <p className="text-sm font-medium">No company records found</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => (
                                    <tr key={item.id} className="hover:bg-brand-50/30 transition-colors group">
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-surface-900">{item.company_name}</div>
                                            {item.contact_name && (
                                                <div className="text-[10px] text-surface-400 flex items-center gap-1 mt-0.5">
                                                    <Users size={10} /> {item.contact_name} {item.contact_number ? `(${item.contact_number})` : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 font-mono font-bold text-surface-900">
                                            ₹{parseFloat(item.pending_amount).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                item.status === 'paid' 
                                                ? 'bg-emerald-100 text-emerald-700' 
                                                : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                item.priority === 'immediate' 
                                                ? 'bg-rose-100 text-rose-700' 
                                                : 'bg-brand-100 text-brand-700'
                                            }`}>
                                                {item.priority === 'immediate' ? <AlertCircle size={10} /> : <Clock size={10} />}
                                                {item.priority}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            {item.bank_statement_url ? (
                                                <a 
                                                    href={item.bank_statement_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-wider hover:bg-brand-100 transition-colors"
                                                >
                                                    <ExternalLink size={10} />
                                                    View
                                                </a>
                                            ) : (
                                                <span className="text-surface-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            {item.expected_date ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`font-mono font-bold ${item.status === 'unpaid' && new Date(item.expected_date) < new Date().setHours(0,0,0,0) ? 'text-rose-600' : 'text-surface-900'}`}>
                                                        {new Date(item.expected_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                    {item.status === 'unpaid' && new Date(item.expected_date) < new Date().setHours(0,0,0,0) && (
                                                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[8px] font-bold uppercase tracking-tighter">
                                                            Overdue
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-surface-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            {item.status === 'unpaid' ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`font-mono font-bold ${calculateDaysPending(item.created_at) > 30 ? 'text-rose-600' : 'text-surface-900'}`}>
                                                        {calculateDaysPending(item.created_at)} Days
                                                    </span>
                                                    {calculateDaysPending(item.created_at) > 30 && (
                                                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[8px] font-bold uppercase tracking-tighter animate-pulse">
                                                            Long Due
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-surface-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-xs font-mono text-surface-500">
                                            {formatTimestamp(item.created_at)}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleEdit(item)}
                                                    className="p-2 text-surface-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-all"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 text-surface-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-surface-100 flex items-center justify-between bg-surface-50">
                            <h3 className="text-xl font-bold text-surface-900 flex items-center gap-2">
                                {editingId ? <Edit2 size={20} className="text-brand-500" /> : <Plus size={20} className="text-brand-500" />}
                                {editingId ? 'Edit Record' : 'Add New Company'}
                            </h3>
                            <button onClick={resetForm} className="text-surface-400 hover:text-surface-600 transition-colors">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Company Name</label>
                                <input
                                    required
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Enter company name..."
                                    className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Pending Amount (₹)</label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    value={pendingAmount}
                                    onChange={(e) => setPendingAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-bold appearance-none"
                                    >
                                        <option value="unpaid">Unpaid</option>
                                        <option value="paid">Paid</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Priority</label>
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-bold appearance-none"
                                    >
                                        <option value="later">Later</option>
                                        <option value="immediate">Immediate</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Expected Date of Payment</label>
                                <input
                                    type="date"
                                    value={expectedDate}
                                    onChange={(e) => setExpectedDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-medium"
                                />
                            </div>
                            
                            {/* New Detail Fields */}
                            <div className="space-y-4 pt-2 border-t border-surface-100">
                                <div className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1">Company Details</div>
                                
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Full Address</label>
                                    <textarea
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="Enter company address..."
                                        rows={2}
                                        className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-medium resize-none"
                                    />
                                </div>
                                
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">GST Number</label>
                                    <input
                                        type="text"
                                        value={gstNumber}
                                        onChange={(e) => setGstNumber(e.target.value)}
                                        placeholder="e.g. 22AAAAA0000A1Z5"
                                        className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono uppercase"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Contact Name</label>
                                        <input
                                            type="text"
                                            value={contactName}
                                            onChange={(e) => setContactName(e.target.value)}
                                            placeholder="Contact person"
                                            className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-medium"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Contact Number</label>
                                        <input
                                            type="text"
                                            value={contactNumber}
                                            onChange={(e) => setContactNumber(e.target.value)}
                                            placeholder="Mobile/Phone"
                                            className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {editingId && (
                                <div className="p-4 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
                                            <Clock size={16} className="text-brand-600" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">Current Status</div>
                                            <div className="text-xs font-bold text-brand-900">
                                                Pending for {calculateDaysPending(payments.find(p => p.id === editingId)?.created_at)} Days
                                            </div>
                                        </div>
                                    </div>
                                    {calculateDaysPending(payments.find(p => p.id === editingId)?.created_at) > 30 && (
                                        <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[8px] font-bold uppercase tracking-tighter animate-pulse">
                                            Long Due
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Bank Statement (Optional)</label>
                                <div className="relative group">
                                    <input
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={(e) => setSelectedFile(e.target.files[0])}
                                        className="hidden"
                                        id="bank-statement-upload"
                                    />
                                    <label
                                        htmlFor="bank-statement-upload"
                                        className={`flex items-center justify-between w-full px-4 py-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                                            selectedFile 
                                            ? 'border-brand-500 bg-brand-50 text-brand-700' 
                                            : 'border-surface-200 bg-surface-50 text-surface-500 hover:border-brand-300 hover:bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {uploading ? (
                                                <Loader2 size={18} className="animate-spin text-brand-500" />
                                            ) : (
                                                <Upload size={18} className={selectedFile ? 'text-brand-500' : ''} />
                                            )}
                                            <span className="text-sm font-medium truncate">
                                                {selectedFile ? selectedFile.name : bankStatementUrl ? 'Statement already uploaded' : 'Click to upload statement...'}
                                            </span>
                                        </div>
                                        {selectedFile && (
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                                                className="p-1 rounded-lg hover:bg-brand-100 text-brand-600"
                                            >
                                                <Plus size={16} className="rotate-45" />
                                            </button>
                                        )}
                                    </label>
                                </div>
                                {bankStatementUrl && !selectedFile && (
                                    <p className="text-[10px] text-surface-400 ml-1">
                                        Current: <a href={bankStatementUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">View Statement</a>
                                    </p>
                                )}
                            </div>
                            <div className="pt-4">
                                <button
                                    disabled={submitting}
                                    type="submit"
                                    className="w-full py-4 bg-brand-500 text-white rounded-2xl font-bold shadow-xl shadow-brand-500/25 hover:bg-brand-600 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {submitting ? 'Processing...' : editingId ? 'Update Record' : 'Save Company Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
