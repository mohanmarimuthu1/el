import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { ShieldAlert, UserPlus, Users, Loader2, CheckCircle2, XCircle, Eye, EyeOff, Shield, RefreshCw, Pencil, Trash2, X, Check } from 'lucide-react'

const ROLE_OPTIONS = [
    { value: 'owner', label: 'Owner', color: 'bg-emerald-100 text-emerald-700 ring-emerald-300' },
    { value: 'manager', label: 'Manager', color: 'bg-blue-100 text-blue-700 ring-blue-300' },
    { value: 'supervisor', label: 'Supervisor', color: 'bg-amber-100 text-amber-700 ring-amber-300' },
    { value: 'employee', label: 'Employee', color: 'bg-indigo-100 text-indigo-700 ring-indigo-300' },
]

const roleBadgeColor = {
    owner: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
    manager: 'bg-blue-100 text-blue-700 ring-blue-300',
    supervisor: 'bg-amber-100 text-amber-700 ring-amber-300',
    employee: 'bg-indigo-100 text-indigo-700 ring-indigo-300',
    admin: 'bg-rose-100 text-rose-700 ring-rose-300',
}

export default function AdminUserManagementPage() {
    const { role, isAdmin } = useAuth()
    const isOwner = role === 'owner'
    const canManage = isAdmin // Only admin can create/edit/delete

    const [users, setUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(true)

    // Form state
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [selectedRole, setSelectedRole] = useState('supervisor')
    const [fullName, setFullName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [feedback, setFeedback] = useState(null)

    // Edit state
    const [editingId, setEditingId] = useState(null)
    const [editRole, setEditRole] = useState('')
    const [editName, setEditName] = useState('')
    const [editSubmitting, setEditSubmitting] = useState(false)

    // Delete state
    const [deletingId, setDeletingId] = useState(null)
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    useEffect(() => { fetchUsers() }, [])

    async function fetchUsers() {
        setLoadingUsers(true)
        const { data, error } = await supabase
            .from('user_roles')
            .select('*')
            .order('full_name', { ascending: true })
        if (!error) setUsers(data || [])
        setLoadingUsers(false)
    }

    async function handleCreateUser(e) {
        e.preventDefault()
        setSubmitting(true)
        setFeedback(null)

        try {
            const { data, error } = await supabase.functions.invoke('create-user', {
                body: {
                    email,
                    password,
                    role: selectedRole,
                    full_name: fullName,
                },
            })

            if (error) {
                setFeedback({ type: 'error', message: error.message || 'Failed to create user' })
            } else if (data?.error) {
                setFeedback({ type: 'error', message: data.error })
            } else {
                setFeedback({ type: 'success', message: `User "${email}" created successfully as ${selectedRole}` })
                setEmail('')
                setPassword('')
                setFullName('')
                setSelectedRole('supervisor')
                fetchUsers()
            }
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'An unexpected error occurred' })
        }

        setSubmitting(false)
        setTimeout(() => setFeedback(null), 6000)
    }

    function startEdit(user) {
        setEditingId(user.user_id)
        setEditRole(user.role)
        setEditName(user.full_name || '')
    }

    function cancelEdit() {
        setEditingId(null)
        setEditRole('')
        setEditName('')
    }

    async function saveEdit(userId) {
        setEditSubmitting(true)
        const { error } = await supabase
            .from('user_roles')
            .update({ role: editRole, full_name: editName.trim() || null })
            .eq('user_id', userId)

        if (!error) {
            setEditingId(null)
            fetchUsers()
        }
        setEditSubmitting(false)
    }

    async function handleDelete(userId) {
        setDeletingId(userId)
        const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId)

        if (!error) {
            setDeleteConfirm(null)
            fetchUsers()
        }
        setDeletingId(null)
    }

    // Access guard: only 'admin' and 'owner' can see this page
    if (!isAdmin && !isOwner) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-100">
                    <ShieldAlert size={40} className="text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-surface-900">Access Denied</h2>
                <p className="text-sm text-surface-700/60 max-w-md">
                    This page is restricted to <span className="font-semibold text-red-600">System Admin</span> and <span className="font-semibold text-emerald-600">Owner</span> users.
                    Your current role is <span className="font-semibold capitalize text-surface-800">{role}</span>.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                    <Shield size={22} className="text-rose-500" />
                    User Management
                </h2>
                <p className="text-sm text-surface-700/60 mt-0.5">
                    {isOwner
                        ? 'View registered staff members — read-only access'
                        : 'Create new users and manage role assignments — System Admin only'
                    }
                </p>
            </div>

            <div className={`grid gap-8 ${canManage ? 'lg:grid-cols-5' : ''}`}>
                {/* Create User Form — Admin only */}
                {canManage && (
                    <div className="lg:col-span-2">
                        <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-surface-200 bg-gradient-to-r from-rose-50 to-pink-50">
                                <h3 className="text-sm font-bold text-surface-800 flex items-center gap-2">
                                    <UserPlus size={16} className="text-rose-500" />
                                    Create New User
                                </h3>
                                <p className="text-[11px] text-surface-700/50 mt-0.5">
                                    Password is securely hashed by Supabase Auth
                                </p>
                            </div>

                            <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                                {/* Full Name */}
                                <div>
                                    <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="user@elman.co.in"
                                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
                                    />
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                                        Password <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={6}
                                            placeholder="Minimum 6 characters"
                                            className="w-full px-4 py-2.5 pr-10 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-surface-700/40 mt-1">
                                        Securely hashed — never stored in plaintext
                                    </p>
                                </div>

                                {/* Role */}
                                <div>
                                    <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                                        Role <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all cursor-pointer appearance-none"
                                        style={{
                                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                            backgroundPosition: 'right 0.75rem center',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: '1.25rem',
                                        }}
                                    >
                                        {ROLE_OPTIONS.map((r) => (
                                            <option key={r.value} value={r.value}>
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Feedback */}
                                {feedback && (
                                    <div
                                        className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm font-medium ${feedback.type === 'success'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-red-50 text-red-700 border border-red-200'
                                            }`}
                                    >
                                        {feedback.type === 'success' ? (
                                            <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                                        ) : (
                                            <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
                                        )}
                                        <span>{feedback.message}</span>
                                    </div>
                                )}

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Creating User...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={16} />
                                            Create User
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Users List */}
                <div className={canManage ? 'lg:col-span-3' : 'w-full'}>
                    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-surface-200 bg-surface-50/80 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-surface-800 flex items-center gap-2">
                                    <Users size={16} className="text-brand-500" />
                                    Registered Users
                                </h3>
                                <p className="text-[11px] text-surface-700/50 mt-0.5">
                                    {users.length} user{users.length !== 1 ? 's' : ''} in the system
                                    {isOwner && <span className="ml-1 text-emerald-600 font-semibold">• Read-only view</span>}
                                </p>
                            </div>
                            <button
                                onClick={fetchUsers}
                                className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw size={14} className={loadingUsers ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-200 bg-surface-50/40">
                                        <th className="text-left px-5 py-3 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="text-left px-5 py-3 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="text-center px-5 py-3 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">
                                            Role
                                        </th>
                                        {canManage && (
                                            <th className="text-center px-5 py-3 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">
                                                Actions
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingUsers ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <tr key={i} className="border-b border-surface-100">
                                                <td className="px-5 py-3.5"><div className="h-4 bg-surface-200 rounded animate-pulse w-32" /></td>
                                                <td className="px-5 py-3.5"><div className="h-4 bg-surface-200 rounded animate-pulse w-40" /></td>
                                                <td className="px-5 py-3.5"><div className="h-4 bg-surface-200 rounded animate-pulse w-20 mx-auto" /></td>
                                                {canManage && (
                                                    <td className="px-5 py-3.5"><div className="h-4 bg-surface-200 rounded animate-pulse w-24 mx-auto" /></td>
                                                )}
                                            </tr>
                                        ))
                                    ) : users.length === 0 ? (
                                        <tr>
                                            <td colSpan={canManage ? 4 : 3} className="px-5 py-12 text-center text-surface-700/40">
                                                <Users size={36} className="mx-auto mb-2 opacity-30" />
                                                <p className="font-medium">No users registered yet</p>
                                                {canManage && <p className="text-xs mt-1">Use the form to create your first user.</p>}
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((u) => (
                                            <tr key={u.user_id} className="border-b border-surface-100 hover:bg-brand-50/30 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    {editingId === u.user_id ? (
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                                            placeholder="Full Name"
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-xs font-bold shadow-sm shrink-0">
                                                                {(u.full_name || '?')[0].toUpperCase()}
                                                            </div>
                                                            <span className="font-medium text-surface-800 truncate">
                                                                {u.full_name || '—'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-surface-600 truncate max-w-[220px]">
                                                    {u.email || '—'}
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    {editingId === u.user_id ? (
                                                        <select
                                                            value={editRole}
                                                            onChange={(e) => setEditRole(e.target.value)}
                                                            className="px-2.5 py-1.5 text-xs rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
                                                        >
                                                            {ROLE_OPTIONS.map((r) => (
                                                                <option key={r.value} value={r.value}>{r.label}</option>
                                                            ))}
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ring-inset capitalize ${roleBadgeColor[u.role] || 'bg-surface-100 text-surface-600 ring-surface-300'}`}>
                                                            <Shield size={10} />
                                                            {u.role}
                                                        </span>
                                                    )}
                                                </td>
                                                {canManage && (
                                                    <td className="px-5 py-3.5 text-center">
                                                        {editingId === u.user_id ? (
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    onClick={() => saveEdit(u.user_id)}
                                                                    disabled={editSubmitting}
                                                                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-colors disabled:opacity-50"
                                                                    title="Save"
                                                                >
                                                                    {editSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                                </button>
                                                                <button
                                                                    onClick={cancelEdit}
                                                                    className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 border border-surface-200 transition-colors"
                                                                    title="Cancel"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : deleteConfirm === u.user_id ? (
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    onClick={() => handleDelete(u.user_id)}
                                                                    disabled={deletingId === u.user_id}
                                                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                                                                >
                                                                    {deletingId === u.user_id ? 'Deleting...' : 'Confirm'}
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteConfirm(null)}
                                                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-surface-600 bg-surface-100 hover:bg-surface-200 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    onClick={() => startEdit(u)}
                                                                    className="p-1.5 rounded-lg text-brand-500 hover:bg-brand-50 border border-brand-200 transition-colors"
                                                                    title="Edit user"
                                                                >
                                                                    <Pencil size={13} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteConfirm(u.user_id)}
                                                                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 border border-red-200 transition-colors"
                                                                    title="Delete user"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
