import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { formatTimestamp } from '@/lib/formatTime'
import { Building2, Search, RefreshCw, Plus, Edit2, Trash2, AlertCircle, Clock, ArrowLeft, FileText, Upload, ExternalLink, Loader2, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function CompanyPaymentsPage() {
    const [payments, setPayments] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [initialLoadDone, setInitialLoadDone] = useState(false)
    const [dueTodayAlertOpen, setDueTodayAlertOpen] = useState(false)
    const [dueTodayList, setDueTodayList] = useState([])

    // Form state
    const [companyName, setCompanyName] = useState('')
    const [totalAmount, setTotalAmount] = useState('')
    const [pendingAmount, setPendingAmount] = useState('')
    const [status, setStatus] = useState('unpaid')
    const [priority, setPriority] = useState('later')
    const [dcStatus, setDcStatus] = useState('not_sent')
    const [bankStatementUrl, setBankStatementUrl] = useState('')
    const [expectedDate, setExpectedDate] = useState('')
    const [contactNumber, setContactNumber] = useState('')
    const [remarks, setRemarks] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedFile, setSelectedFile] = useState(null)
    const [errorToast, setErrorToast] = useState('')

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
        
        if (!error && data) {
            setPayments(data)
            
            if (!initialLoadDone) {
                const today = new Date(); today.setHours(0,0,0,0)
                const dueToday = data.filter(p => {
                    if (p.status !== 'unpaid' || !p.expected_date) return false
                    const d = new Date(p.expected_date); d.setHours(0,0,0,0)
                    return d.getTime() <= today.getTime()
                })
                
                if (dueToday.length > 0) {
                    setDueTodayList(dueToday)
                    setDueTodayAlertOpen(true)
                }
                setInitialLoadDone(true)
            }
        }
        setLoading(false)
    }

    function showErrorToast(msg) {
        setErrorToast(msg)
        setTimeout(() => setErrorToast(''), 3500)
    }

    async function handleSubmit(e) {
        e.preventDefault()

        // Duplicate company name check on submit
        const duplicate = payments.some(
            p => p.company_name.trim().toLowerCase() === companyName.trim().toLowerCase() && p.id !== editingId
        )
        if (duplicate) {
            showErrorToast(`"${companyName.trim()}" already exists. Use a unique company name.`)
            return
        }

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
            total_amount: parseFloat(totalAmount) || 0,
            pending_amount: parseFloat(pendingAmount),
            status,
            priority,
            // dc_status: dcStatus, // commented out - field hidden
            bank_statement_url: finalUrl,
            expected_date: expectedDate || null,
            contact_number: contactNumber || null,
            remarks: remarks || null
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
        setTotalAmount('')
        setPendingAmount('')
        setStatus('unpaid')
        setPriority('later')
        setDcStatus('not_sent')
        setBankStatementUrl('')
        setExpectedDate('')
        setContactNumber('')
        setRemarks('')
        setSelectedFile(null)
        setEditingId(null)
        setModalOpen(false)
    }

    function handleEdit(item) {
        setEditingId(item.id)
        setCompanyName(item.company_name)
        setTotalAmount(item.total_amount || '')
        setPendingAmount(item.pending_amount)
        setStatus(item.status)
        setPriority(item.priority)
        setDcStatus(item.dc_status || 'not_sent')
        setBankStatementUrl(item.bank_statement_url || '')
        setExpectedDate(item.expected_date || '')
        setContactNumber(item.contact_number || '')
        setRemarks(item.remarks || '')
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

    const today = new Date(); today.setHours(0, 0, 0, 0)

    const filtered = payments.filter(row => {
        const matchesSearch = row.company_name?.toLowerCase().includes(search.toLowerCase()) ||
            row.contact_number?.toLowerCase().includes(search.toLowerCase()) ||
            row.remarks?.toLowerCase().includes(search.toLowerCase())

        let matchesStatus = true
        if (statusFilter === 'all') matchesStatus = true
        else if (statusFilter === 'today') {
            if (!row.expected_date || row.status !== 'unpaid') { matchesStatus = false }
            else {
                const d = new Date(row.expected_date); d.setHours(0, 0, 0, 0)
                matchesStatus = d.getTime() === today.getTime()
            }
        } else {
            matchesStatus = row.status === statusFilter
        }

        return matchesSearch && matchesStatus
    })

    return (
        <div className="space-y-6">
            {/* Error Toast */}
            {errorToast && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-5 py-3 bg-rose-600 text-white rounded-2xl shadow-2xl shadow-rose-500/30 text-sm font-semibold animate-[toastSlideDown_0.3s_ease-out]">
                    <span>⚠️</span> {errorToast}
                </div>
            )}
            {/* Header */}
            <div className="flex flex-col gap-3">
                {/* Row 1: title + add button */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link 
                            to="/" 
                            className="p-2 rounded-xl border border-surface-200 bg-white text-surface-500 hover:text-brand-500 hover:border-brand-200 hover:shadow-lg transition-all active:scale-95 group"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                        </Link>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                                <Building2 size={20} className="text-brand-500" />
                                Company Payments
                            </h2>
                            <p className="text-xs sm:text-sm text-surface-700/60 mt-0.5 hidden sm:block">Manage outstanding balances and payment priorities</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { resetForm(); setModalOpen(true); }}
                        className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={15} />
                        <span className="hidden sm:inline">Add Company</span>
                        <span className="sm:hidden">Add</span>
                    </button>
                </div>
                {/* Row 2: search + filters + refresh */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[140px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search companies..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all w-full"
                        />
                    </div>
                    <div className="flex bg-surface-100 p-1 rounded-xl">
                        {['all', 'unpaid', 'today', 'paid'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setStatusFilter(f)}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                                    statusFilter === f
                                        ? f === 'today'
                                            ? 'bg-amber-400 text-white shadow-sm'
                                            : 'bg-white text-brand-600 shadow-sm'
                                        : 'text-surface-500 hover:text-surface-700'
                                }`}
                            >
                                {f === 'today' ? '📅 Today' : f}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchPayments}
                        className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
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

            {/* Due-Soon Alert Banner */}
            {(() => {
                const today = new Date(); today.setHours(0,0,0,0)
                const twoDaysLater = new Date(today); twoDaysLater.setDate(today.getDate() + 2)
                const dueSoon = payments.filter(p => {
                    if (p.status !== 'unpaid' || !p.expected_date) return false
                    const d = new Date(p.expected_date); d.setHours(0,0,0,0)
                    return d <= twoDaysLater
                }).sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date))
                if (dueSoon.length === 0) return null
                return (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden shadow-sm">
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-100/60 border-b border-amber-200">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 shadow">
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                            </span>
                            <div>
                                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                                    ⚡ Payment Due Within 2 Days
                                </span>
                                <span className="ml-2 text-[10px] text-amber-600 font-medium">
                                    {dueSoon.length} {dueSoon.length === 1 ? 'company' : 'companies'} need attention
                                </span>
                            </div>
                        </div>
                        <div className="divide-y divide-amber-100">
                            {dueSoon.map(item => {
                                const expDate = new Date(item.expected_date); expDate.setHours(0,0,0,0)
                                const daysLeft = Math.round((expDate - today) / (1000 * 60 * 60 * 24))
                                const isOverdue = daysLeft < 0
                                const isToday = daysLeft === 0
                                return (
                                    <div key={item.id} className="flex items-center justify-between px-4 py-3 gap-3 hover:bg-amber-100/30 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex-shrink-0 h-8 w-8 rounded-xl bg-amber-200 flex items-center justify-center">
                                                <Building2 size={14} className="text-amber-700" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-surface-900 text-sm truncate">{item.company_name}</div>
                                                {item.contact_name && (
                                                    <div className="text-[10px] text-surface-500 flex items-center gap-1">
                                                        <Users size={9} /> {item.contact_name}
                                                        {item.contact_number && (
                                                            <>
                                                                <Phone size={9} className="ml-1" /> 
                                                                {item.contact_number}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="font-mono font-bold text-sm text-surface-800">
                                                ₹{parseFloat(item.pending_amount).toLocaleString('en-IN')}
                                            </span>
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                                                isOverdue ? 'bg-rose-100 text-rose-700 animate-pulse' :
                                                isToday  ? 'bg-orange-100 text-orange-700' :
                                                           'bg-amber-100 text-amber-700'
                                            }`}>
                                                {isOverdue ? `${Math.abs(daysLeft)}d overdue` : isToday ? 'Due Today' : `${daysLeft}d left`}
                                            </span>
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-1.5 rounded-lg hover:bg-amber-200 text-amber-600 transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })()}

            {/* Payments Table */}
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-surface-200 bg-surface-50/80">
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider">Company Name</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider">Amounts</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Status</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Priority</th>
                                {/* <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">DC Status</th> */}
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Statement</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Expected Date</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Duration</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider">Remarks</th>
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
                                            {item.contact_number && (
                                                <div className="text-[10px] text-surface-500 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 font-mono">
                                                    {item.contact_number.split(',').map((num, i) => (
                                                        <span key={i} className="flex items-center gap-1"><Phone size={10} /> {num.trim()}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-mono text-[10px] text-surface-400">Total: ₹{(parseFloat(item.total_amount) || 0).toLocaleString('en-IN')}</span>
                                                <span className="font-mono font-bold text-surface-900">Pending: ₹{parseFloat(item.pending_amount).toLocaleString('en-IN')}</span>
                                            </div>
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
                                        {/* DC Status column - commented out
                                        <td className="px-5 py-4 text-center">
                                            {item.dc_status === 'sent' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                                                    <FileText size={10} /> Sent
                                                </span>
                                            ) : item.dc_status === 'not_sent' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-100 text-surface-600 text-[10px] font-bold uppercase tracking-wider">
                                                    Not Sent
                                                </span>
                                            ) : (
                                                <span className="text-surface-300 font-mono text-xs">N/A</span>
                                            )}
                                        </td>
                                        */}
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
                                        <td className="px-5 py-4 max-w-[180px]">
                                            {item.remarks ? (
                                                <span className="text-xs text-surface-600 line-clamp-2">{item.remarks}</span>
                                            ) : (
                                                <span className="text-surface-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-xs font-mono text-surface-500">
                                            {formatTimestamp(item.created_at)}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleEdit(item)}
                                                    className="p-2 text-surface-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 text-surface-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={15} />
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
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-surface-900/60 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) resetForm() }}
                >
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92vh] flex flex-col shadow-2xl">
                        {/* Sticky header */}
                        <div className="flex-shrink-0 px-5 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50 rounded-t-3xl">
                            <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                                {editingId ? <Edit2 size={18} className="text-brand-500" /> : <Plus size={18} className="text-brand-500" />}
                                {editingId ? 'Edit Record' : 'Add New Company'}
                            </h3>
                            <button
                                onClick={resetForm}
                                className="p-2 rounded-xl hover:bg-surface-200 text-surface-400 hover:text-surface-700 transition-colors"
                                title="Close"
                            >
                                <Plus size={20} className="rotate-45" />
                            </button>
                        </div>
                        {/* Scrollable body */}
                        <div className="overflow-y-auto flex-1">
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Total Amount (₹)</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        value={totalAmount}
                                        onChange={(e) => setTotalAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono text-sm"
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
                                        className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                {/* DC Status - commented out
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">DC Status</label>
                                    <select
                                        value={dcStatus}
                                        onChange={(e) => setDcStatus(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-bold appearance-none"
                                    >
                                        <option value="not_sent">Not Sent</option>
                                        <option value="sent">Sent</option>
                                        <option value="na">N/A</option>
                                    </select>
                                </div>
                                */}
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
                            
                            {/* Contact Number */}
                            <div className="space-y-1.5 pt-2 border-t border-surface-100">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Contact Number(s)</label>
                                <input
                                    type="text"
                                    value={contactNumber}
                                    onChange={(e) => setContactNumber(e.target.value)}
                                    placeholder="Comma separated for multiple"
                                    className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono text-sm"
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Remarks</label>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Add any notes or remarks..."
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-medium resize-none"
                                />
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
                </div>
            )}
            {/* Due Today Popup Alert */}
            {dueTodayAlertOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm shadow-2xl transition-all"
                     onClick={() => setDueTodayAlertOpen(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative"
                         onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-6 text-center shadow-inner">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-3 shadow-lg ring-4 ring-rose-400">
                                <AlertCircle size={32} className="text-white animate-bounce" />
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Payments Due!</h3>
                            <p className="text-rose-100 text-sm mt-1 font-medium">
                                You have {dueTodayList.length} {dueTodayList.length === 1 ? 'company' : 'companies'} needing payment attention today.
                            </p>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-2">
                                {dueTodayList.map(item => {
                                    const expDate = new Date(item.expected_date); expDate.setHours(0,0,0,0)
                                    const today = new Date(); today.setHours(0,0,0,0)
                                    const isOverdue = expDate.getTime() < today.getTime()
                                    return (
                                        <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-surface-50 border border-surface-100 hover:bg-rose-50 transition-colors">
                                            <div className="font-bold text-surface-900 text-sm truncate mr-2">{item.company_name}</div>
                                            <div className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm ${isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {isOverdue ? 'Overdue' : 'Due Today'}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <button
                                onClick={() => setDueTodayAlertOpen(false)}
                                className="w-full py-3.5 bg-surface-900 text-white rounded-2xl font-bold shadow-xl shadow-surface-900/20 hover:bg-surface-800 transition-all active:scale-[0.98]"
                            >
                                Got it, let's review
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
