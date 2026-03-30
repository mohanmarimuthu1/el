import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthProvider'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import InventoryPage from '@/pages/InventoryPage'
import PurchaseIndentsPage from '@/pages/PurchaseIndentsPage'
import VendorManagementPage from '@/pages/VendorManagementPage'
import PublicInventoryPage from '@/pages/PublicInventoryPage'
import AuditLogPage from '@/pages/AuditLogPage'
import DespatchPage from '@/pages/DespatchPage'
import PurchaseEntriesPage from '@/pages/PurchaseEntriesPage'
import ProjectInventoryPage from '@/pages/ProjectInventoryPage'
import AdminUserManagementPage from '@/pages/AdminUserManagementPage'
import RoleManagementPage from '@/pages/RoleManagementPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ProjectWorkspacePage from '@/pages/ProjectWorkspacePage'
import CompanyPaymentsPage from '@/pages/CompanyPaymentsPage'
import EmployeeWorklogPage from '@/pages/EmployeeWorklogPage'
import ProjectGuard from '@/components/ProjectGuard'

// Guard: If not logged in, redirect to /login
function RequireAuth({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg animate-pulse overflow-hidden bg-white">
            <img src="/elman-logo.jpeg" alt="Elman" className="w-full h-full object-contain" />
          </div>
          <p className="text-xs text-surface-700/50 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Guard: If already logged in, redirect away from /login
function RedirectIfAuth({ children }) {
  const { user, loading, role } = useAuth()

  if (loading) return null

  if (user) {
    // Role-based redirect
    if (role === 'supervisor') {
      return <Navigate to="/purchase-intents" replace />
    }
    return <Navigate to="/" replace />
  }

  return children
}

export default function App() {
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="inventory/public" element={<PublicInventoryPage />} />
          <Route path="inventory/public/:id" element={<PublicInventoryPage />} />

          {/* Login — redirects to dashboard if already signed in */}
          <Route
            path="/login"
            element={
              <RedirectIfAuth>
                <LoginPage />
              </RedirectIfAuth>
            }
          />

          {/* Authenticated dashboard routes */}
          <Route
            element={
              <RequireAuth>
                <DashboardLayout
                  selectedProjectId={selectedProjectId}
                  setSelectedProjectId={setSelectedProjectId}
                />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="purchase-entries" element={<PurchaseEntriesPage />} />
            <Route path="purchase-intents" element={<PurchaseIndentsPage selectedProjectId={selectedProjectId} />} />
            <Route path="vendors" element={<VendorManagementPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="despatch" element={<DespatchPage selectedProjectId={selectedProjectId} />} />
            <Route path="projects" element={<ProjectsPage setSelectedProjectId={setSelectedProjectId} />} />
            <Route path="projects/:projectId" element={<ProjectWorkspacePage />} />
            <Route path="project-usage" element={<ProjectInventoryPage selectedProjectId={selectedProjectId} />} />
            <Route path="worklogs" element={<EmployeeWorklogPage />} />
            <Route path="user-management" element={<AdminUserManagementPage />} />
            <Route path="role-management" element={<RoleManagementPage />} />
          </Route>

          <Route
            path="company-payments"
            element={
              <RequireAuth>
                <div className="min-h-screen bg-surface-50 p-4 md:p-8">
                  <CompanyPaymentsPage />
                </div>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
