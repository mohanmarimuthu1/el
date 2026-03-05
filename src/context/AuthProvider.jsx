import { createContext, useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

export const AuthContext = createContext(null)

const ROLES = ['supervisor', 'owner', 'manager', 'admin']

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [role, setRole] = useState('owner') // default demo role
    const [loading, setLoading] = useState(true)
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
    }

    // Demo role toggle (when no auth user)
    const setDemoRole = (newRole) => {
        if (ROLES.includes(newRole)) setRole(newRole)
    }

    const isAdmin = role === 'admin'
    const isOwner = role === 'owner'
    const canViewFinancials = role === 'owner' || role === 'manager' || role === 'admin'
    const canManageInventory = role === 'owner' || role === 'manager' || role === 'admin'

    return (
        <AuthContext.Provider value={{
            user,
            role,
            loading,
            isAdmin,
            isOwner,
            canViewFinancials,
            canManageInventory,
            signIn,
            signOut,
            setDemoRole,
            availableRoles: ROLES,
        }}>
            {children}
        </AuthContext.Provider>
    )
}
