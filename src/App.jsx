import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthProvider'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import InventoryPage from '@/pages/InventoryPage'
import PurchaseIntentsPage from '@/pages/PurchaseIntentsPage'
import VendorManagementPage from '@/pages/VendorManagementPage'
import PublicInventoryPage from '@/pages/PublicInventoryPage'
import AuditLogPage from '@/pages/AuditLogPage'
import DispatchPage from '@/pages/DispatchPage'
import ProjectInventoryPage from '@/pages/ProjectInventoryPage'
import AdminUserManagementPage from '@/pages/AdminUserManagementPage'

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

function AppRoutes() {
  return (
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
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="purchase-intents" element={<PurchaseIntentsPage />} />
        <Route path="vendors" element={<VendorManagementPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="dispatch" element={<DispatchPage />} />
        <Route path="projects" element={<ProjectInventoryPage />} />
        <Route path="user-management" element={<AdminUserManagementPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
