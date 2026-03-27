import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, Palette, Upload, FileText, Download } from 'lucide-react'

export default function DesignTab({ projectId, onDesignUploaded }) {
    const [designs, setDesigns] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [deletingId, setDeletingId] = useState(null)

    // Inline add row
    const [addMode, setAddMode] = useState(false)
    const [newDesc, setNewDesc] = useState('')
    const [newSNo, setNewSNo] = useState('')
    const [newSize, setNewSize] = useState('')
    const [adding, setAdding] = useState(false)

    // File upload for the whole design set
    const [uploading, setUploading] = useState(false)
    const [file, setFile] = useState(null)
    const [designFileName, setDesignFileName] = useState('')

    // Uploaded design files
    const [designFiles, setDesignFiles] = useState([])

    useEffect(() => {
        if (projectId) {
            fetchDesigns()
            fetchDesignFiles()
        }
    }, [projectId])

    async function fetchDesigns() {
        setLoading(true)
        const { data, error } = await supabase
            .from('project_designs')
            .select('*')
            .eq('project_id', projectId)
            .is('file_url', null)
            .order('s_no', { ascending: true })
        if (!error) setDesigns(data || [])
        setLoading(false)
    }

    async function fetchDesignFiles() {
        const { data } = await supabase
            .from('project_designs')
            .select('*')
            .eq('project_id', projectId)
            .not('file_url', 'is', null)
            .order('created_at', { ascending: false })
        setDesignFiles(data || [])
    }

    async function addDesignRow() {
        if (!newDesc.trim()) return setError('Description is required')
        setAdding(true)
        setError('')

        const { error: insertErr } = await supabase
            .from('project_designs')
            .insert({
                project_id: projectId,
                s_no: parseInt(newSNo) || (designs.length + 1),
                design_name: `Item ${designs.length + 1}`,
                description: newDesc.trim(),
                size: newSize.trim() || null,
            })

        if (insertErr) {
            setError(insertErr.message)
        } else {
            // Mark design_approved = true on first design entry
            if (designs.length === 0) {
                await supabase
                    .from('projects_metadata')
                    .update({ design_approved: true })
                    .eq('id', projectId)
                onDesignUploaded?.()
            }
            setNewDesc('')
            setNewSNo('')
            setNewSize('')
            setAddMode(false)
            fetchDesigns()
        }
        setAdding(false)
    }

    async function handleDelete(id) {
        if (!confirm('Delete this design entry?')) return
        setDeletingId(id)

        await supabase.from('project_designs').delete().eq('id', id)

        // If no designs remain (ledger entries), un-approve
        const { data: remaining } = await supabase
            .from('project_designs')
            .select('id')
            .eq('project_id', projectId)
            .is('file_url', null)
            .limit(1)

        if (!remaining || remaining.length === 0) {
            await supabase
                .from('projects_metadata')
                .update({ design_approved: false })
                .eq('id', projectId)
            onDesignUploaded?.()
        }

        setDeletingId(null)
        fetchDesigns()
    }

    async function handleFileUpload(e) {
        e.preventDefault()
        if (!file) return setError('Select a file')
        if (!designFileName.trim()) return setError('File name is required')

        setUploading(true)
        setError('')
        try {
            const ext = file.name.split('.').pop()
            const filePath = `${projectId}/${Date.now()}_${designFileName.trim().replace(/\s+/g, '_')}.${ext}`

            const { error: uploadErr } = await supabase.storage
                .from('project-designs')
                .upload(filePath, file)

            if (uploadErr) throw uploadErr

            const { data: urlData } = supabase.storage
                .from('project-designs')
                .getPublicUrl(filePath)

            await supabase.from('project_designs').insert({
                project_id: projectId,
                design_name: designFileName.trim(),
                file_url: urlData.publicUrl,
            })

            setSuccess('File uploaded!')
            setFile(null)
            setDesignFileName('')
            const fi = document.getElementById('design-file-upload')
            if (fi) fi.value = ''
            fetchDesignFiles()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(`Upload failed: ${err.message}`)
        } finally {
            setUploading(false)
        }
    }

    async function deleteFile(design) {
        if (!confirm(`Delete "${design.design_name}"?`)) return
        setDeletingId(design.id)
        try {
            if (design.file_url) {
                const urlParts = design.file_url.split('/project-designs/')
                if (urlParts[1]) {
                    await supabase.storage.from('project-designs').remove([urlParts[1]])
                }
            }
            await supabase.from('project_designs').delete().eq('id', design.id)
            fetchDesignFiles()
        } catch (err) {
            setError(`Delete failed: ${err.message}`)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-8">
            {/* Design Input List (Ledger) */}
            <div className="bg-white rounded-3xl border border-surface-200 overflow-hidden shadow-sm">
                <div className="px-8 py-5 border-b border-surface-100 bg-surface-50/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-surface-800 uppercase tracking-wider flex items-center gap-2">
                        <Palette size={16} className="text-violet-500" />
                        Design Input List
                    </h3>
                    <button
                        onClick={() => setAddMode(!addMode)}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-md shadow-violet-500/25 transition-all active:scale-95"
                    >
                        <Plus size={13} />
                        Add Entry
                    </button>
                </div>

                {/* Toasts */}
                {error && (
                    <div className="mx-8 mt-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}
                {success && (
                    <div className="mx-8 mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
                        <CheckCircle2 size={16} /> {success}
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-surface-50">
                            <tr className="border-b border-surface-200">
                                <th className="px-8 py-3 font-semibold text-xs uppercase text-surface-500 w-20 text-center">S.No</th>
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500">Description</th>
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500 w-40">Size in MM</th>
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500 w-16 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {/* Add Row */}
                            {addMode && (
                                <tr className="bg-violet-50/30">
                                    <td className="px-8 py-3 text-center">
                                        <input
                                            type="number"
                                            value={newSNo}
                                            onChange={(e) => setNewSNo(e.target.value)}
                                            placeholder={designs.length + 1}
                                            className="w-16 px-2 py-2 text-sm text-center font-bold rounded-lg border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                                        />
                                    </td>
                                    <td className="px-5 py-3">
                                        <input
                                            type="text"
                                            value={newDesc}
                                            onChange={(e) => setNewDesc(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addDesignRow()}
                                            placeholder="Enter description..."
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                                            autoFocus
                                        />
                                    </td>
                                    <td className="px-5 py-3">
                                        <input
                                            type="text"
                                            value={newSize}
                                            onChange={(e) => setNewSize(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addDesignRow()}
                                            placeholder="e.g. 100x200"
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                                        />
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        <button
                                            onClick={addDesignRow}
                                            disabled={adding}
                                            className="p-1.5 rounded-lg bg-violet-500 text-white hover:bg-violet-600 transition-all disabled:opacity-50"
                                        >
                                            {adding ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                        </button>
                                    </td>
                                </tr>
                            )}

                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-10 text-center">
                                        <Loader2 size={24} className="mx-auto animate-spin text-surface-300 mb-2" />
                                        <p className="text-xs text-surface-400">Loading...</p>
                                    </td>
                                </tr>
                            ) : designs.length === 0 && !addMode ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center">
                                        <Palette size={32} className="mx-auto text-surface-200 mb-2" />
                                        <p className="text-surface-500 font-semibold text-sm">No design entries yet</p>
                                        <p className="text-xs text-surface-400 mt-1">Add entries to unlock downstream modules</p>
                                    </td>
                                </tr>
                            ) : (
                                designs.map((d, idx) => (
                                    <tr key={d.id} className="hover:bg-surface-50/50 transition-colors group">
                                        <td className="px-8 py-3.5 text-center">
                                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 text-xs font-bold">
                                                {d.s_no || (idx + 1)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 font-medium text-surface-900">{d.description || d.design_name}</td>
                                        <td className="px-5 py-3.5 text-surface-600 font-mono text-xs">{d.size || '—'}</td>
                                        <td className="px-5 py-3.5 text-center">
                                            <button
                                                onClick={() => handleDelete(d.id)}
                                                disabled={deletingId === d.id}
                                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-surface-400 hover:text-red-500 transition-all disabled:opacity-50"
                                            >
                                                {deletingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Optional File Upload */}
            <div className="bg-white rounded-3xl border border-surface-200 p-8 shadow-sm">
                <h3 className="text-sm font-bold text-surface-800 uppercase tracking-wider flex items-center gap-2 mb-5">
                    <Upload size={16} className="text-violet-500" />
                    Attach Design File (Optional)
                </h3>
                <form onSubmit={handleFileUpload} className="flex flex-col sm:flex-row items-end gap-3">
                    <div className="flex-1 space-y-1.5 w-full">
                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">File Name</label>
                        <input
                            type="text"
                            value={designFileName}
                            onChange={(e) => setDesignFileName(e.target.value)}
                            placeholder="e.g. GA Drawing Rev.2"
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                        />
                    </div>
                    <div className="flex-1 space-y-1.5 w-full">
                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">File</label>
                        <input
                            id="design-file-upload"
                            type="file"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.svg"
                            className="w-full px-4 py-2 text-sm rounded-xl border border-surface-200 bg-white file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-600 hover:file:bg-violet-100 transition-all cursor-pointer"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={uploading}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25 transition-all active:scale-95 disabled:opacity-60 whitespace-nowrap"
                    >
                        {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                </form>

                {/* Uploaded files */}
                {designFiles.length > 0 && (
                    <div className="mt-5 divide-y divide-surface-100 border border-surface-100 rounded-xl overflow-hidden">
                        {designFiles.map(f => (
                            <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50/50 transition-colors group">
                                <FileText size={16} className="text-violet-400" />
                                <span className="flex-1 text-sm font-medium text-surface-800 truncate">{f.design_name}</span>
                                <div className="flex items-center gap-1.5">
                                    {f.file_url && (
                                        <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                                            className="p-1.5 rounded-lg hover:bg-brand-50 text-surface-400 hover:text-brand-600 transition-all">
                                            <Download size={14} />
                                        </a>
                                    )}
                                    <button
                                        onClick={() => deleteFile(f)}
                                        disabled={deletingId === f.id}
                                        className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500 transition-all disabled:opacity-50"
                                    >
                                        {deletingId === f.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
