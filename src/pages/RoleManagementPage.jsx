import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import {
    Shield, ShieldAlert, Plus, Trash2, Loader2, Check, X, RefreshCw,
    Save, Settings, Eye, PenSquare, FilePlus, PackageMinus, CheckSquare,
    ChevronRight, Lock
} from 'lucide-react'

const MODULES = [
    { key: 'inventory',         label: 'Inventory',          icon: '📦' },
    { key: 'purchase_intents',  label: 'Purchase Indents',   icon: '📋' },
    { key: 'vendors',           label: 'Vendors',            icon: '🏢' },
    { key: 'projects',          label: 'Projects',           icon: '🏗️' },
    { key: 'despatch',          label: 'Despatch',           icon: '🚛' },
    { key: 'user_management',   label: 'User Management',    icon: '👥' },
]

const PERMISSIONS = [
    { key: 'can_view',    label: 'View',    Icon: Eye,         color: 'blue' },
    { key: 'can_create',  label: 'Create',  Icon: FilePlus,    color: 'emerald' },
    { key: 'can_edit',    label: 'Edit',    Icon: PenSquare,   color: 'amber' },
    { key: 'can_delete',  label: 'Delete',  Icon: PackageMinus, color: 'red' },
    { key: 'can_approve', label: 'Approve', Icon: CheckSquare, color: 'violet' },
]

const PERM_COLORS = {
    blue:    'text-blue-600 bg-blue-50 border-blue-200',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    amber:   'text-amber-600 bg-amber-50 border-amber-200',
    red:     'text-red-600 bg-red-50 border-red-200',
    violet:  'text-violet-600 bg-violet-50 border-violet-200',
}

function buildDefaultMatrix() {
    const m = {}
    MODULES.forEach(mod => {
        m[mod.key] = {}
        PERMISSIONS.forEach(p => { m[mod.key][p.key] = false })
    })
    return m
}

