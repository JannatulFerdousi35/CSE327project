import { useState, useRef } from 'react'
import { Eye, EyeOff, Leaf, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import type { AuthUser } from '../App'

type Props = { onLogin: (user: AuthUser) => void; onSignup: () => void }

export default function LoginPage({ onLogin, onSignup }: Props) {
  const [showPw, setShowPw] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [lang, setLang] = useState<'en' | 'bn'>('en')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailBlurred, setEmailBlurred] = useState(false)
  const [passwordBlurred, setPasswordBlurred] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const showEmailError = emailBlurred && email.length > 0 && !isEmailValid
  const showPasswordError = passwordBlurred && password.length > 0 && password.length < 8

  const handleSubmit = async () => {
    setError('')
    setSuccess('')

    if (!email.trim() || !password) {
      setError(lang === 'bn' ? 'ইমেইল এবং পাসওয়ার্ড প্রয়োজন।' : 'Please enter both email and password.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json() as { success?: boolean; user?: AuthUser; message?: string }

      if (!response.ok || !data.success || !data.user) {
        throw new Error(data.message || 'Invalid email or password.')
      }

      setSuccess(lang === 'bn' ? 'সফলভাবে লগ ইন হয়েছে!' : 'Login successful! Redirecting...')
      setTimeout(() => onLogin(data.user!), 600)
    } catch (submitError) {
      console.error('Login failed:', submitError)
      if (submitError instanceof TypeError) {
        setError(lang === 'bn' ? 'সার্ভারের সাথে সংযোগ করা যায়নি। পরে আবার চেষ্টা করুন।' : 'Unable to connect to the server. Please try again later.')
      } else {
        setError(lang === 'bn' ? 'ভুল ইমেইল বা পাসওয়ার্ড। আবার চেষ্টা করুন।' : 'Invalid email or password. Please check your credentials and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left — illustration panel */}
      <div className="hidden lg:flex flex-col w-[44%] relative overflow-hidden bg-gradient-to-br from-green-600 via-emerald-600 to-green-700">
        <img
          src="https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=900&h=1100&fit=crop&auto=format"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-green-600/80 via-emerald-600/60 to-green-800/80" />

        <div className="relative flex-1 flex flex-col justify-between p-10 xl:p-12 z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center">
              <Leaf size={21} className="text-white" />
            </div>
            <div>
              <div className="text-white font-700 text-[15px] leading-tight">Community Action Bridge</div>
              <div className="text-green-100/80 text-[11px]">Bangladesh Community Platform</div>
            </div>
          </div>

          {/* Main message */}
          <div>
            <h2 className="text-3xl xl:text-4xl font-800 text-white leading-[1.15] mb-4">
              Together, we can make our communities better.
            </h2>
            <p className="text-green-50 text-base mb-1.5">
              আমাদের সম্প্রদায়কে একসাথে আরও ভালো করি।
            </p>
            <p className="text-green-100/60 text-sm leading-relaxed max-w-sm">
              A platform connecting residents, volunteers, and administrators to identify and solve community problems across Bangladesh.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { emoji: '📍', value: '12,000+', label: 'Issues Reported' },
              { emoji: '🤝', value: '8,400+', label: 'Volunteers' },
              { emoji: '✅', value: '5,200+', label: 'Problems Solved' },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-3 py-3.5 text-center">
                <div className="text-lg mb-1">{s.emoji}</div>
                <div className="text-white font-700 text-sm leading-none">{s.value}</div>
                <div className="text-green-100/70 text-[10px] mt-1 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 bg-white">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center shadow-md shadow-green-200">
              <Leaf size={18} className="text-white" />
            </div>
            <span className="font-700 text-slate-800 text-[15px]">Community Action Bridge</span>
          </div>

          {/* Language switcher */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-8 w-40" role="tablist" aria-label="Language selection">
            <button
              role="tab"
              aria-selected={lang === 'en'}
              onClick={() => setLang('en')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-700 transition-all cursor-pointer ${lang === 'en' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              English
            </button>
            <button
              role="tab"
              aria-selected={lang === 'bn'}
              onClick={() => setLang('bn')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-700 transition-all cursor-pointer ${lang === 'bn' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              বাংলা
            </button>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-700 text-slate-900 mb-1.5">
            {lang === 'bn' ? 'স্বাগতম!' : 'Welcome Back'}
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            {lang === 'bn'
              ? 'আপনার কমিউনিটি পরিবর্তন করুন। লগ ইন করুন।'
              : 'Sign in to continue making a difference in your community.'}
          </p>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 mb-5 bg-red-50 border border-red-200 rounded-xl" role="alert">
              <AlertCircle size={17} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 leading-snug">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-start gap-2.5 p-3.5 mb-5 bg-green-50 border border-green-200 rounded-xl" role="status">
              <CheckCircle size={17} className="text-green-500 mt-0.5 shrink-0" />
              <p className="text-sm text-green-700 leading-snug">{success}</p>
            </div>
          )}

          <form
            ref={formRef}
            onSubmit={(e) => { e.preventDefault(); void handleSubmit() }}
            className="space-y-5"
            noValidate
          >
            {/* Email */}
            <div>
              <label htmlFor="cab-login-email" className="block text-sm font-600 text-slate-700 mb-1.5">
                {lang === 'bn' ? 'ইমেইল ঠিকানা' : 'Email address'}
              </label>
              <input
                id="cab-login-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); if (emailBlurred) setEmailBlurred(false) }}
                onBlur={() => setEmailBlurred(true)}
                placeholder="rahim.khan@example.com"
                autoComplete="email"
                aria-invalid={showEmailError}
                aria-describedby={showEmailError ? 'cab-login-email-error' : undefined}
                disabled={loading}
                className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm text-slate-800 placeholder-slate-400 transition-all focus:ring-2 focus:ring-green-200 focus:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                  showEmailError ? 'border-red-300 focus:ring-red-100 focus:border-red-400' : 'border-slate-200'
                }`}
              />
              {showEmailError && (
                <p id="cab-login-email-error" className="mt-1.5 text-xs text-red-600" role="alert">
                  {lang === 'bn' ? 'সঠিক ইমেইল ঠিকানা লিখুন।' : 'Please enter a valid email address.'}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="cab-login-password" className="block text-sm font-600 text-slate-700 mb-1.5">
                {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
              </label>
              <div className="relative">
                <input
                  id="cab-login-password"
                  ref={passwordInputRef}
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); if (passwordBlurred) setPasswordBlurred(false) }}
                  onBlur={() => setPasswordBlurred(true)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={showPasswordError}
                  aria-describedby={showPasswordError ? 'cab-login-password-error' : undefined}
                  disabled={loading}
                  className={`w-full px-4 py-3 pr-12 bg-slate-50 border rounded-xl text-sm text-slate-800 placeholder-slate-400 transition-all focus:ring-2 focus:ring-green-200 focus:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                    showPasswordError ? 'border-red-300 focus:ring-red-100 focus:border-red-400' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => { setShowPw(!showPw); passwordInputRef.current?.focus() }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {showPasswordError && (
                <p id="cab-login-password-error" className="mt-1.5 text-xs text-red-600" role="alert">
                  {lang === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।' : 'Password must be at least 8 characters.'}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || success.length > 0}
              aria-busy={loading}
              className={`w-full py-3.5 rounded-xl text-sm font-700 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                success
                  ? 'bg-green-500 text-white shadow-lg shadow-green-100'
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-100 hover:shadow-green-200 active:scale-[0.99]'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {lang === 'bn' ? 'লগ ইন হচ্ছে...' : 'Signing in...'}
                </>
              ) : success ? (
                <>
                  <CheckCircle size={16} />
                  {lang === 'bn' ? 'সফল!' : 'Success!'}
                </>
              ) : (
                <>
                  {lang === 'bn' ? 'লগ ইন করুন' : 'Log In'}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Signup */}
          <p className="text-center text-sm text-slate-500 mt-7">
            {lang === 'bn' ? 'অ্যাকাউন্ট নেই? ' : "Don't have an account? "}
            <button
              onClick={onSignup}
              className="text-green-600 font-700 hover:text-green-700 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-green-200 rounded"
            >
              {lang === 'bn' ? 'সাইন আপ করুন' : 'Sign Up'}
            </button>
          </p>

          {/* Footer note */}
          <p className="text-center text-[11px] text-slate-400 mt-8 leading-relaxed">
            {lang === 'bn'
              ? 'লগ ইন করে আপনি আমাদের সেবার শর্তাবলী এবং গোপনীয়তা নীতিতে সম্মত হচ্ছেন।'
              : 'By logging in, you agree to our Terms of Service and Privacy Policy.'}
          </p>
        </div>
      </div>
    </div>
  )
}
