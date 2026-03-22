import { Navigate } from 'react-router-dom'
import { Briefcase, ArrowRight, Lock } from 'lucide-react'

export default function ProjectGuard({ selectedProjectId, children }) {
    if (!selectedProjectId) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="text-center max-w-md">
                    {/* Glassmorphism overlay card */}
                    <div className="relative bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-surface-200/60 shadow-2xl shadow-surface-900/10 p-10 overflow-hidden">
                        {/* Decorative gradient */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-brand-400/20 to-violet-400/20 rounded-full blur-3xl" />
                        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-gradient-to-br from-amber-400/10 to-brand-400/15 rounded-full blur-3xl" />
                        
                        <div className="relative">
                            <div className="flex items-center justify-center mb-6">
                                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-xl shadow-brand-500/30 rotate-3 hover:rotate-0 transition-transform duration-500">
                                    <Lock size={32} className="text-white" />
                                </div>
                            </div>

                            <h2 className="text-2xl font-extrabold text-surface-900 tracking-tight mb-2">
                                Selection Required
                            </h2>
                            <p className="text-sm text-surface-500 font-medium leading-relaxed mb-8">
                                Please select a project to access this module. All operations are scoped to a specific project context.
                            </p>

                            <a
                                href="/projects"
                                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold text-sm shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 hover:from-brand-600 hover:to-brand-700 transition-all active:scale-95"
                            >
                                <Briefcase size={16} />
                                Go to Projects
                                <ArrowRight size={16} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return children
}
