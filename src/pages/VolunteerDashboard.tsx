import { useEffect, useState } from 'react'
import { MapPin, Clock, ChevronRight } from 'lucide-react'
import type { Page } from '../App'

type Props = { onNavigate: (page: Page, issueId?: number) => void }

type JoinedIssue = {
  id: number
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
  joined_at: string
  volunteer_status: string | null
}

const formatDate = (date: string) => new Date(date).toLocaleDateString('en-BD', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const issueStatusStyles: Record<string, string> = {
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'in progress': 'border-blue-200 bg-blue-50 text-blue-700',
  approved: 'border-amber-200 bg-amber-50 text-amber-700',
  pending: 'border-slate-200 bg-slate-100 text-slate-600',
  reported: 'border-slate-200 bg-slate-100 text-slate-600',
  rejected: 'border-red-200 bg-red-50 text-red-600',
}

const formatLabel = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

const formatLocation = (issue: JoinedIssue) => {
  const parts = [issue.village || issue.union_name, issue.upazila, issue.district].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Location not provided'
}

export default function VolunteerDashboard({ onNavigate }: Props) {
  const [issues, setIssues] = useState<JoinedIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch('http://localhost:5000/api/volunteer/my-issues', { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json() as { success?: boolean; issues?: JoinedIssue[] }
        if (!response.ok || !data.success) throw new Error('Failed to load joined issues.')
        if (!cancelled) setIssues(data.issues ?? [])
      })
      .catch((fetchError) => {
        console.error('Failed to load joined issues:', fetchError)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [reloadKey])

  const totalJoined = issues.length
  const completedCount = issues.filter((issue) => issue.status?.toLowerCase() === 'completed').length
  const activeCount = issues.filter((issue) => {
    const status = issue.status?.toLowerCase()
    return status !== 'completed' && status !== 'rejected'
  }).length

  return (
    <div className="max-w-[1000px] space-y-5 pb-20">
      {/* Welcome header */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-6 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
          <div className="relative">
            <h1 className="text-xl font-700 mb-0.5">Help Your Community 🤝</h1>
            <p className="text-green-100 text-sm">কমিউনিটির জন্য স্বেচ্ছাসেবক হোন</p>
          </div>
        </div>

        {/* Real stats derived from joined issues */}
        {!loading && !error && (
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {[
              { label: 'Issues Joined', value: totalJoined, icon: '📋' },
              { label: 'Active', value: activeCount, icon: '🔄' },
              { label: 'Completed', value: completedCount, icon: '✅' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 px-5 py-4">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <div className="text-xl font-700 text-slate-900">{stat.value}</div>
                  <div className="text-xs text-slate-400">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Joined issues */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <h2 className="text-base font-700 text-slate-800">My Joined Issues</h2>
          {!loading && !error && totalJoined > 0 && (
            <span className="text-[11px] px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full font-700">
              {totalJoined}
            </span>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="bg-white rounded-2xl card-shadow p-5 animate-pulse">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="h-4 bg-slate-100 rounded w-2/3" />
                  <div className="h-5 w-16 bg-slate-100 rounded-full flex-shrink-0" />
                </div>
                <div className="h-3 bg-slate-100 rounded w-full mb-2" />
                <div className="h-3 bg-slate-100 rounded w-3/4 mb-4" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-5" />
                <div className="h-9 bg-slate-100 rounded-xl w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-white rounded-2xl card-shadow p-10 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-sm font-600 text-slate-700">Couldn't load your joined issues</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Something went wrong. Please try again.</p>
            <button
              onClick={() => setReloadKey((key) => key + 1)}
              className="px-5 py-2.5 bg-green-500 text-white text-sm font-700 rounded-xl hover:bg-green-600 cursor-pointer transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && totalJoined === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
            <div className="text-3xl mb-3">🤝</div>
            <p className="text-sm font-600 text-slate-700 mb-1">You haven't joined any issues yet</p>
            <p className="text-xs text-slate-400 mb-4">Browse community issues and join as a volunteer to see them here.</p>
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-5 py-2.5 bg-green-500 text-white text-sm font-700 rounded-xl hover:bg-green-600 cursor-pointer transition-all"
            >
              Browse Issues
            </button>
          </div>
        )}

        {/* Issue cards */}
        {!loading && !error && totalJoined > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {issues.map((issue) => {
              const volunteerStatus = formatLabel(issue.volunteer_status || 'joined').toLowerCase()
              const volunteerBadgeClass = ['active', 'joined', 'participating'].includes(volunteerStatus)
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-slate-200 bg-slate-100 text-slate-600'
              const issueStatusClass = issueStatusStyles[(issue.status || '').toLowerCase()] || 'border-slate-200 bg-slate-100 text-slate-600'

              return (
                <div key={issue.id} className="bg-white rounded-2xl card-shadow p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-700 text-slate-800 leading-snug">{issue.title}</h3>
                    <span className="text-[11px] px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-600 flex-shrink-0 whitespace-nowrap">
                      {issue.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">{issue.description}</p>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 min-w-0">
                    <MapPin size={12} className="text-green-500 flex-shrink-0" />
                    <span className="truncate">{formatLocation(issue)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full border font-700 ${issueStatusClass}`}>
                      {issue.status || 'Reported'}
                    </span>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full border font-700 ${volunteerBadgeClass}`}>
                      {formatLabel(issue.volunteer_status || 'joined')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
                    <Clock size={11} /> Joined {formatDate(issue.joined_at)}
                  </div>

                  <button
                    onClick={() => onNavigate('issue-details', issue.id)}
                    className="mt-auto w-full flex items-center justify-center gap-1.5 py-2.5 bg-green-500 text-white rounded-xl text-xs font-700 hover:bg-green-600 cursor-pointer transition-all"
                  >
                    View Issue <ChevronRight size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}