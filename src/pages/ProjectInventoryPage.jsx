import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import { LayoutGrid, Search, RefreshCw, Box, ArrowRight, Filter, ChevronDown, ChevronUp } from 'lucide-react'

export default function ProjectInventoryPage({ selectedProjectId }) {
    const { user } = useAuth()
    const [despatches, setDespatches] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [expandedProjects, setExpandedProjects] = useState({})

    useEffect(() => {
        fetchDespatches()
    }, [])

    async function fetchDespatches() {
        setLoading(true)
        let query = supabase
            .from('despatches')
            .select('*')
        
        if (selectedProjectId) {
            query = query.eq('project_id', selectedProjectId)
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
        
        if (!error && data) {
            setDespatches(data)
            // Expand all projects by default initially
            const projects = [...new Set(data.map(d => d.project_name))]
            const initialExpanded = {}
            projects.forEach(p => { initialExpanded[p] = true })
            setExpandedProjects(initialExpanded)
        }
        setLoading(false)
    }

    // Group despatches by project name
    const groupedData = despatches.reduce((acc, despatch) => {
        const projectName = despatch.project_name || 'Unassigned Project'
        if (!acc[projectName]) {
            acc[projectName] = {
                name: projectName,
                items: [],
                totalItems: 0,
                lastActivity: despatch.created_at
            }
        }
        acc[projectName].items.push(despatch)
        acc[projectName].totalItems += despatch.quantity_despatched
        // Keep track of the most recent activity for the project
        if (new Date(despatch.created_at) > new Date(acc[projectName].lastActivity)) {
            acc[projectName].lastActivity = despatch.created_at
        }
        return acc
    }, {})

    // Filter projects based on search
    const filteredProjects = Object.values(groupedData).filter(project => {
        const matchesProject = project.name.toLowerCase().includes(search.toLowerCase())
        const matchesItems = project.items.some(item => 
            item.item_name?.toLowerCase().includes(search.toLowerCase()) ||
            item.manufacturer?.toLowerCase().includes(search.toLowerCase())
        )
        return matchesProject || matchesItems
    }).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))

    const toggleProject = (projectName) => {
        setExpandedProjects(prev => ({
            ...prev,
            [projectName]: !prev[projectName]
        }))
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2 uppercase">
                        <LayoutGrid size={22} className="text-brand-500" />
                        Project Despatch History
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">
                        {selectedProjectId ? 'Despatch logs for the selected project' : 'Despatch logs across all projects'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search projects or items..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all w-full sm:w-64"
                        />
                    </div>
                    <button
                        onClick={fetchDespatches}
                        className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 bg-surface-100 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-surface-200">
                    <Box size={48} className="text-surface-200 mb-4" />
                    <p className="text-surface-500 font-medium">No projects or materials found</p>
                    <p className="text-sm text-surface-400">Try adjusting your search criteria</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredProjects.map((project) => (
                        <div 
                            key={project.name}
                            className="bg-white rounded-2xl border border-surface-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                        >
                            {/* Project Header */}
                            <button 
                                onClick={() => toggleProject(project.name)}
                                className="w-full flex items-center justify-between p-5 text-left border-b border-surface-100 bg-surface-50/30 hover:bg-surface-50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold">
                                        {project.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-surface-900">{project.name}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                                                {project.items.length} Unique Items
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-surface-300" />
                                            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                                                {project.totalItems} Total Qty
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Last Activity</p>
                                        <p className="text-xs text-surface-600 font-mono mt-0.5">{formatTimestamp(project.lastActivity)}</p>
                                    </div>
                                    <div className="text-surface-400">
                                        {expandedProjects[project.name] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>
                            </button>

                            {/* Project Details */}
                            {expandedProjects[project.name] && (
                                <div className="overflow-auto" style={{ maxHeight: '50vh' }}>
                                    <table className="w-full text-sm relative">
                                        <thead className="bg-white sticky top-0 z-10 shadow-sm ring-1 ring-surface-100">
                                            <tr className="bg-white border-b border-surface-100 text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                                                <th className="px-6 py-4 text-left">Material / Manufacturer</th>
                                                <th className="px-6 py-4 text-center w-24">Quantity</th>
                                                <th className="px-6 py-4 text-left">Despatched By</th>
                                                <th className="px-6 py-4 text-right">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-100">
                                            {project.items.map((item) => (
                                                <tr key={item.id} className="hover:bg-brand-50/20 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-surface-900">{item.item_name}</div>
                                                        <div className="text-[11px] text-surface-500 font-medium">{item.manufacturer}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg bg-surface-100 text-surface-700 font-black text-xs">
                                                            {item.quantity_despatched}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-surface-600 text-xs font-medium">
                                                        {item.despatched_by}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-xs text-surface-400 font-mono">
                                                        {formatTimestamp(item.created_at)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-surface-50/50">
                                            <tr>
                                                <td colSpan="4" className="px-6 py-3 text-right">
                                                    <span className="text-[10px] font-bold text-surface-400 uppercase mr-3">Combined project output:</span>
                                                    <span className="text-sm font-black text-brand-600">{project.totalItems} Materials</span>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
