import { createContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

export const AuthContext = createContext(null)

const ROLES = ['supervisor', 'owner', 'manager', 'admin', 'store', 'employee']

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [role, setRole] = useState('owner') // default demo role
    const [loading, setLoading] = useState(true)
    const [userPermissions, setUserPermissions] = useState({}) // { module: { can_view, ... } }
    const initializedRef = useRef(false)

    // Fetch role from user_roles table with a timeout to prevent hanging
    async function fetchUserRole(userId) {
        try {
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), 5000)
            )
            const query = supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId)
                .single()

            const { data, error } = await Promise.race([query, timeout])

            if (!error && data?.role) {
                setRole(data.role)
                return data.role
            }
        } catch (e) {
            // Timeout or network error — fall through to fallback
            console.warn('fetchUserRole failed:', e.message)
        }
        return null
    }

    async function fetchUserPermissions(fetchedRole) {
        if (!fetchedRole) return
        try {
            const { data: customRole } = await supabase
                .from('custom_roles')
                .select('id')
                .eq('role_name', fetchedRole)
                .maybeSingle()
            if (!customRole) return
            const { data: perms } = await supabase
                .from('role_permissions')
                .select('*')
                .eq('role_id', customRole.id)
            if (perms) {
                const map = {}
                perms.forEach(p => { map[p.module_name] = { can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit, can_delete: p.can_delete, can_approve: p.can_approve } })
                setUserPermissions(map)
            }
        } catch (e) { console.warn('fetchUserPermissions failed:', e.message) }
    }

    useEffect(() => {
        let cancelled = false

        async function init() {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (cancelled) return

                const u = session?.user ?? null
                setUser(u)

                if (u) {
                    const fetchedRole = await fetchUserRole(u.id)
                    if (cancelled) return
                    if (!fetchedRole && u.user_metadata?.role) {
                        setRole(u.user_metadata.role)
                    }
                    fetchUserPermissions(fetchedRole || u.user_metadata?.role)
                }
            } catch (e) {
                console.warn('Auth init failed:', e.message)
            } finally {
                if (!cancelled) {
                    setLoading(false)
                    initializedRef.current = true
                }
            }
        }
        init()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const u = session?.user ?? null
            setUser(u)

            if (u) {
                const fetchedRole = await fetchUserRole(u.id)
                if (!fetchedRole && u.user_metadata?.role) {
                    setRole(u.user_metadata.role)
                }
            } else {
                setRole('owner')
                setUserPermissions({})
            }

            // Only clear loading if init hasn't done it yet
            if (!initializedRef.current) {
                setLoading(false)
                initializedRef.current = true
            }
        })

        return () => {
            cancelled = true
            subscription.unsubscribe()
        }
    }, [])

    const signIn = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password })
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setRole('owner')
        setUserPermissions({})
    }

    // Demo role toggle (when no auth user)
    const setDemoRole = (newRole) => {
        if (ROLES.includes(newRole)) setRole(newRole)
    }

    const isAdmin = role === 'admin'
    const isOwner = role === 'owner'
    const canViewFinancials = role === 'owner' || role === 'manager' || role === 'admin'
    const canManageInventory = role === 'owner' || role === 'manager' || role === 'admin'
    const canCreateProject = true

    // Permission helper: admin/owner always pass; others check custom role permissions
    const hasPermission = useCallback((module, action) => {
        if (role === 'admin' || role === 'owner') return true
        const modPerms = userPermissions[module]
        if (!modPerms) return true // No custom role config — allow by default
        return modPerms[action] === true
    }, [role, userPermissions])

    return (
        <AuthContext.Provider value={{
            user,
            role,
            loading,
            isAdmin,
            isOwner,
            canViewFinancials,
            canManageInventory,
            canCreateProject,
            userPermissions,
            hasPermission,
            signIn,
            signOut,
            setDemoRole,
            availableRoles: ROLES,
        }}>
            {children}
        </AuthContext.Provider>
    )
}
