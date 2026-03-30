import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import {
    ArrowLeft, Briefcase, FileText, Palette, ShoppingCart, Users, Truck,
    Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, Lock, Settings, ListChecks
} from 'lucide-react'
import DesignTab from '@/components/DesignTab'
import CreateIntentModal from '@/components/CreateIntentModal'
import PurchaseIndentsPage from '@/pages/PurchaseIndentsPage'
import DespatchPage from '@/pages/DespatchPage'
import VendorQuoteSection from '@/components/VendorQuoteSection'
import VendorManagementPage from '@/pages/VendorManagementPage'

const TAB_CONFIG = [
    { id: 'info',    label: 'Info',           icon: Briefcase,   gated: false },
    { id: 'specs',   label: 'Specifications', icon: ListChecks,  gated: false },
    { id: 'design',  label: 'Design Input',   icon: Palette,     gated: false },
    { id: 'intents', label: 'Procurement',    icon: ShoppingCart,gated: true  },
    { id: 'vendors', label: 'Vendors',        icon: Users,       gated: true  },
    { id: 'despatch',label: 'Despatch',       icon: Truck,       gated: true  },
]

export default function ProjectWorkspacePage() {
    const { projectId } = useParams()
    const navigate = useNavigate()
    const { isAdmin, isOwner, user, role } = useAuth()
    const canEdit = isAdmin || isOwner || role === 'manager'

    const [project, setProject] = useState(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('info')
    const [designApproved, setDesignApproved] = useState(false)

    // Specs
    const [specs, setSpecs] = useState([])
    const [specsLoading, setSpecsLoading] = useState(false)
    const [newSpec, setNewSpec] = useState('')
    const [addingSpec, setAddingSpec] = useState(false)

    // Editing project info
    const [editing, setEditing] = useState(false)
    const [editForm, setEditForm] = useState({})
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState('')

    // Delete project
    const [deleteConfirm, setDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        if (projectId) {
            fetchProject()
            fetchSpecs()
        }
    }, [projectId])

    async function fetchProject() {
        setLoading(true)
        const { data, error } = await supabase
            .from('projects_metadata')
            .select('*')
            .eq('id', projectId)
            .single()
        if (!error && data) {
            setProject(data)
            setDesignApproved(data.design_approved || false)
            setEditForm({
                name: data.name || '',
                client: data.client || '',
                client_address: data.client_address || '',
                contact_person: data.contact_person || '',
                contact_number: data.contact_number || '',
                client_email: data.client_email || '',
                status: data.status || 'Active',
            })
        }
        setLoading(false)
    }

    async function fetchSpecs() {
        setSpecsLoading(true)
        const { data } = await supabase
            .from('project_specs')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true })
        setSpecs(data || [])
        setSpecsLoading(false)
    }

    async function addSpec() {
        if (!newSpec.trim()) return
        setAddingSpec(true)
        const { error } = await supabase.from('project_specs').insert({
            project_id: projectId,
            spec_detail: newSpec.trim(),
        })
        if (!error) {
            setNewSpec('')
            fetchSpecs()
        }
        setAddingSpec(false)
    }

    async function deleteSpec(specId) {
        await supabase.from('project_specs').delete().eq('id', specId)
        setSpecs(prev => prev.filter(s => s.id !== specId))
    }

    async function saveProject(e) {
        e.preventDefault()
        setSaving(true)
        setSaveMsg('')
        const { error } = await supabase
            .from('projects_metadata')
            .update({
                name: editForm.name.trim(),
                client: editForm.client.trim(),
                client_address: editForm.client_address?.trim() || null,
                contact_person: editForm.contact_person?.trim() || null,
                contact_number: editForm.contact_number?.trim() || null,
                client_email: editForm.client_email?.trim() || null,
                status: editForm.status,
            })
            .eq('id', projectId)

        if (!error) {
            setSaveMsg('Saved!')
            setEditing(false)
            fetchProject()
            setTimeout(() => setSaveMsg(''), 3000)
        } else {
            setSaveMsg(`Error: ${error.message}`)
        }
        setSaving(false)
    }

    async function handleDeleteProject() {
        if (!deleteConfirm) {
            setDeleteConfirm(true)
            setTimeout(() => setDeleteConfirm(false), 5000)
            return
        }
        setDeleting(true)
        // Cascading delete: specs, designs, purchase_intent_items via headers, then headers, then project
        // Get all indent headers for this project
        const { data: headers } = await supabase
            .from('purchase_intent_headers')
            .select('id')
            .eq('project_id', projectId)

        if (headers?.length > 0) {
            const headerIds = headers.map(h => h.id)
            await supabase.from('purchase_intent_items').delete().in('header_id', headerIds)
            await supabase.from('purchase_intent_headers').delete().in('id', headerIds)
        }

        await supabase.from('project_specs').delete().eq('project_id', projectId)
        await supabase.from('project_designs').delete().eq('project_id', projectId)
        await supabase.from('despatches').delete().eq('project_id', projectId)

        const { error } = await supabase
            .from('projects_metadata')
            .delete()
            .eq('id', projectId)

        if (!error) {
            await supabase.from('activity_logs').insert({
                user_name: user?.user_metadata?.full_name || user?.email || 'User',
                user_role: role,
                action: `Deleted project: ${project?.name || projectId}`,
                entity_type: 'project',
            })
            navigate('/projects')
        } else {
            alert(`Failed to delete project: ${error.message}`)
            setDeleting(false)
            setDeleteConfirm(false)
        }
    }

    function handleDesignUploaded() {
        fetchProject()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-brand-500" />
            </div>
        )
    }

    if (!project) {
        return (
            <div className="py-20 text-center">
                <AlertTriangle size={36} className="mx-auto text-red-300 mb-3" />
                <p className="text-surface-500 font-bold">Project not found</p>
                <button onClick={() => navigate('/projects')} className="mt-4 text-sm text-brand-600 font-semibold hover:underline">
                    ← Back to Projects
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/projects')}
                        className="p-2.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 transition-all active:scale-95"
                    >
                        <ArrowLeft size={18} className="text-surface-600" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                            <Briefcase size={22} className="text-brand-500" />
                            {project.name}
                        </h2>
                        <p className="text-sm text-surface-400 mt-0.5">
                            {project.client || 'No client'} • {project.status}
                            {!designApproved && (
                                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                    <Lock size={10} /> Design Required
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Delete Project (Admin/Owner only) */}
                {canEdit && (
                    <button
                        onClick={handleDeleteProject}
                        disabled={deleting}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                            deleteConfirm
                                ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30'
                                : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                        }`}
                        title="Delete this project and all its data"
                    >
                        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        {deleteConfirm ? 'Confirm Delete Project' : 'Delete Project'}
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1.5 bg-surface-100 rounded-2xl overflow-x-auto">
                {TAB_CONFIG.map(tab => {
                    const isGated = tab.gated && !designApproved
                    const isActive = activeTab === tab.id
                    const Icon = tab.icon

                    return (
                        <button
                            key={tab.id}
                            onClick={() => !isGated && setActiveTab(tab.id)}
                            disabled={isGated}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                                isActive
                                    ? 'bg-white text-brand-600 shadow-md shadow-brand-500/10'
                                    : isGated
                                        ? 'text-surface-300 cursor-not-allowed'
                                        : 'text-surface-500 hover:text-surface-700 hover:bg-white/50'
                            }`}
                            title={isGated ? 'Add a design input first to unlock this tab' : tab.label}
                        >
                            {isGated ? <Lock size={15} /> : <Icon size={15} />}
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in duration-300">

                {/* ─── INFO TAB ─── */}
                {activeTab === 'info' && (
                    <div className="bg-white rounded-3xl border border-surface-200 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                                <Settings size={18} className="text-surface-400" />
                                Project Information
                            </h3>
                            {canEdit && !editing && (
                                <button
                                    onClick={() => setEditing(true)}
                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-surface-100 text-surface-600 hover:bg-brand-50 hover:text-brand-600 transition-all"
                                >
                                    Edit
                                </button>
                            )}
                        </div>

                        {saveMsg && (
                            <div className={`mb-4 px-4 py-2 rounded-xl text-sm font-semibold ${saveMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {saveMsg}
                            </div>
                        )}

                        {editing ? (
                            <form onSubmit={saveProject} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {[
                                    { key: 'name', label: 'Project Name', required: true },
                                    { key: 'client', label: 'Client Name', required: true },
                                    { key: 'client_address', label: 'Client Address' },
                                    { key: 'contact_person', label: 'Contact Person' },
                                    { key: 'contact_number', label: 'Contact Number' },
                                    { key: 'client_email', label: 'Client Email', type: 'email' },
                                ].map(field => (
                                    <div key={field.key} className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">
                                            {field.label} {field.required && <span className="text-red-400">*</span>}
                                        </label>
                                        <input
                                            type={field.type || 'text'}
                                            value={editForm[field.key] || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            required={field.required}
                                            className="w-full bg-surface-50 border-none rounded-xl px-4 py-3 text-sm font-semibold text-surface-900 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all"
                                        />
                                    </div>
                                ))}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Status</label>
                                    <select
                                        value={editForm.status}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                                        className="w-full bg-surface-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-surface-900 focus:ring-4 focus:ring-brand-500/10 transition-all cursor-pointer"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="On Hold">On Hold</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2 flex items-center gap-3 justify-end pt-2">
                                    <button type="button" onClick={() => setEditing(false)} className="px-5 py-2.5 text-sm font-medium rounded-xl text-surface-700 hover:bg-surface-100 transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={saving}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50">
                                        {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { label: 'Project Name', value: project.name },
                                    { label: 'Client', value: project.client },
                                    { label: 'Client Address', value: project.client_address },
                                    { label: 'Contact Person', value: project.contact_person },
                                    { label: 'Contact Number', value: project.contact_number },
                                    { label: 'Client Email', value: project.client_email },
                                    { label: 'Status', value: project.status },
                                    { label: 'Start Date', value: project.start_date },
                                ].map(item => (
                                    <div key={item.label} className="space-y-1">
                                        <div className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{item.label}</div>
                                        <div className="text-sm font-semibold text-surface-900">{item.value || '—'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── SPECIFICATIONS TAB ─── */}
                {activeTab === 'specs' && (
                    <div className="bg-white rounded-3xl border border-surface-200 p-8 shadow-sm space-y-6">
                        <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                            <ListChecks size={18} className="text-brand-500" />
                            Project Specifications
                        </h3>

                        {/* Add spec */}
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={newSpec}
                                onChange={(e) => setNewSpec(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addSpec()}
                                placeholder="Add specification detail..."
                                className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                            />
                            <button
                                onClick={addSpec}
                                disabled={addingSpec || !newSpec.trim()}
                                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/25 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {addingSpec ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Add
                            </button>
                        </div>

                        {/* Specs list */}
                        {specsLoading ? (
                            <div className="space-y-2">
                                {[1,2,3].map(i => <div key={i} className="h-12 bg-surface-100 rounded-xl animate-pulse" />)}
                            </div>
                        ) : specs.length === 0 ? (
                            <div className="py-10 text-center">
                                <ListChecks size={32} className="mx-auto text-surface-200 mb-2" />
                                <p className="text-surface-400 text-sm font-medium">No specifications added yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {specs.map((s, idx) => (
                                    <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-50 border border-surface-100 group hover:border-brand-200 hover:bg-brand-50/30 transition-all">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-100 text-brand-600 text-[10px] font-bold shrink-0">
                                            {idx + 1}
                                        </span>
                                        <span className="flex-1 text-sm text-surface-800 font-medium">{s.spec_detail}</span>
                                        <button
                                            onClick={() => deleteSpec(s.id)}
                                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-surface-400 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── DESIGN INPUT TAB ─── */}
                {activeTab === 'design' && (
                    <DesignTab projectId={projectId} onDesignUploaded={handleDesignUploaded} />
                )}

                {/* ─── PROCUREMENT TAB ─── */}
                {activeTab === 'intents' && designApproved && (
                    <PurchaseIndentsPage selectedProjectId={projectId} />
                )}

                {/* ─── VENDORS TAB ─── */}
                {activeTab === 'vendors' && designApproved && (
                    <div className="space-y-8">
                        {/* Full Vendor Directory */}
                        <div className="bg-white rounded-3xl border border-surface-200 p-6 shadow-sm">
                            <VendorManagementPage />
                        </div>
                        {/* Quote Entry for this Project */}
                        <VendorQuoteSection selectedProjectId={projectId} />
                    </div>
                )}

                {/* ─── DESPATCH TAB ─── */}
                {activeTab === 'despatch' && designApproved && (
                    <DespatchPage selectedProjectId={projectId} />
                )}
            </div>
        </div>
    )
}
