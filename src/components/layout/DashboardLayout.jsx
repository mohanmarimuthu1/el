import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import NotificationToast from '@/components/NotificationToast'

export default function DashboardLayout({ selectedProjectId, setSelectedProjectId }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)

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
                <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
            <NotificationToast />
        </div>
    )
}
