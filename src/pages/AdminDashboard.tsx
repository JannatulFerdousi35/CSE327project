import { useEffect, useMemo, useState } from 'react'
import { Flag, Leaf, LogOut, Search, Calendar, CheckCircle, XCircle } from 'lucide-react'
import type { Page } from '../App'

type Props = { onNavigate: (page: Page, issueId?: number) => void; onLogout: () => void }

type AdminIssue = {
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
  recommended_priority: string | null
  ai_analyzed: boolean
}

type AdminEvent = {
  id: number
  organizer_id: number | null
  organizer_name: string | null
  title: string
  description: string | null
  location_name: string | null
  district: string | null
  starts_at: string
  ends_at: string | null
  volunteer_capacity: number | null
  status: string
  participant_count: number
  created_at: string
}

const statuses = ['All Status', 'Reported', 'Pending', 'Approved', 'In Progress', 'Completed', 'Rejected']
const categoryLabels = ['All Categories', 'Road', 'Water', 'Flood', 'Garbage', 'School', 'Electricity', 'Sanitation', 'Environment', 'Other']
const statusBadge: Record<string, string> = {
  Reported: 'bg-slate-100 text-slate-600', Pending: 'bg-slate-100 text-slate-600', Approved: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700', Completed: 'bg-green-100 text-green-700', Rejected: 'bg-red-100 text-red-700',
}
const priorityBadge: Record<string, string> = { High: 'bg-red-100 text-red-700', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-green-100 text-green-700' }
const displayCategory = (category: string) => category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
const locationText = (issue: AdminIssue) => [issue.village, issue.district, issue.division].filter(Boolean).join(', ') || 'Location not provided'
const formatDate = (date: string) => new Date(date).toLocaleDateString('en-BD', { year: 'numeric', month: 'short', day: 'numeric' })

export default function AdminDashboard({ onNavigate, onLogout }: Props) {
  const [issues, setIssues] = useState<AdminIssue[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [categoryFilter, setCategoryFilter] = useState('All Categories')
  const [districtFilter, setDistrictFilter] = useState('All Districts')
  const [upazilaFilter, setUpazilaFilter] = useState('All Upazilas')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [updatingIssueId, setUpdatingIssueId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'issues' | 'events'>('issues')
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState(false)
  const [updatingEventId, setUpdatingEventId] = useState<number | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const loadIssues = async () => {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('http://localhost:5000/api/admin/issues', { credentials: 'include' })
      const data = await response.json() as { success?: boolean; issues?: AdminIssue[] }
      if (!response.ok || !data.success) throw new Error('Issue request failed.')
      setIssues(data.issues || [])
    } catch (loadError) {
      console.error('Failed to load admin issues:', loadError)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadIssues() }, [])

  const loadEvents = async () => {
    setEventsLoading(true)
    setEventsError(false)
    try {
      const response = await fetch('http://localhost:5000/api/admin/events', { credentials: 'include' })
      const data = await response.json() as { success?: boolean; events?: AdminEvent[] }
      if (!response.ok || !data.success) throw new Error('Failed to load events.')
      setEvents(data.events || [])
    } catch {
      setEventsError(true)
    } finally {
      setEventsLoading(false)
    }
  }

  useEffect(() => { void loadEvents() }, [])

  const updateEventStatus = async (eventId: number, status: string) => {
    setStatusMessage('')
    setUpdatingEventId(eventId)
    try {
      const response = await fetch(`http://localhost:5000/api/admin/events/${eventId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ status }) })
      const data = await response.json() as { success?: boolean; event?: AdminEvent }
      if (!response.ok || !data.success || !data.event) throw new Error('Event status update failed.')
      setEvents((current) => current.map((ev) => ev.id === eventId ? { ...ev, ...data.event } : ev))
      setStatusMessage('Event status updated.')
    } catch {
      setStatusMessage('Unable to update event status.')
    } finally {
      setUpdatingEventId(null)
    }
  }

  const districtOptions = useMemo(() => ['All Districts', ...new Set(issues.map((issue) => issue.district).filter(Boolean) as string[])], [issues])
  const upazilaOptions = useMemo(() => ['All Upazilas', ...new Set(issues.map((issue) => issue.upazila).filter(Boolean) as string[])], [issues])
  const categoryOptions = useMemo(() => ['All Categories', ...new Set(issues.map((issue) => displayCategory(issue.category)))], [issues])
  const filteredIssues = useMemo(() => issues.filter((issue) => {
    const searchable = `${issue.id} ${issue.title} ${issue.description} ${locationText(issue)}`.toLowerCase()
    return (!debouncedSearch || searchable.includes(debouncedSearch)) &&
      (statusFilter === 'All Status' || (issue.status || 'Reported').toLowerCase() === statusFilter.toLowerCase()) &&
      (categoryFilter === 'All Categories' || displayCategory(issue.category) === categoryFilter) &&
      (districtFilter === 'All Districts' || issue.district === districtFilter) &&
      (upazilaFilter === 'All Upazilas' || issue.upazila === upazilaFilter)
  }), [issues, debouncedSearch, statusFilter, categoryFilter, districtFilter, upazilaFilter])

  const updateStatus = async (issueId: number, status: string) => {
    setStatusMessage('')
    setUpdatingIssueId(issueId)
    try {
      const response = await fetch(`http://localhost:5000/api/admin/issues/${issueId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ status }) })
      const data = await response.json() as { success?: boolean; issue?: AdminIssue }
      if (!response.ok || !data.success || !data.issue) throw new Error('Status update failed.')
      setIssues((current) => current.map((issue) => issue.id === issueId ? { ...issue, ...data.issue } : issue))
      setStatusMessage('Issue status updated.')
    } catch (updateError) {
      console.error('Failed to update issue status:', updateError)
      setStatusMessage('Unable to update issue status.')
    } finally {
      setUpdatingIssueId(null)
    }
  }

  const clearFilters = () => { setSearch(''); setStatusFilter('All Status'); setCategoryFilter('All Categories'); setDistrictFilter('All Districts'); setUpazilaFilter('All Upazilas') }
  const hasActiveFilters = Boolean(search || statusFilter !== 'All Status' || categoryFilter !== 'All Categories' || districtFilter !== 'All Districts' || upazilaFilter !== 'All Upazilas')
  const stats = [
    { label: 'Total Issues', value: issues.length, icon: <Flag size={16} className="text-orange-500" />, bg: 'bg-orange-50' },
    { label: 'Pending / Reported', value: issues.filter((issue) => ['reported', 'pending'].includes((issue.status || 'Reported').toLowerCase())).length, icon: <Flag size={16} className="text-slate-500" />, bg: 'bg-slate-100' },
    { label: 'In Progress', value: issues.filter((issue) => (issue.status || '').toLowerCase() === 'in progress').length, icon: <Flag size={16} className="text-amber-500" />, bg: 'bg-amber-50' },
    { label: 'Completed', value: issues.filter((issue) => (issue.status || '').toLowerCase() === 'completed').length, icon: <Flag size={16} className="text-green-500" />, bg: 'bg-green-50' },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden sm:flex w-52 bg-slate-900 flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center"><Leaf size={14} className="text-white" /></div><div><div className="text-xs font-700 text-white">CAB Admin</div><div className="text-[10px] text-slate-400">Bangladesh</div></div></div>
        <div className="flex-1 p-3 space-y-1">
          <button onClick={() => setActiveTab('issues')} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-600 cursor-pointer transition-all ${activeTab === 'issues' ? 'bg-green-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Flag size={15} /> Issues</button>
          <button onClick={() => setActiveTab('events')} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-600 cursor-pointer transition-all ${activeTab === 'events' ? 'bg-green-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Calendar size={15} /> Events</button>
        </div>
        <div className="p-3 border-t border-slate-800"><div className="text-xs font-600 text-white px-3 py-2">Admin panel</div><button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800 hover:text-red-400 cursor-pointer"><LogOut size={13} /> Logout</button></div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-100 flex flex-wrap items-center px-4 sm:px-5 gap-3 py-3"><div className="text-xs font-700 text-slate-800">Admin Dashboard</div><div className="relative w-full sm:w-72 sm:ml-3"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, ID, or location" className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-green-200" /></div><button onClick={() => onNavigate('dashboard')} className="ml-auto text-xs text-green-600 font-600 hover:text-green-700 cursor-pointer">← Back to App</button></header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-5">
          {activeTab === 'issues' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{stats.map((stat) => <div key={stat.label} className="bg-white rounded-2xl card-shadow p-4"><div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>{stat.icon}</div><div className="text-2xl font-700 text-slate-900">{stat.value}</div><div className="text-xs text-slate-400 mt-0.5">{stat.label}</div></div>)}</div>

              <div className="bg-white rounded-2xl card-shadow p-4 sm:p-5"><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-700 text-slate-800">Filter Issues</h3>{hasActiveFilters && <button onClick={clearFilters} className="text-xs text-green-600 font-600 cursor-pointer">Clear filters</button>}</div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Status', statusFilter, statuses, setStatusFilter], ['Category', categoryFilter, categoryOptions.length > 1 ? categoryOptions : categoryLabels, setCategoryFilter], ['District', districtFilter, districtOptions, setDistrictFilter], ['Upazila', upazilaFilter, upazilaOptions, setUpazilaFilter]].map(([label, value, options, setter]) => <div key={String(label)}><label className="block text-[11px] font-600 text-slate-500 mb-1">{label}</label><select value={String(value)} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 cursor-pointer focus:ring-2 focus:ring-green-200 appearance-none">{(options as string[]).map((option) => <option key={option}>{option}</option>)}</select></div>)}</div></div>

              <div className="bg-white rounded-2xl card-shadow overflow-hidden"><div className="px-4 sm:px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-700 text-slate-800">Reported Issues</h3><p className="text-xs text-slate-400 mt-0.5">{filteredIssues.length} issue{filteredIssues.length === 1 ? '' : 's'} shown</p></div>{loading && <p className="p-8 text-center text-sm text-slate-500">Loading issues...</p>}{error && !loading && <div className="p-8 text-center"><p className="text-sm text-slate-500 mb-3">Unable to load issues.</p><button onClick={() => void loadIssues()} className="text-xs text-green-600 font-700 cursor-pointer">Try again</button></div>}{!loading && !error && filteredIssues.length === 0 && <div className="p-8 text-center"><p className="text-sm text-slate-600">No issues found</p><p className="text-xs text-slate-400 mt-1">Try changing your search or filters.</p>{hasActiveFilters && <button onClick={clearFilters} className="mt-3 text-xs text-green-600 font-700 cursor-pointer">Clear filters</button>}</div>}{!loading && !error && filteredIssues.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-xs"><thead><tr className="border-b border-slate-100">{['ID', 'Issue', 'Category', 'Location', 'Priority', 'Status', 'Reported', 'Action'].map((heading) => <th key={heading} className="text-left px-4 py-2.5 text-[11px] font-700 text-slate-400">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-50">{filteredIssues.map((issue) => { const status = issue.status || 'Reported'; const priority = issue.recommended_priority || issue.priority; return <tr key={issue.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-slate-500">#{issue.id}</td><td className="px-4 py-3 max-w-52"><div className="font-600 text-slate-700 truncate">{issue.title}</div><div className="text-[11px] text-slate-400 truncate mt-0.5">{issue.description}</div></td><td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md font-600">{displayCategory(issue.category)}</span></td><td className="px-4 py-3 text-slate-500 max-w-40 truncate">{locationText(issue)}</td><td className="px-4 py-3">{priority ? <span className={`px-2 py-0.5 rounded-md font-600 ${priorityBadge[priority] || 'bg-slate-100 text-slate-600'}`}>{priority}</span> : <span className="text-slate-400">—</span>}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-md font-600 ${statusBadge[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span></td><td className="px-4 py-3 text-slate-500">{formatDate(issue.created_at)}</td><td className="px-4 py-3">{updatingIssueId === issue.id ? <span className="text-slate-400">Updating...</span> : <select value={status} onChange={(event) => void updateStatus(issue.id, event.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] cursor-pointer focus:ring-2 focus:ring-green-200">{statuses.filter((s) => s !== 'All Status').map((s) => <option key={s} value={s}>{s}</option>)}</select>}</td></tr>})}</tbody></table></div>}</div>
            </>
          )}

          {activeTab === 'events' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white rounded-2xl card-shadow p-4"><div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center mb-3"><Calendar size={16} className="text-blue-500" /></div><div className="text-2xl font-700 text-slate-900">{events.length}</div><div className="text-xs text-slate-400 mt-0.5">Total Events</div></div>
                <div className="bg-white rounded-2xl card-shadow p-4"><div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center mb-3"><Calendar size={16} className="text-amber-500" /></div><div className="text-2xl font-700 text-slate-900">{events.filter((e) => e.status === 'planned').length}</div><div className="text-xs text-slate-400 mt-0.5">Pending Review</div></div>
                <div className="bg-white rounded-2xl card-shadow p-4"><div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center mb-3"><Calendar size={16} className="text-green-500" /></div><div className="text-2xl font-700 text-slate-900">{events.filter((e) => e.status === 'approved').length}</div><div className="text-xs text-slate-400 mt-0.5">Approved</div></div>
              </div>

              <div className="bg-white rounded-2xl card-shadow overflow-hidden">
                <div className="px-4 sm:px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-700 text-slate-800">Event Proposals</h3><p className="text-xs text-slate-400 mt-0.5">{events.length} event{events.length === 1 ? '' : 's'} total</p></div>
                {eventsLoading && <p className="p-8 text-center text-sm text-slate-500">Loading events...</p>}
                {eventsError && !eventsLoading && <div className="p-8 text-center"><p className="text-sm text-slate-500 mb-3">Unable to load events.</p><button onClick={() => void loadEvents()} className="text-xs text-green-600 font-700 cursor-pointer">Try again</button></div>}
                {!eventsLoading && !eventsError && events.length === 0 && <div className="p-8 text-center"><p className="text-sm text-slate-600">No event proposals yet</p><p className="text-xs text-slate-400 mt-1">Events proposed by users will appear here.</p></div>}
                {!eventsLoading && !eventsError && events.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-xs">
                      <thead><tr className="border-b border-slate-100">{['ID', 'Event', 'Location', 'Date', 'Capacity', 'Status', 'Action'].map((h) => <th key={h} className="text-left px-4 py-2.5 text-[11px] font-700 text-slate-400">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-50">{events.map((ev) => {
                        const eventDate = new Date(ev.starts_at).toLocaleDateString('en-BD', { year: 'numeric', month: 'short', day: 'numeric' })
                        const eventStatusColors: Record<string, string> = { planned: 'bg-amber-100 text-amber-700', approved: 'bg-green-100 text-green-700', active: 'bg-blue-100 text-blue-700', completed: 'bg-slate-100 text-slate-600', rejected: 'bg-red-100 text-red-700' }
                        return (
                          <tr key={ev.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-500">#{ev.id}</td>
                            <td className="px-4 py-3 max-w-48"><div className="font-600 text-slate-700 truncate">{ev.title}</div>{ev.organizer_name && <div className="text-[11px] text-slate-400 mt-0.5">by {ev.organizer_name}</div>}</td>
                            <td className="px-4 py-3 text-slate-500 max-w-36 truncate">{ev.location_name || ev.district || '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{eventDate}</td>
                            <td className="px-4 py-3 text-slate-500">{ev.participant_count}/{ev.volunteer_capacity || '—'}</td>
                            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-md font-600 ${eventStatusColors[ev.status] || 'bg-slate-100 text-slate-600'}`}>{ev.status}</span></td>
                            <td className="px-4 py-3">
                              {updatingEventId === ev.id ? <span className="text-slate-400">Updating...</span> : (
                                <div className="flex gap-1.5">
                                  {ev.status === 'planned' && (
                                    <>
                                      <button onClick={() => void updateEventStatus(ev.id, 'approved')} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-600 rounded-lg font-600 hover:bg-green-100 cursor-pointer transition-all"><CheckCircle size={12} /> Approve</button>
                                      <button onClick={() => void updateEventStatus(ev.id, 'rejected')} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg font-600 hover:bg-red-100 cursor-pointer transition-all"><XCircle size={12} /> Reject</button>
                                    </>
                                  )}
                                  {ev.status === 'approved' && <button onClick={() => void updateEventStatus(ev.id, 'active')} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg font-600 hover:bg-blue-100 cursor-pointer transition-all">Mark Active</button>}
                                  {ev.status === 'active' && <button onClick={() => void updateEventStatus(ev.id, 'completed')} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-600 hover:bg-slate-200 cursor-pointer transition-all">Mark Completed</button>}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {statusMessage && <p className={`text-xs ${statusMessage.includes('updated') ? 'text-green-600' : 'text-red-600'}`}>{statusMessage}</p>}
        </main>
      </div>
    </div>
  )
}
