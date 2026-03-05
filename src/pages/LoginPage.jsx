import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Eye, EyeOff, Loader2, AlertCircle, Lock, Mail, ArrowRight } from 'lucide-react'

export default function LoginPage() {
    const navigate = useNavigate()
    const [form, setForm] = useState({ email: '', password: '' })
    const [remember, setRemember] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [shakeError, setShakeError] = useState(false)

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value })
        if (error) setError('')
    }

    function triggerShake() {
        setShakeError(true)
        setTimeout(() => setShakeError(false), 600)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        if (!form.email.trim()) {
            setError('Please enter your email address')
            triggerShake()
            return
        }
        if (!form.password) {
            setError('Please enter your password')
            triggerShake()
            return
        }

        setLoading(true)

        // Authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: form.email.trim(),
            password: form.password,
        })

        if (authError) {
            setLoading(false)
            // Pristine error messages
            if (authError.message?.includes('Invalid login')) {
                setError('The email or password you entered is incorrect. Please try again.')
            } else if (authError.message?.includes('Email not confirmed')) {
                setError('Your account has not been verified. Please check your inbox.')
            } else if (authError.message?.includes('Too many requests')) {
                setError('Too many login attempts. Please wait a moment and try again.')
            } else {
                setError('Unable to sign in at this time. Please try again later.')
            }
            triggerShake()
            return
        }

        const userId = authData?.user?.id
        if (!userId) {
            setLoading(false)
            setError('Authentication failed. Please contact your administrator.')
            triggerShake()
            return
        }

        // Fetch user role for redirect (best-effort — AuthProvider also fetches)
        let userRole = 'owner' // fallback
        try {
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId)
                .single()

            if (roleData?.role) {
                userRole = roleData.role
            }
        } catch {
            // Network issues — proceed with default redirect, AuthProvider will resolve role
        }

        // Role-based redirect
        if (userRole === 'supervisor') {
            navigate('/purchase-intents', { replace: true })
        } else {
            // owner, manager, admin → dashboard
            navigate('/', { replace: true })
        }
    }

    async function handleForgotPassword() {
        if (!form.email.trim()) {
            setError('Please enter your email address first, then click Forgot Password.')
            triggerShake()
            return
        }

        setLoading(true)
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
            redirectTo: `${window.location.origin}/`,
        })

        setLoading(false)
        if (resetError) {
            setError('Unable to send reset email. Please verify your email address.')
        } else {
            setError('')
            alert('Password reset link has been sent to your email.')
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-surface-50 via-brand-50/30 to-surface-100 relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-200/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-brand-300/15 rounded-full blur-3xl" />
                <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-accent-400/8 rounded-full blur-3xl" />
                {/* Subtle grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.015]"
                    style={{
                        backgroundImage: `radial-gradient(circle, #3b4ee8 1px, transparent 1px)`,
                        backgroundSize: '24px 24px',
                    }}
                />
            </div>

            {/* Login Card */}
            <div
                className={`relative z-10 w-full max-w-md mx-4 ${shakeError ? 'animate-shake' : ''}`}
            >
                {/* Logo + Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full shadow-xl shadow-surface-900/20 mb-5 overflow-hidden bg-white">
                        <img src="/elman-logo.jpeg" alt="Elman Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl tracking-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                        <span style={{ color: '#1a2250', fontWeight: 700 }}>el</span>
                        <span style={{ color: '#b91c1c', fontWeight: 700 }}>man</span>
                        <span className="text-surface-400 mx-1">-</span>
                        <span style={{ color: '#1a2250', fontWeight: 600, fontSize: '0.85em', letterSpacing: '0.05em' }}>FURNACE PRIVATE LIMITED</span>
                    </h1>
                    <p className="text-sm text-surface-700/60 mt-1.5 font-medium tracking-wide uppercase">
                        Enterprise Resource Planner
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl border border-surface-200/80 shadow-xl shadow-surface-900/8 overflow-hidden">
                    {/* Card header bar */}
                    <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-brand-600" />

                    <div className="p-8">
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-surface-900">Welcome back</h2>
                            <p className="text-sm text-surface-700/50 mt-0.5">Sign in to your account to continue</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email field */}
                            <div className="space-y-1.5">
                                <label htmlFor="login-email" className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-300" />
                                    <input
                                        id="login-email"
                                        type="email"
                                        name="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder="you@elman.co"
                                        autoComplete="email"
                                        className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-surface-200 bg-surface-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder:text-surface-300"
                                    />
                                </div>
                            </div>

                            {/* Password field */}
                            <div className="space-y-1.5">
                                <label htmlFor="login-password" className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-300" />
                                    <input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        className="w-full pl-10 pr-11 py-3 text-sm rounded-xl border border-surface-200 bg-surface-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder:text-surface-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-surface-400 hover:text-surface-600 transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Remember me + Forgot password */}
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={remember}
                                        onChange={(e) => setRemember(e.target.checked)}
                                        className="w-4 h-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/20 cursor-pointer"
                                    />
                                    <span className="text-xs font-medium text-surface-600 group-hover:text-surface-800 transition-colors">
                                        Remember me
                                    </span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-xs font-semibold text-brand-500 hover:text-brand-700 transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200/80 px-4 py-3 animate-fadeIn">
                                    <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                                    <p className="text-sm text-red-700 font-medium leading-snug">{error}</p>
                                </div>
                            )}

                            {/* Submit button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-[11px] text-surface-700/40 mt-6 font-medium">
                    © {new Date().getFullYear()} Elman - Furnace Private Limited. All rights reserved.
                </p>
            </div>

            {/* Custom animations */}
            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.5s ease-in-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    )
}