export default function RoleManagementPage() {
    const { role, isAdmin } = useAuth()

    const [roles, setRoles] = useState([])
    const [loadingRoles, setLoadingRoles] = useState(true)
    const [selectedRole, setSelectedRole] = useState(null)
    const [matrix, setMatrix] = useState(buildDefaultMatrix())
    const [matrixLoading, setMatrixLoading] = useState(false)
    const [savingMatrix, setSavingMatrix] = useState(false)
    const [matrixSaved, setMatrixSaved] = useState(false)

    // New role form
    const [newRoleName, setNewRoleName] = useState('')
    const [newRoleDesc, setNewRoleDesc] = useState('')
    const [creatingRole, setCreatingRole] = useState(false)
    const [roleError, setRoleError] = useState('')

    // Delete
    const [deletingRoleId, setDeletingRoleId] = useState(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    useEffect(() => { fetchRoles() }, [])
    useEffect(() => {
        if (selectedRole) fetchMatrix(selectedRole.id)
        else setMatrix(buildDefaultMatrix())
    }, [selectedRole])

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-100">
                    <ShieldAlert size={40} className="text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-surface-900">Access Denied</h2>
                <p className="text-sm text-surface-700/60 max-w-md">
                    Role Management is restricted to <span className="font-semibold text-red-600">System Admin</span>.
                    Your current role is <span className="font-semibold capitalize text-surface-800">{role}</span>.
                </p>
            </div>
        )
    }

    async function fetchRoles() {
        setLoadingRoles(true)
        const { data } = await supabase.from('custom_roles').select('*').order('role_name')
        setRoles(data || [])
        setLoadingRoles(false)
    }

    async function fetchMatrix(roleId) {
        setMatrixLoading(true)
        const { data } = await supabase
            .from('role_permissions')
            .select('*')
            .eq('role_id', roleId)

        const newMatrix = buildDefaultMatrix()
        if (data) {
            data.forEach(row => {
                if (newMatrix[row.module_name]) {
                    PERMISSIONS.forEach(p => {
                        newMatrix[row.module_name][p.key] = row[p.key] || false
                    })
                }
            })
        }
        setMatrix(newMatrix)
        setMatrixLoading(false)
    }

    async function handleCreateRole(e) {
        e.preventDefault()
        if (!newRoleName.trim()) return setRoleError('Role name is required')
        setCreatingRole(true)
        setRoleError('')
        const { data, error } = await supabase
            .from('custom_roles')
            .insert({ role_name: newRoleName.trim(), description: newRoleDesc.trim() || null })
            .select()
            .single()

        if (error) {
            setRoleError(error.message.includes('unique') ? 'This role name already exists.' : error.message)
        } else {
            setRoles(prev => [...prev, data].sort((a, b) => a.role_name.localeCompare(b.role_name)))
            setSelectedRole(data)
            setNewRoleName('')
            setNewRoleDesc('')
        }
        setCreatingRole(false)
    }

    async function handleDeleteRole(roleId) {
        if (confirmDeleteId !== roleId) {
            setConfirmDeleteId(roleId)
            setTimeout(() => setConfirmDeleteId(null), 4000)
            return
        }
        setDeletingRoleId(roleId)
        await supabase.from('role_permissions').delete().eq('role_id', roleId)
        await supabase.from('custom_roles').delete().eq('id', roleId)
        setRoles(prev => prev.filter(r => r.id !== roleId))
        if (selectedRole?.id === roleId) setSelectedRole(null)
        setDeletingRoleId(null)
        setConfirmDeleteId(null)
    }

    function togglePerm(moduleName, permKey) {
        setMatrix(prev => ({
            ...prev,
            [moduleName]: { ...prev[moduleName], [permKey]: !prev[moduleName][permKey] }
        }))
    }

    function toggleAllForModule(moduleName) {
        const allOn = PERMISSIONS.every(p => matrix[moduleName][p.key])
        setMatrix(prev => ({
            ...prev,
            [moduleName]: Object.fromEntries(PERMISSIONS.map(p => [p.key, !allOn]))
        }))
    }

    async function saveMatrix() {
        if (!selectedRole) return
        setSavingMatrix(true)

        // Delete old permissions for this role
        await supabase.from('role_permissions').delete().eq('role_id', selectedRole.id)

        // Insert new permissions for all modules
        const inserts = MODULES.map(mod => ({
            role_id: selectedRole.id,
            module_name: mod.key,
            ...Object.fromEntries(PERMISSIONS.map(p => [p.key, matrix[mod.key][p.key] || false]))
        }))
        await supabase.from('role_permissions').insert(inserts)

        setSavingMatrix(false)
        setMatrixSaved(true)
        setTimeout(() => setMatrixSaved(false), 3000)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                    <Shield size={22} className="text-violet-500" />
                    Role Management
                </h2>
                <p className="text-sm text-surface-700/60 mt-0.5">Create custom roles and configure granular permissions per module</p>
            </div>

            <div className="grid lg:grid-cols-5 gap-6">
                {/* ── Left: Roles List + Create ── */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Create Role */}
                    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-surface-200 bg-gradient-to-r from-violet-50 to-purple-50 flex items-center gap-2">
                            <Plus size={15} className="text-violet-600" />
                            <h3 className="text-sm font-bold text-surface-800">Create New Role</h3>
                        </div>
                        <form onSubmit={handleCreateRole} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                                    Role Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    value={newRoleName}
                                    onChange={e => { setNewRoleName(e.target.value); setRoleError('') }}
                                    placeholder="e.g. Store Manager"
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                                    Description
                                </label>
                                <input
                                    value={newRoleDesc}
                                    onChange={e => setNewRoleDesc(e.target.value)}
                                    placeholder="Optional description..."
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                                />
                            </div>
                            {roleError && (
                                <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">{roleError}</div>
                            )}
                            <button
                                type="submit"
                                disabled={creatingRole}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25 transition-all disabled:opacity-60"
                            >
                                {creatingRole ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : <><Plus size={14} /> Create Role</>}
                            </button>
                        </form>
                    </div>

                    {/* Roles List */}
                    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-surface-200 bg-surface-50/80 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-surface-800 flex items-center gap-2">
                                <Settings size={14} className="text-surface-500" />
                                Custom Roles ({roles.length})
                            </h3>
                            <button onClick={fetchRoles} className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-100 transition-colors">
                                <RefreshCw size={13} className={loadingRoles ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        <div className="divide-y divide-surface-100">
                            {loadingRoles ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="px-5 py-4">
                                        <div className="h-4 bg-surface-200 rounded animate-pulse w-2/3 mb-1.5" />
                                        <div className="h-3 bg-surface-100 rounded animate-pulse w-1/2" />
                                    </div>
                                ))
                            ) : roles.length === 0 ? (
                                <div className="px-5 py-8 text-center text-sm text-surface-400">
                                    <Lock size={28} className="mx-auto mb-2 opacity-30" />
                                    <p>No custom roles yet.</p>
                                    <p className="text-xs mt-1">Create one above to get started.</p>
                                </div>
                            ) : roles.map(r => (
                                <div
                                    key={r.id}
                                    onClick={() => setSelectedRole(r)}
                                    className={`flex items-center gap-3 px-5 py-4 cursor-pointer transition-all ${
                                        selectedRole?.id === r.id
                                            ? 'bg-violet-50 border-l-4 border-l-violet-500'
                                            : 'hover:bg-surface-50 border-l-4 border-l-transparent'
                                    }`}
                                >
                                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 text-sm font-bold ${
                                        selectedRole?.id === r.id ? 'bg-violet-500 text-white' : 'bg-surface-100 text-surface-500'
                                    }`}>
                                        {r.role_name[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-surface-900 truncate">{r.role_name}</p>
                                        {r.description && <p className="text-xs text-surface-500 truncate mt-0.5">{r.description}</p>}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {confirmDeleteId === r.id ? (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteRole(r.id) }}
                                                    disabled={deletingRoleId === r.id}
                                                    className="px-2 py-1 text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                                                >
                                                    {deletingRoleId === r.id ? '...' : 'Confirm'}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                                                    className="px-2 py-1 text-[11px] font-medium text-surface-600 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <ChevronRight size={14} className={selectedRole?.id === r.id ? 'text-violet-600' : 'text-surface-300'} />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteRole(r.id) }}
                                                    className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                    title="Delete role"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Right: Permissions Matrix ── */}
                <div className="lg:col-span-3">
                    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden h-full">
                        <div className="px-6 py-4 border-b border-surface-200 bg-gradient-to-r from-surface-50 to-surface-100/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-surface-800 flex items-center gap-2">
                                    <Shield size={14} className="text-violet-500" />
                                    {selectedRole ? `Permissions — ${selectedRole.role_name}` : 'Permissions Matrix'}
                                </h3>
                                <p className="text-[11px] text-surface-500 mt-0.5">
                                    {selectedRole ? 'Toggle permissions for each module, then save.' : 'Select a role on the left to configure permissions.'}
                                </p>
                            </div>
                            {selectedRole && (
                                <button
                                    onClick={saveMatrix}
                                    disabled={savingMatrix}
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                                        matrixSaved
                                            ? 'bg-emerald-500 text-white shadow-emerald-500/20 shadow-lg'
                                            : 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-500/25 shadow-lg'
                                    } disabled:opacity-60`}
                                >
                                    {savingMatrix
                                        ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                                        : matrixSaved
                                            ? <><Check size={14} /> Saved!</>
                                            : <><Save size={14} /> Save Permissions</>
                                    }
                                </button>
                            )}
                        </div>

                        {!selectedRole ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100">
                                    <Shield size={32} className="text-surface-300" />
                                </div>
                                <p className="text-sm font-semibold text-surface-500">No role selected</p>
                                <p className="text-xs text-surface-400">Select a role from the left panel to manage its permissions.</p>
                            </div>
                        ) : matrixLoading ? (
                            <div className="px-6 py-8 space-y-4">
                                {MODULES.map((_, i) => (
                                    <div key={i} className="h-12 bg-surface-100 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-surface-50/50 border-b border-surface-100">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-surface-600 uppercase tracking-wider w-44">Module</th>
                                            {PERMISSIONS.map(p => (
                                                <th key={p.key} className="px-3 py-3 text-center text-xs font-bold text-surface-500 uppercase tracking-wider">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <p.Icon size={13} className={`text-${p.color}-500`} />
                                                        <span>{p.label}</span>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="px-3 py-3 text-center text-xs font-bold text-surface-400 uppercase tracking-wider">All</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-100">
                                        {MODULES.map(mod => {
                                            const allOn = PERMISSIONS.every(p => matrix[mod.key]?.[p.key])
                                            return (
                                                <tr key={mod.key} className="hover:bg-surface-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base">{mod.icon}</span>
                                                            <span className="text-sm font-semibold text-surface-800">{mod.label}</span>
                                                        </div>
                                                    </td>
                                                    {PERMISSIONS.map(p => {
                                                        const active = matrix[mod.key]?.[p.key] || false
                                                        return (
                                                            <td key={p.key} className="px-3 py-4 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => togglePerm(mod.key, p.key)}
                                                                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all hover:scale-110 ${
                                                                        active
                                                                            ? `${PERM_COLORS[p.color]} border-current shadow-sm`
                                                                            : 'border-surface-200 bg-white text-surface-200 hover:border-surface-300'
                                                                    }`}
                                                                    title={`${active ? 'Revoke' : 'Grant'} ${p.label} on ${mod.label}`}
                                                                >
                                                                    {active ? <Check size={12} /> : <X size={10} />}
                                                                </button>
                                                            </td>
                                                        )
                                                    })}
                                                    {/* Toggle All */}
                                                    <td className="px-3 py-4 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleAllForModule(mod.key)}
                                                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all hover:scale-110 text-[10px] font-bold ${
                                                                allOn
                                                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-600 shadow-sm'
                                                                    : 'border-surface-200 bg-surface-50 text-surface-400 hover:border-surface-300'
                                                            }`}
                                                            title={allOn ? 'Revoke all' : 'Grant all permissions for this module'}
                                                        >
                                                            {allOn ? '✓' : '—'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>

                                {/* Legend */}
                                <div className="px-6 py-4 border-t border-surface-100 bg-surface-50/50 flex flex-wrap gap-3">
                                    {PERMISSIONS.map(p => (
                                        <span key={p.key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${PERM_COLORS[p.color]}`}>
                                            <p.Icon size={11} /> {p.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
