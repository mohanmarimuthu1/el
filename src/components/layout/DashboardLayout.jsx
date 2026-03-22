import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import NotificationToast from '@/components/NotificationToast'
import { supabase } from '@/lib/supabaseClient'
import { Briefcase, X, ExternalLink } from 'lucide-react'

export default function DashboardLayout({ selectedProjectId, setSelectedProjectId }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [projectName, setProjectName] = useState('')
    const [clientName, setClientName] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        if (selectedProjectId) {
            fetchProjectInfo()
        } else {
            setProjectName('')
            setClientName('')
        }
    }, [selectedProjectId])

    async function fetchProjectInfo() {
        const { data } = await supabase
            .from('projects_metadata')
            .select('name, client')
            .eq('id', selectedProjectId)
            .single()
        if (data) {
            setProjectName(data.name)
            setClientName(data.client)
        }
    }

    return (
        <div className="min-h-screen bg-surface-50">
            <Header 
                sidebarOpen={sidebarOpen} 
                setSidebarOpen={setSidebarOpen} 
                selectedProjectId={selectedProjectId}
                setSelectedProjectId={setSelectedProjectId}
            />
            <div className="flex">
                <Sidebar 
                    open={sidebarOpen} 
                    setOpen={setSidebarOpen} 
                    selectedProjectId={selectedProjectId}
                    setSelectedProjectId={setSelectedProjectId}
                />
                <main className="flex-1 min-w-0">
                    {/* Sticky Project Header */}
                    {selectedProjectId && projectName && (
                        <div className="sticky top-0 z-30 bg-gradient-to-r from-brand-500/5 via-brand-500/8 to-violet-500/5 backdrop-blur-xl border-b border-brand-200/30">
                            <div className="px-4 md:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 shrink-0">
                                        <Briefcase size={14} className="text-brand-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-brand-700 truncate">{projectName}</span>
                                            <span className="text-[10px] text-surface-400 font-medium truncate hidden sm:inline">• {clientName}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => navigate(`/projects/${selectedProjectId}`)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-brand-600 hover:bg-brand-500/10 transition-all"
                                        title="Open workspace"
                                    >
                                        <ExternalLink size={11} />
                                        <span className="hidden sm:inline">Open</span>
                                    </button>
                                    <button
                                        onClick={() => setSelectedProjectId(null)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-surface-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                        title="Deselect project"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="p-4 md:p-6 lg:p-8">
                        <Outlet />
                    </div>
                </main>
            </div>
            <NotificationToast />
        </div>
    )
}
