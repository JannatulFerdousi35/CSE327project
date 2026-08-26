import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, ChevronRight, Clock, Image as ImageIcon, MapPin, RefreshCw, Users, XCircle, Filter, Search, X } from 'lucide-react'
import type { Page, AuthUser } from '../App'

type Props = { onNavigate: (page: Page, issueId?: number) => void; user: AuthUser | null }

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
  image_url: string | null
  priority: string | null
  status: string | null
  created_at: string
}

type IssuesResponse = {
  success: boolean
  issues?: Issue[]
  message?: string
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

const priorityConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  High:   { label: 'High',   dot: 'bg-red-500',   text: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
  Urgent: { label: 'Urgent', dot: 'bg-red-500',   text: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
  Medium: { label: 'Medium', dot: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  Low:    { label: 'Low',    dot: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50 border-green-200' },
}

const categoryConfig: Record<string, { emoji: string; className: string }> = {
  Road:        { emoji: '🛣️',  className: 'bg-slate-100 text-slate-700 border-slate-200' },
  Water:       { emoji: '💧',  className: 'bg-blue-50 text-blue-700 border-blue-200' },
  Flood:       { emoji: '🌊',  className: 'bg-sky-50 text-sky-700 border-sky-200' },
  Garbage:     { emoji: '🗑️',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  School:      { emoji: '🏫',  className: 'bg-purple-50 text-purple-700 border-purple-200' },
  Electricity: { emoji: '⚡',  className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  Sanitation:  { emoji: '🚻',  className: 'bg-orange-50 text-orange-700 border-orange-200' },
  Environment: { emoji: '🌿',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Other:       { emoji: '📌',  className: 'bg-slate-50 text-slate-600 border-slate-200' },
}

const formatRelativeTime = (date: string) => {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(date).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })
}

const getLocation = (issue: Issue) => [
  issue.village,
  issue.union_name,
  issue.upazila,
  issue.district,
  issue.division,
].filter(Boolean).join(', ') || 'Location not provided'

const isActiveStatus = (status: string | null) => {
  const s = (status || '').toLowerCase()
  return s === 'active' || s === 'reported' || s === 'new' || s === 'in progress' || s === 'pending' || s === 'approved'
}

const isCancellable = (status: string | null) => {
  const s = (status || '').toLowerCase()
  return s !== 'completed' && s !== 'resolved' && s !== 'cancelled' && s !== 'rejected'
}

export default function Dashboard({ onNavigate, user }: Props) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [categoryFilter, setCategoryFilter] = useState<string>('All')

  useEffect(() => {
    const fetchIssues = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch('http://localhost:5000/api/issues')
        const data = await response.json() as IssuesResponse

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to fetch community issues.')
        }

        setIssues(data.issues || [])
      } catch (fetchError) {
        console.error('Failed to fetch issues:', fetchError)
        setError('We could not load community issues right now.')
      } finally {
        setLoading(false)
      }
    }

    fetchIssues()
  }, [retryCount])

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

  const totalIssues = issues.length
  const activeIssues = issues.filter((issue) => isActiveStatus(issue.status)).length
  const completedIssues = issues.filter((issue) => {
    const s = (issue.status || '').toLowerCase()
    return s === 'completed' || s === 'resolved'
  }).length
  const cancelledIssues = issues.filter((issue) => (issue.status || '').toLowerCase() === 'cancelled').length

  const uniqueStatuses = [...new Set(issues.map((i) => i.status || 'Reported'))].sort()
  const uniqueCategories = [...new Set(issues.map((i) => i.category))].sort()

  const filteredIssues = issues.filter((issue) => {
    if (statusFilter !== 'All' && (issue.status || 'Reported') !== statusFilter) return false
    if (categoryFilter !== 'All' && issue.category !== categoryFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const haystack = `${issue.title} ${issue.description} ${issue.category} ${getLocation(issue)}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const hasActiveFilters = statusFilter !== 'All' || categoryFilter !== 'All' || searchQuery.trim() !== ''

  return (
    <div className="max-w-[1100px] space-y-6 pb-24">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 rounded-2xl p-6 md:p-8 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 text-green-100 text-sm mb-3">
            <MapPin size={15} /> {user ? [user.upazila, user.district, user.division].filter(Boolean).join(', ') || 'Bangladesh' : 'Mirzapur, Tangail'}
          </div>
          <h1 className="text-2xl md:text-3xl font-800 mb-1.5 leading-tight">
            {user ? `Hello, ${user.name.split(' ')[0]}` : 'Make Your Community Better'}
          </h1>
          <p className="text-green-100 text-sm mb-6 leading-relaxed">
            আপনার এলাকার সমস্যা রিপোর্ট করুন এবং সমাধানে অংশ নিন
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('report-issue')}
              className="px-5 py-2.5 bg-white text-green-700 rounded-xl text-sm font-700 hover:bg-green-50 transition-all cursor-pointer shadow-lg shadow-green-900/20"
            >
              Report a Problem
            </button>
            <button
              onClick={() => {
                fetch('http://localhost:5000/api/users/become-volunteer', { method: 'POST', credentials: 'include' }).catch(() => {})
                onNavigate('volunteer')
              }}
              className="px-5 py-2.5 bg-green-400/30 border border-white/30 text-white rounded-xl text-sm font-700 hover:bg-green-400/50 transition-all cursor-pointer"
            >
              Become a Volunteer
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Issues', value: totalIssues, icon: <AlertCircle size={17} className="text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Active', value: activeIssues, icon: <Users size={17} className="text-orange-600" />, bg: 'bg-orange-50' },
          { label: 'Resolved', value: completedIssues, icon: <CheckCircle size={17} className="text-green-600" />, bg: 'bg-green-50' },
          { label: 'Cancelled', value: cancelledIssues, icon: <XCircle size={17} className="text-slate-400" />, bg: 'bg-slate-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl card-shadow px-4 py-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>{stat.icon}</div>
            <div>
              <div className="text-xl font-700 text-slate-900">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Issues section */}
      <section className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-700 text-slate-800 text-base">Recent Community Issues</h2>
              <p className="text-xs text-slate-400 mt-0.5">সাম্প্রতিক রিপোর্ট করা সমস্যাগুলো</p>
            </div>
            {!loading && !error && issues.length > 0 && (
              <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-700">
                {totalIssues} issues
              </span>
            )}
          </div>

          {/* Search and filters */}
          {!loading && !error && issues.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search issues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-green-200 focus:border-green-300 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="pl-7 pr-6 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 appearance-none cursor-pointer focus:ring-2 focus:ring-green-200 focus:border-green-300 transition-all"
                  >
                    <option value="All">All Status</option>
                    {uniqueStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 appearance-none cursor-pointer focus:ring-2 focus:ring-green-200 focus:border-green-300 transition-all"
                >
                  <option value="All">All Categories</option>
                  {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="p-5 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-28 h-24 rounded-xl bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-2.5 py-1">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="flex gap-2 mt-1">
                    <div className="h-5 w-16 bg-slate-100 rounded-full" />
                    <div className="h-5 w-20 bg-slate-100 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="px-5 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <p className="text-sm font-600 text-slate-700 mb-1">Couldn't load community issues</p>
            <p className="text-xs text-slate-400 mb-5">{error}</p>
            <button
              onClick={() => setRetryCount((count) => count + 1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-xl text-sm font-700 hover:bg-green-600 transition-all cursor-pointer"
            >
              <RefreshCw size={15} /> Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && issues.length === 0 && (
          <div className="px-5 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-sm font-600 text-slate-700 mb-1">No community issues yet</p>
            <p className="text-xs text-slate-400 mb-5">Be the first to report an issue in your community.</p>
            <button
              onClick={() => onNavigate('report-issue')}
              className="px-5 py-2.5 bg-green-500 text-white rounded-xl text-sm font-700 hover:bg-green-600 transition-all cursor-pointer"
            >
              Report an Issue
            </button>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && !error && issues.length > 0 && filteredIssues.length === 0 && (
          <div className="px-5 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <Search size={22} className="text-slate-300" />
            </div>
            <p className="text-sm font-600 text-slate-700 mb-1">No matching issues</p>
            <p className="text-xs text-slate-400 mb-4">Try adjusting your search or filters.</p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('All'); setCategoryFilter('All') }}
              className="text-xs text-green-600 font-600 hover:text-green-700 cursor-pointer transition-all"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Issue list */}
        {!loading && !error && filteredIssues.length > 0 && (
          <div className="divide-y divide-slate-100">
            {filteredIssues.map((issue) => {
              const status = issue.status || 'Reported'
              const statusInfo = statusConfig[status] || { label: status, className: 'bg-slate-50 text-slate-600 border border-slate-200' }
              const priorityInfo = priorityConfig[issue.priority || ''] || null
              const categoryInfo = categoryConfig[issue.category] || categoryConfig.Other
              const canCancel = user && issue.user_id === user.id && isCancellable(status)
              const isOwnIssue = user && issue.user_id === user.id

              return (
                <div key={issue.id} className="group">
                  <button
                    onClick={() => onNavigate('issue-details', issue.id)}
                    className="w-full flex items-start gap-3.5 p-4 text-left hover:bg-slate-50/80 transition-all cursor-pointer"
                  >
                    {/* Thumbnail */}
                    <div className="w-24 h-20 sm:w-32 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                      {issue.image_url ? (
                        <img src={issue.image_url} alt={issue.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-0.5">
                          <ImageIcon size={20} />
                          <span className="text-[9px] text-slate-400">No image</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2 mb-1">
                        <h3 className="text-sm font-700 text-slate-800 leading-snug flex-1 line-clamp-1">{issue.title}</h3>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-600 flex-shrink-0 whitespace-nowrap ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-1 mb-1.5 hidden sm:block">{issue.description}</p>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                        <MapPin size={11} className="text-green-500 flex-shrink-0" />
                        <span className="truncate">{getLocation(issue)}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Category badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-600 ${categoryInfo.className}`}>
                          {categoryInfo.emoji} {issue.category}
                        </span>

                        {/* Priority badge */}
                        {priorityInfo && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-600 ${priorityInfo.bg}`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${priorityInfo.dot} mr-1 -mb-px`} />
                            {priorityInfo.label}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto">
                          <Clock size={10} /> {formatRelativeTime(issue.created_at)}
                        </span>
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-slate-300 flex-shrink-0 mt-7 group-hover:text-green-500 transition-colors" />
                  </button>

                  {/* Cancel action — only shown for own cancellable issues */}
                  {canCancel && (
                    <div className="px-4 pb-3 -mt-1">
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

                  {/* Show "Cancelled" badge if own cancelled issue */}
                  {isOwnIssue && !isCancellable(status) && (status || '').toLowerCase() === 'cancelled' && (
                    <div className="px-4 pb-3 -mt-1">
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
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Report a Problem', icon: '📢', page: 'report-issue' as Page, color: 'hover:border-red-300 hover:bg-red-50/50' },
          { label: 'Join as Volunteer', icon: '🤝', page: 'volunteer' as Page, color: 'hover:border-blue-300 hover:bg-blue-50/50' },
          { label: 'Find Community Events', icon: '📅', page: 'events' as Page, color: 'hover:border-purple-300 hover:bg-purple-50/50' },
        ].map((action) => (
          <button
            key={action.page}
            onClick={() => onNavigate(action.page)}
            className={`bg-white rounded-xl border border-slate-200 px-4 py-3.5 text-sm font-600 text-slate-700 transition-all cursor-pointer text-left flex items-center gap-3 ${action.color}`}
          >
            <span className="text-lg">{action.icon}</span>
            <span className="flex-1">{action.label}</span>
            <ChevronRight size={15} className="text-slate-300" />
          </button>
        ))}
      </section>

      {/* AI banner */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 md:p-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-700 mb-1">AI Community Assistance</h2>
          <p className="text-blue-100 text-xs leading-relaxed max-w-xl">AI can help identify issues, estimate priority, find similar reports, and suggest action plans.</p>
        </div>
        <button
          onClick={() => onNavigate('ai-suggestions')}
          className="flex-shrink-0 px-5 py-2.5 bg-white text-blue-700 rounded-xl text-sm font-700 hover:bg-blue-50 transition-all cursor-pointer"
        >
          View AI Suggestions
        </button>
      </section>
    </div>
  )
}
