import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Users, Clock, Calendar, Plus, Edit2, Trash2, ArrowLeft, RefreshCw, Loader2, FileText, CheckCircle2, ShieldAlert } from 'lucide-react'

export default function EmployeeWorklogPage() {
    const { role, isAdmin, isOwner } = useAuth()
    const canManage = isAdmin || isOwner || role === 'manager'

    const [logs, setLogs] = useState([])
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [editingId, setEditingId] = useState(null)
    
    // Filters
    const [dateFilter, setDateFilter] = useState('')
    const [userFilter, setUserFilter] = useState('all')

    // Form state
    const [selectedUser, setSelectedUser] = useState('')
    const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
    const [status, setStatus] = useState('present')
    const [hoursWorked, setHoursWorked] = useState('8')
    const [description, setDescription] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        
        // Fetch employees
        const { data: usersData } = await supabase
            .from('user_roles')
            .select('user_id, full_name, role')
            .order('full_name')
        
        if (usersData) setEmployees(usersData)

        // Fetch logs
        const { data: logsData } = await supabase
            .from('employee_worklogs')
            .select(`
                *,
                user_roles (full_name, role)
            `)
            .order('log_date', { ascending: false })
            .order('created_at', { ascending: false })
            
        if (logsData) setLogs(logsData)
        
        // Defaults
        if (usersData && usersData.length > 0 && !selectedUser) {
            setSelectedUser(usersData[0].user_id)
        }
        
        setLoading(false)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSubmitting(true)

        const payload = {
            user_id: selectedUser,
            log_date: logDate,
            status,
            hours_worked: parseFloat(hoursWorked) || 0,
            description
        }

        let error;
        if (editingId) {
            const { error: updateError } = await supabase
                .from('employee_worklogs')
                .update(payload)
                .eq('id', editingId)
            error = updateError
        } else {
            const { error: insertError } = await supabase
                .from('employee_worklogs')
                .insert(payload)
            error = insertError
        }

        if (error) {
            console.error('Save error:', error)
            alert(error.message || 'Failed to save worklog')
        } else {
            resetForm()
            fetchData()
        }
        setSubmitting(false)
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this worklog?')) return
        const { error } = await supabase
            .from('employee_worklogs')
            .delete()
            .eq('id', id)
        if (!error) fetchData()
    }

    function resetForm() {
        setLogDate(new Date().toISOString().split('T')[0])
        setStatus('present')
        setHoursWorked('8')
        setDescription('')
        setEditingId(null)
        setModalOpen(false)
    }

    function handleEdit(item) {
        setEditingId(item.id)
        setSelectedUser(item.user_id)
        setLogDate(item.log_date)
        setStatus(item.status)
        setHoursWorked(item.hours_worked)
        setDescription(item.description || '')
        setModalOpen(true)
    }

    // Prepare chart data (Group by date)
    const chartDataMap = {}
    logs.forEach(log => {
        if (!chartDataMap[log.log_date]) {
            chartDataMap[log.log_date] = { date: log.log_date, hours: 0 }
        }
        chartDataMap[log.log_date].hours += parseFloat(log.hours_worked || 0)
    })
    const chartData = Object.values(chartDataMap)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-14) // Last 14 days

    // Filter logs for table
    const filteredLogs = logs.filter(log => {
        if (dateFilter && log.log_date !== dateFilter) return false
        if (userFilter !== 'all' && log.user_id !== userFilter) return false
        return true
    })

    const statusColors = {
        present: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
        half_day: 'bg-amber-100 text-amber-700 ring-amber-300',
        absent: 'bg-rose-100 text-rose-700 ring-rose-300',
        leave: 'bg-indigo-100 text-indigo-700 ring-indigo-300'
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link 
                        to="/" 
                        className="p-2 rounded-xl border border-surface-200 bg-white text-surface-500 hover:text-brand-500 hover:border-brand-200 hover:shadow-lg transition-all active:scale-95 group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </Link>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                            <Clock size={22} className="text-brand-500" />
                            Employee Worklogs
                        </h2>
                        <p className="text-xs sm:text-sm text-surface-700/60 mt-0.5">Track daily attendance, tasks, and hours worked</p>
                    </div>
                </div>
                {canManage && (
                    <button
                        onClick={() => { resetForm(); setModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={16} />
                        Log Attendance
                    </button>
                )}
            </div>

            {/* Quick Stats & Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1 space-y-4">
                    <div className="p-4 rounded-2xl border border-surface-200 bg-white shadow-sm">
                        <div className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-1">Total Logs Today</div>
                        <div className="text-3xl font-bold text-surface-900 font-mono">
                            {logs.filter(l => l.log_date === new Date().toISOString().split('T')[0]).length}
                        </div>
                    </div>
                    <div className="p-4 rounded-2xl border border-brand-100 bg-brand-50 shadow-sm">
                        <div className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1">Total Hours Logged (7 Days)</div>
                        <div className="text-3xl font-bold text-brand-900 font-mono">
                            {logs
                                .filter(l => new Date(l.log_date) >= new Date(new Date().setDate(new Date().getDate() - 7)))
                                .reduce((acc, l) => acc + parseFloat(l.hours_worked || 0), 0)
                                .toFixed(1)}h
                        </div>
                    </div>
                </div>
                
                <div className="lg:col-span-3 p-4 rounded-2xl border border-surface-200 bg-white shadow-sm flex flex-col hidden sm:flex">
                    <h3 className="text-xs font-bold text-surface-400 uppercase tracking-widest mb-4">Daily Hours Logged (Last 14 Days)</h3>
                    <div className="flex-1 w-full min-h-[160px]">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis 
                                        dataKey="date" 
                                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        tick={{ fontSize: 10, fill: '#6b7280' }}
                                        tickLine={false}
                                        axisLine={{ stroke: '#e5e7eb' }}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 10, fill: '#6b7280' }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f3f4f6' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    />
                                    <Bar dataKey="hours" name="Total Hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-sm text-surface-400">Not enough data for chart</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="pl-8 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                    />
                </div>
                <div className="relative flex-1 max-w-xs">
                    <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <select
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all appearance-none"
                    >
                        <option value="all">All Employees</option>
                        {employees.map(emp => (
                            <option key={emp.user_id} value={emp.user_id}>{emp.full_name || 'Unknown'}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={() => { setDateFilter(''); setUserFilter('all'); fetchData(); }}
                    className="p-2 sm:px-4 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-600 transition-colors flex items-center justify-center gap-2"
                >
                    <RefreshCw size={14} className={loading && !logs.length ? 'animate-spin' : ''} />
                    <span className="hidden sm:inline text-sm font-medium">Clear & Refresh</span>
                </button>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-surface-200 bg-surface-50/80">
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider">Date</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider">Employee</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider">Status</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-center">Hours</th>
                                <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider">Description</th>
                                {canManage && <th className="px-5 py-3.5 font-bold text-surface-700/70 text-xs uppercase tracking-wider text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-5 py-12 text-center text-surface-400">
                                        <Loader2 size={32} className="mx-auto mb-3 animate-spin text-brand-500" />
                                        <p className="text-sm font-medium">Loading worklogs...</p>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-5 py-12 text-center text-surface-400">
                                        <FileText size={40} className="mx-auto mb-3 opacity-20" />
                                        <p className="text-sm font-medium">No worklogs found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-brand-50/30 transition-colors">
                                        <td className="px-5 py-4 font-mono font-medium text-surface-900 whitespace-nowrap">
                                            {new Date(log.log_date).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-surface-900">{log.user_roles?.full_name || 'Unknown'}</div>
                                            <div className="text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">{log.user_roles?.role}</div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${statusColors[log.status] || statusColors.present}`}>
                                                {log.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center font-mono font-bold text-brand-700">
                                            {log.hours_worked}h
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-surface-600 line-clamp-2" title={log.description || '—'}>
                                                {log.description || <span className="text-surface-300 italic">No description</span>}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button 
                                                        onClick={() => handleEdit(log)}
                                                        className="p-1.5 text-surface-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-all"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(log.id)}
                                                        className="p-1.5 text-surface-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50">
                            <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                                {editingId ? <Edit2 size={18} className="text-brand-500" /> : <Plus size={18} className="text-brand-500" />}
                                {editingId ? 'Edit Worklog' : 'Log Attendance'}
                            </h3>
                            <button
                                onClick={resetForm}
                                className="p-2 rounded-xl hover:bg-surface-200 text-surface-400 transition-colors"
                            >
                                <Plus size={20} className="rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Employee</label>
                                <select
                                    required
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 font-medium appearance-none transition-all"
                                >
                                    <option value="" disabled>Select an employee</option>
                                    {employees.map(emp => (
                                        <option key={emp.user_id} value={emp.user_id}>{emp.full_name || 'Unknown'}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Date</label>
                                    <input
                                        required
                                        type="date"
                                        value={logDate}
                                        onChange={(e) => setLogDate(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 font-medium transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Status</label>
                                    <select
                                        required
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 font-bold appearance-none transition-all"
                                    >
                                        <option value="present">Present</option>
                                        <option value="half_day">Half Day</option>
                                        <option value="absent">Absent</option>
                                        <option value="leave">Leave</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Hours Worked</label>
                                <input
                                    required
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="24"
                                    value={hoursWorked}
                                    onChange={(e) => setHoursWorked(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 font-mono transition-all"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Task Description (Optional)</label>
                                <textarea
                                    rows="3"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What did they work on?"
                                    className="w-full px-4 py-3 rounded-2xl border border-surface-200 bg-surface-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 font-medium resize-none transition-all"
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    disabled={submitting}
                                    type="submit"
                                    className="w-full py-4 bg-brand-500 text-white rounded-2xl font-bold shadow-xl shadow-brand-500/25 hover:bg-brand-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting && <Loader2 size={18} className="animate-spin" />}
                                    {submitting ? 'Saving...' : 'Save Worklog'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
