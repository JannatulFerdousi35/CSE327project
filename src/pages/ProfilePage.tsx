import { useEffect, useState } from 'react'
import { MapPin, Edit3, ChevronRight, LogOut, Clock, AlertCircle, CheckCircle, XCircle, RefreshCw, Shield } from 'lucide-react'
import type { Page, AuthUser } from '../App'

type Props = {
  onNavigate: (page: Page, issueId?: number) => void
  user: AuthUser | null
  onLogout: () => void
}

type Issue = {
  id: number
  user_id: number | null
  title: string
  description: string
  category: string
  division: string | null
  district: string | null
  upazila: string | null
  union_name: string | null
  village: string | null
  priority: string | null
  status: string | null
  created_at: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  Reported:    { label: 'Reported',    className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  New:         { label: 'New',         className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  Active:      { label: 'Active',      className: 'bg-orange-50 text-orange-700 border border-orange-200' },
  Pending:     { label: 'Pending',     className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  Approved:    { label: 'Approved',    className: 'bg-teal-50 text-teal-700 border border-teal-200' },
  'In Progress': { label: 'In Progress', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  Completed:   { label: 'Completed',   className: 'bg-green-50 text-green-700 border border-green-200' },
  Resolved:    { label: 'Resolved',    className: 'bg-green-50 text-green-700 border border-green-200' },
  Rejected:    { label: 'Rejected',    className: 'bg-red-50 text-red-600 border border-red-200' },
  Cancelled:   { label: 'Cancelled',   className: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

const categoryEmoji: Record<string, string> = {
  Road: '🛣️', Water: '💧', Flood: '🌊', Garbage: '🗑️',
  School: '🏫', Electricity: '⚡', Sanitation: '🚻', Environment: '🌿', Other: '📌',
}

const divisions = ['Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh']

const formatRelativeTime = (date: string) => {
  const diffMs = Date.now() - new Date(date).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(date).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })
}

export default function ProfilePage({ onNavigate, user, onLogout }: Props) {
  const [editMode, setEditMode] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [division, setDivision] = useState(user?.division || '')
  const [district, setDistrict] = useState(user?.district || '')
  const [upazila, setUpazila] = useState(user?.upazila || '')
  const [issues, setIssues] = useState<Issue[]>([])
  const [issuesLoading, setIssuesLoading] = useState(true)
  const [issuesError, setIssuesError] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  useEffect(() => {
    setIssuesLoading(true)
    setIssuesError(false)

    fetch('http://localhost:5000/api/issues/my-reports', { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json() as { success: boolean; issues?: Issue[] }
        if (!response.ok || !data.success) throw new Error('Failed')
        setIssues(data.issues || [])
      })
      .catch(() => setIssuesError(true))
      .finally(() => setIssuesLoading(false))
  }, [user])

  const handleSaveProfile = () => {
    setSaveMessage('Profile display updated.')
    setEditMode(false)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  const isCancellable = (status: string | null) => {
    const s = (status || '').toLowerCase()
    return s !== 'completed' && s !== 'resolved' && s !== 'cancelled' && s !== 'rejected'
  }

  const handleCancelIssue = async (issueId: number) => {
    if (cancellingId !== null) return
    if (!window.confirm('Are you sure you want to cancel this issue?')) return

    setCancellingId(issueId)

    try {
      const response = await fetch(`http://localhost:5000/api/issues/${issueId}/cancel`, {
        method: 'PATCH',
        credentials: 'include',
      })
      const data = await response.json() as { success?: boolean; message?: string; issue?: Issue }

      if (response.ok && data.success && data.issue) {
        setIssues((prev) => prev.map((issue) => (issue.id === issueId ? { ...issue, status: data.issue!.status } : issue)))
      } else {
        alert(data.message || 'Unable to cancel this issue.')
      }
    } catch (err) {
      console.error('Cancel failed:', err)
      alert('Unable to cancel this issue. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  if (!user) {
    return (
      <div className="max-w-[1000px] pb-20">
        <div className="bg-white rounded-2xl card-shadow p-10 text-center">
          <AlertCircle size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-600 text-slate-700 mb-1">Not signed in</p>
          <p className="text-xs text-slate-400 mb-4">Please sign in to view your profile.</p>
          <button onClick={() => onNavigate('login')} className="px-5 py-2.5 bg-green-500 text-white text-sm font-700 rounded-xl hover:bg-green-600 cursor-pointer transition-all">
            Sign In
          </button>
        </div>
      </div>
    )
  }

  const initials = user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const userLocation = [upazila, district, division].filter(Boolean).join(', ') || 'Location not provided'

  const totalReports = issues.length
  const activeReports = issues.filter((i) => {
    const s = (i.status || '').toLowerCase()
    return s === 'active' || s === 'reported' || s === 'new' || s === 'in progress' || s === 'pending' || s === 'approved'
  }).length
  const completedReports = issues.filter((i) => {
    const s = (i.status || '').toLowerCase()
    return s === 'completed' || s === 'resolved'
  }).length
  const cancelledReports = issues.filter((i) => (i.status || '').toLowerCase() === 'cancelled').length

  return (
    <div className="max-w-[1000px] space-y-5 pb-20">
      {/* Save success message */}
      {saveMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs font-600 px-4 py-2.5 rounded-xl">
          {saveMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — profile */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            {/* Banner */}
            <div className="relative h-24 bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
            </div>

            <div className="px-5 pb-5">
              {/* Avatar */}
              <div className="relative -mt-10 mb-3 flex items-end gap-3">
                <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-800 text-xl select-none flex-shrink-0">
                  {initials}
                </div>
                <div className="pb-1">
                  {user.role === 'admin' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-700 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 mb-1">
                      <Shield size={10} /> Admin
                    </span>
                  )}
                </div>
              </div>

              {/* Name */}
              {editMode ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="text-base font-700 text-slate-900 w-full border-b-2 border-green-400 outline-none mb-1 bg-transparent pb-1"
                />
              ) : (
                <h2 className="text-base font-700 text-slate-900 mb-0.5">{user.name}</h2>
              )}

              <div className="text-xs text-slate-400 mb-3">{user.email}</div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
                <MapPin size={12} className="text-green-500 flex-shrink-0" />
                <span className="truncate">{userLocation}</span>
              </div>

              <div className="flex gap-2">
                {editMode ? (
                  <>
                    <button
                      onClick={handleSaveProfile}
                      className="flex-1 py-2.5 bg-green-500 text-white text-xs font-700 rounded-xl hover:bg-green-600 cursor-pointer transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditMode(false); setName(user.name); setDivision(user.division || ''); setDistrict(user.district || ''); setUpazila(user.upazila || '') }}
                      className="px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-600 rounded-xl hover:bg-slate-50 cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditMode(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-600 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <Edit3 size={14} /> Edit Profile
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Location details */}
          <div className="bg-white rounded-2xl card-shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-700 text-slate-800">Location Details</h3>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="text-xs text-green-600 font-600 cursor-pointer hover:text-green-700 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            {editMode ? (
              <div className="space-y-2.5">
                {[
                  { label: 'Division', value: division, opts: divisions, setter: setDivision },
                  { label: 'District', value: district, opts: ['Tangail', 'Manikganj', 'Gazipur', 'Narayanganj'], setter: setDistrict },
                  { label: 'Upazila', value: upazila, opts: ['Mirzapur', 'Basail', 'Ghatail', 'Kalihati', 'Tangail Sadar'], setter: setUpazila },
                ].map((f) => (
                  <div key={f.label}>
                    <div className="text-[11px] text-slate-400 mb-0.5">{f.label}</div>
                    <select
                      value={f.value}
                      onChange={(e) => f.setter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 cursor-pointer focus:ring-2 focus:ring-green-200 focus:border-green-300 transition-all"
                    >
                      <option value="">Select {f.label}</option>
                      {f.opts!.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {[
                  { label: 'Division', value: division },
                  { label: 'District', value: district },
                  { label: 'Upazila', value: upazila },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <span className="text-xs font-600 text-slate-700">{item.value || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sign out */}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 rounded-xl text-sm font-600 text-red-500 hover:bg-red-50 hover:border-red-300 transition-all cursor-pointer"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>

        {/* Right column — content */}
        <div className="col-span-1 lg:col-span-2 space-y-5">
          {/* Activity stats — derived from real data */}
          {!issuesLoading && !issuesError && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Reported', value: totalReports, icon: <AlertCircle size={16} className="text-blue-600" />, bg: 'bg-blue-50' },
                { label: 'Active', value: activeReports, icon: <Clock size={16} className="text-orange-600" />, bg: 'bg-orange-50' },
                { label: 'Resolved', value: completedReports, icon: <CheckCircle size={16} className="text-green-600" />, bg: 'bg-green-50' },
                { label: 'Cancelled', value: cancelledReports, icon: <XCircle size={16} className="text-slate-400" />, bg: 'bg-slate-50' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl card-shadow px-4 py-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>{s.icon}</div>
                  <div>
                    <div className="text-xl font-700 text-slate-900">{s.value}</div>
                    <div className="text-[11px] text-slate-500">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* My Reports */}
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-700 text-slate-800">My Reports</h3>
              {!issuesLoading && !issuesError && (
                <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full font-600">
                  {totalReports} total
                </span>
              )}
            </div>

            {/* Loading */}
            {issuesLoading && (
              <div className="p-5 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-slate-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-slate-100 rounded w-2/3" />
                      <div className="h-3 bg-slate-100 rounded w-1/3" />
                    </div>
                    <div className="h-5 w-16 bg-slate-100 rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {!issuesLoading && issuesError && (
              <div className="px-5 py-10 text-center">
                <AlertCircle size={22} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 mb-3">Couldn't load your reports.</p>
                <button
                  onClick={() => { setIssuesLoading(true); setIssuesError(false); fetch('http://localhost:5000/api/issues/my-reports', { credentials: 'include' }).then(async (r) => { const d = await r.json() as { success: boolean; issues?: Issue[] }; if (r.ok && d.success) setIssues(d.issues || []); else setIssuesError(true) }).catch(() => setIssuesError(true)).finally(() => setIssuesLoading(false)) }}
                  className="inline-flex items-center gap-1.5 text-xs text-green-600 font-600 hover:text-green-700 cursor-pointer transition-colors"
                >
                  <RefreshCw size={12} /> Try Again
                </button>
              </div>
            )}

            {/* Empty */}
            {!issuesLoading && !issuesError && totalReports === 0 && (
              <div className="px-5 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">📋</span>
                </div>
                <p className="text-sm font-600 text-slate-700 mb-1">No reports yet</p>
                <p className="text-xs text-slate-400 mb-4">Issues you report will appear here.</p>
                <button
                  onClick={() => onNavigate('report-issue')}
                  className="px-5 py-2 bg-green-500 text-white text-xs font-700 rounded-xl hover:bg-green-600 cursor-pointer transition-all"
                >
                  Report an Issue
                </button>
              </div>
            )}

            {/* Issue list */}
            {!issuesLoading && !issuesError && totalReports > 0 && (
              <div className="divide-y divide-slate-100">
                {issues.map((issue) => {
                  const status = issue.status || 'Reported'
                  const statusInfo = statusConfig[status] || { label: status, className: 'bg-slate-50 text-slate-600 border border-slate-200' }
                  const emoji = categoryEmoji[issue.category] || '📌'
                  const cancellable = isCancellable(status)

                  return (
                    <div key={issue.id}>
                      <button
                        onClick={() => onNavigate('issue-details', issue.id)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-all cursor-pointer group"
                      >
                        <span className="text-base flex-shrink-0">{emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-600 text-slate-700 truncate group-hover:text-green-700 transition-colors">{issue.title}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{issue.category} · {formatRelativeTime(issue.created_at)}</div>
                        </div>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-600 flex-shrink-0 ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                        <ChevronRight size={14} className="text-slate-300 flex-shrink-0 group-hover:text-green-500 transition-colors" />
                      </button>
                      {cancellable && (
                        <div className="px-5 pb-3 -mt-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCancelIssue(issue.id) }}
                            disabled={cancellingId === issue.id}
                            className={`text-[11px] font-600 px-3 py-1.5 rounded-lg border transition-all ${
                              cancellingId === issue.id
                                ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 cursor-pointer'
                            }`}
                          >
                            {cancellingId === issue.id ? 'Cancelling...' : 'Cancel Issue'}
                          </button>
                        </div>
                      )}
                      {!cancellable && (status || '').toLowerCase() === 'cancelled' && (
                        <div className="px-5 pb-3 -mt-1">
                          <span className="text-[11px] font-600 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 inline-flex items-center gap-1">
                            <XCircle size={12} /> This issue was cancelled
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="text-sm font-700 text-slate-800 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { label: 'Report Issue', icon: '📢', page: 'report-issue' as Page, color: 'hover:border-red-300 hover:bg-red-50/50' },
                { label: 'Volunteer', icon: '🤝', page: 'volunteer' as Page, color: 'hover:border-blue-300 hover:bg-blue-50/50' },
                { label: 'Browse Issues', icon: '🔍', page: 'dashboard' as Page, color: 'hover:border-green-300 hover:bg-green-50/50' },
              ].map((action) => (
                <button
                  key={action.page}
                  onClick={() => onNavigate(action.page)}
                  className={`flex items-center gap-2.5 px-3.5 py-3 border border-slate-200 rounded-xl text-xs font-600 text-slate-700 transition-all cursor-pointer ${action.color}`}
                >
                  <span className="text-base">{action.icon}</span>
                  <span className="flex-1 text-left">{action.label}</span>
                  <ChevronRight size={13} className="text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
