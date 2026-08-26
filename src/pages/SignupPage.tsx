import { useState } from 'react'
import { Eye, EyeOff, Leaf } from 'lucide-react'
import type { AuthUser } from '../App'

type Props = { onSignup: (user: AuthUser) => void; onLogin: () => void }

export default function SignupPage({ onSignup, onLogin }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, phone }),
      })
      const data = await response.json() as { success?: boolean; user?: AuthUser; message?: string }
      if (!response.ok || !data.success || !data.user) {
        throw new Error(data.message || 'Unable to create account.')
      }

      const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const loginData = await loginResponse.json() as { success?: boolean; user?: AuthUser }
      if (!loginResponse.ok || !loginData.success || !loginData.user) {
        throw new Error('Account created. Please sign in.')
      }
      onSignup(loginData.user)
    } catch (submitError) {
      console.error('Signup failed:', submitError)
      setError(submitError instanceof TypeError ? 'Unable to connect to the server.' : submitError instanceof Error ? submitError.message : 'Unable to create account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 card-shadow">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center"><Leaf size={18} className="text-white" /></div>
          <span className="font-700 text-slate-800">Community Action Bridge</span>
        </div>
        <h1 className="text-2xl font-700 text-slate-900 mb-1">Create your account</h1>
        <p className="text-sm text-slate-500 mb-6">Join your community and help make a difference.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-600 text-slate-700 mb-1.5">Name</label><input required value={name} onChange={(event) => setName(event.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" /></div>
          <div><label className="block text-sm font-600 text-slate-700 mb-1.5">Email address</label><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" /></div>
          <div><label className="block text-sm font-600 text-slate-700 mb-1.5">Password</label><div className="relative"><input required type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
          <div><label className="block text-sm font-600 text-slate-700 mb-1.5">Confirm Password</label><input required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" /></div>
          <div><label className="block text-sm font-600 text-slate-700 mb-1.5">Phone <span className="font-400 text-slate-400">(optional)</span></label><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" /></div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-700 rounded-xl cursor-pointer">{loading ? 'Creating account...' : 'Create Account'}</button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">Already have an account? <button onClick={onLogin} className="text-green-600 font-700 cursor-pointer">Login</button></p>
      </div>
    </div>
  )
}
