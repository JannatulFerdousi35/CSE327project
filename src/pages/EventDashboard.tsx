import { useEffect, useState, useCallback } from 'react'
import { Search, MapPin, Clock, Users, ChevronDown, RefreshCw, AlertCircle, Calendar, Plus, X } from 'lucide-react'
import type { Page, AuthUser } from '../App'

type Props = { onNavigate?: (page: Page, issueId?: number) => void; user: AuthUser | null }

type Event = {
  id: number
  organizer_id: number | null
  issue_id: number | null
  title: string
  description: string | null
  location_name: string | null
  division: string | null
  district: string | null
  upazila: string | null
  union_name: string | null
  village: string | null
  starts_at: string
  ends_at: string | null
  volunteer_capacity: number | null
  status: string
  created_at: string
  participant_count: number
}

const categoryColors: Record<string, string> = {
  Environment: 'bg-green-100 text-green-700',
  'Disaster Prep': 'bg-orange-100 text-orange-700',
  Healthcare: 'bg-rose-100 text-rose-700',
  Sanitation: 'bg-cyan-100 text-cyan-700',
  Education: 'bg-blue-100 text-blue-700',
}

const categoryEmoji: Record<string, string> = {
  Environment: '🌳',
  'Disaster Prep': '🌊',
  Healthcare: '🏥',
  Sanitation: '🧹',
  Education: '📚',
}

const eventImages = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1542601906897-d4be432e58fc?w=600&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1547407139-3c921a66005c?w=600&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1532996122724-e4c941c08f29?w=600&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&h=300&fit=crop&auto=format',
]

const fallbackGradients = [
  'from-green-400 to-emerald-500',
  'from-blue-400 to-indigo-500',
  'from-orange-400 to-rose-400',
  'from-teal-400 to-cyan-500',
  'from-violet-400 to-purple-500',
  'from-amber-400 to-orange-500',
]

function getEventCategory(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('clean') || t.includes('plant') || t.includes('tree') || t.includes('environment')) return 'Environment'
  if (t.includes('flood') || t.includes('cyclone') || t.includes('disaster')) return 'Disaster Prep'
  if (t.includes('health') || t.includes('medical') || t.includes('screen')) return 'Healthcare'
  if (t.includes('drain') || t.includes('sanit') || t.includes('latrine')) return 'Sanitation'
  if (t.includes('edu') || t.includes('workshop') || t.includes('forum') || t.includes('youth')) return 'Education'
  return 'Environment'
}

function formatDate(dateStr: string): { display: string; time: string; day: string; month: string } {
  const d = new Date(dateStr)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return {
    display: `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`,
    time: timeStr,
    day: String(d.getDate()),
    month: monthNames[d.getMonth()],
  }
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl card-shadow overflow-hidden animate-pulse">
      <div className="h-44 bg-slate-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="space-y-2">
          <div className="h-3 bg-slate-100 rounded w-full" />
          <div className="h-3 bg-slate-100 rounded w-2/3" />
        </div>
        <div className="h-8 bg-slate-100 rounded" />
      </div>
    </div>
  )
}

export default function EventDashboard({ onNavigate: _, user }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [myEventIds, setMyEventIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [district, setDistrict] = useState('All Districts')
  const [showMyEvents, setShowMyEvents] = useState(false)
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [showProposeForm, setShowProposeForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [proposeSuccess, setProposeSuccess] = useState('')
  const [proposeError, setProposeError] = useState('')
  const [proposeForm, setProposeForm] = useState({
    title: '', description: '', location_name: '', district: '', starts_at: '', volunteer_capacity: '',
  })

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [eventsRes, myEventsRes] = await Promise.all([
        fetch('http://localhost:5000/api/events', { credentials: 'include' }),
        user ? fetch('http://localhost:5000/api/events/my-events', { credentials: 'include' }) : null,
      ])
      const eventsData = await eventsRes.json() as { success: boolean; events?: Event[]; message?: string }
      if (!eventsData.success || !eventsData.events) throw new Error(eventsData.message || 'Failed to load events')
      setEvents(eventsData.events)

      if (myEventsRes) {
        const myData = await myEventsRes.json() as { success: boolean; events?: Event[] }
        if (myData.success && myData.events) {
          setMyEventIds(new Set(myData.events.map((e) => e.id)))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load events')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const handleJoinLeave = async (eventId: number) => {
    if (!user) return
    const isJoined = myEventIds.has(eventId)
    setJoiningId(eventId)
    try {
      if (isJoined) {
        const res = await fetch(`http://localhost:5000/api/events/${eventId}/leave`, { method: 'DELETE', credentials: 'include' })
        const data = await res.json() as { success: boolean; message?: string }
        if (!data.success) throw new Error(data.message || 'Failed to leave event')
        setMyEventIds((prev) => { const next = new Set(prev); next.delete(eventId); return next })
        setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, participant_count: Math.max(0, e.participant_count - 1) } : e))
      } else {
        const res = await fetch(`http://localhost:5000/api/events/${eventId}/join`, { method: 'POST', credentials: 'include' })
        const data = await res.json() as { success: boolean; message?: string }
        if (!data.success) throw new Error(data.message || 'Failed to join event')
        setMyEventIds((prev) => new Set([...prev, eventId]))
        setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, participant_count: e.participant_count + 1 } : e))
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setJoiningId(null)
    }
  }

  const handleProposeEvent = async () => {
    setProposeError('')
    setProposeSuccess('')
    if (!proposeForm.title.trim() || !proposeForm.starts_at) {
      setProposeError('Title and start date are required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('http://localhost:5000/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: proposeForm.title.trim(),
          description: proposeForm.description.trim() || null,
          location_name: proposeForm.location_name.trim() || null,
          district: proposeForm.district.trim() || null,
          starts_at: proposeForm.starts_at,
          volunteer_capacity: proposeForm.volunteer_capacity ? Number(proposeForm.volunteer_capacity) : null,
        }),
      })
      const data = await res.json() as { success: boolean; message?: string }
      if (!data.success) throw new Error(data.message || 'Failed to submit proposal')
      setProposeSuccess('Event proposal submitted! An admin will review it shortly.')
      setProposeForm({ title: '', description: '', location_name: '', district: '', starts_at: '', volunteer_capacity: '' })
      setTimeout(() => { setShowProposeForm(false); setProposeSuccess('') }, 2500)
    } catch (err) {
      setProposeError(err instanceof Error ? err.message : 'Unable to submit proposal')
    } finally {
      setSubmitting(false)
    }
  }

  const districts = ['All Districts', ...Array.from(new Set(events.map((e) => e.district).filter(Boolean)))].sort((a, b) => a === 'All Districts' ? -1 : b === 'All Districts' ? 1 : a.localeCompare(b))

  const filtered = events.filter((e) => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) || (e.description || '').toLowerCase().includes(search.toLowerCase()) || (e.location_name || '').toLowerCase().includes(search.toLowerCase())
    const matchDistrict = district === 'All Districts' || e.district === district
    const matchMy = !showMyEvents || myEventIds.has(e.id)
    return matchSearch && matchDistrict && matchMy
  })

  const totalParticipants = events.reduce((sum, e) => sum + e.participant_count, 0)
  const totalCapacity = events.reduce((sum, e) => sum + (e.volunteer_capacity || 0), 0)

  if (loading) {
    return (
      <div className="max-w-[1000px] space-y-5 pb-20">
        <div>
          <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-[1000px] pb-20">
        <div className="bg-white rounded-2xl card-shadow py-16 text-center">
          <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <p className="text-sm font-600 text-slate-700">{error}</p>
          <button onClick={fetchEvents} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-600 hover:bg-green-600 transition-all cursor-pointer">
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1000px] space-y-5 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-700 text-slate-900">Community Events</h1>
          <p className="text-sm text-slate-500 mt-0.5">কমিউনিটি ইভেন্টে যোগ দিন এবং পরিবর্তন আনুন</p>
        </div>
        {user && (
          <button
            onClick={() => { setShowProposeForm(!showProposeForm); setProposeError(''); setProposeSuccess('') }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-600 hover:bg-green-600 transition-all cursor-pointer shadow-md shadow-green-100"
          >
            <Plus size={15} /> Propose Event
          </button>
        )}
      </div>

      {showProposeForm && (
        <div className="bg-white rounded-2xl card-shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-700 text-slate-800">Propose a Community Event</h3>
            <button onClick={() => setShowProposeForm(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X size={16} /></button>
          </div>
          <p className="text-xs text-slate-500 mb-4">Your proposal will be reviewed by an admin before it becomes public.</p>

          {proposeSuccess && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{proposeSuccess}</div>
          )}
          {proposeError && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{proposeError}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-600 text-slate-600 mb-1">Event Title *</label>
              <input value={proposeForm.title} onChange={(e) => setProposeForm({ ...proposeForm, title: e.target.value })} placeholder="e.g. Community Cleanup Drive" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-green-200" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-600 text-slate-600 mb-1">Start Date & Time *</label>
              <input type="datetime-local" value={proposeForm.starts_at} onChange={(e) => setProposeForm({ ...proposeForm, starts_at: e.target.value })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-green-200" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-600 text-slate-600 mb-1">Description</label>
              <textarea value={proposeForm.description} onChange={(e) => setProposeForm({ ...proposeForm, description: e.target.value })} rows={2} placeholder="What is this event about?" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-green-200 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-600 text-slate-600 mb-1">Location</label>
              <input value={proposeForm.location_name} onChange={(e) => setProposeForm({ ...proposeForm, location_name: e.target.value })} placeholder="e.g. Mirzapur Community Hall" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-green-200" />
            </div>
            <div>
              <label className="block text-xs font-600 text-slate-600 mb-1">District</label>
              <input value={proposeForm.district} onChange={(e) => setProposeForm({ ...proposeForm, district: e.target.value })} placeholder="e.g. Tangail" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-green-200" />
            </div>
            <div>
              <label className="block text-xs font-600 text-slate-600 mb-1">Volunteer Capacity</label>
              <input type="number" min="1" value={proposeForm.volunteer_capacity} onChange={(e) => setProposeForm({ ...proposeForm, volunteer_capacity: e.target.value })} placeholder="e.g. 30" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-green-200" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleProposeEvent} disabled={submitting} className="px-5 py-2.5 bg-green-500 text-white rounded-xl text-sm font-600 hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-all">
              {submitting ? 'Submitting...' : 'Submit Proposal'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: '📅', label: 'Upcoming Events', value: String(events.length), color: 'bg-blue-50 border-blue-100' },
          { icon: '👥', label: 'Total Participants', value: totalParticipants.toLocaleString(), color: 'bg-green-50 border-green-100' },
          { icon: '🫂', label: 'Events Joined', value: String(myEventIds.size), color: 'bg-orange-50 border-orange-100' },
        ].map((s) => (
          <div key={s.label} className={`${s.color} border rounded-2xl p-4 flex items-center gap-3 card-shadow`}>
            <span className="text-3xl">{s.icon}</span>
            <div>
              <div className="text-xl font-700 text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-green-200 focus:border-green-300 transition-all card-shadow"
          />
        </div>
        <div className="relative">
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="appearance-none bg-white border border-slate-200 rounded-xl pl-4 pr-9 py-2.5 text-sm text-slate-700 cursor-pointer focus:ring-2 focus:ring-green-200 card-shadow"
          >
            {districts.map((d) => <option key={d}>{d}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        {user && (
          <button
            onClick={() => setShowMyEvents(!showMyEvents)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-600 cursor-pointer transition-all border card-shadow ${
              showMyEvents ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Calendar size={14} />
            My Events
          </button>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-5">
          {filtered.map((ev) => {
            const isJoined = myEventIds.has(ev.id)
            const isJoining = joiningId === ev.id
            const category = getEventCategory(ev.title)
            const dateInfo = formatDate(ev.starts_at)
            const capacity = ev.volunteer_capacity || 0
            const spots = capacity > 0 ? capacity - ev.participant_count : null
            const pct = capacity > 0 ? (ev.participant_count / capacity) * 100 : 0
            const full = spots !== null && spots <= 0
            const imgIndex = ev.id % eventImages.length

            return (
              <div key={ev.id} className="bg-white rounded-2xl card-shadow overflow-hidden group hover:shadow-lg transition-all">
                <div className="relative h-44 overflow-hidden bg-slate-100">
                  <img
                    src={eventImages[imgIndex]}
                    alt={ev.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-700 ${categoryColors[category] || 'bg-slate-100 text-slate-600'}`}>
                      {categoryEmoji[category] || '📌'} {category}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <div className="bg-white rounded-xl px-3 py-2 text-center shadow-lg">
                      <div className="text-[10px] font-700 text-green-600 leading-none">{dateInfo.month}</div>
                      <div className="text-lg font-700 text-slate-900 leading-tight">{dateInfo.day}</div>
                    </div>
                  </div>
                  {ev.status && ev.status !== 'planned' && (
                    <div className="absolute top-3 right-3">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-700 ${ev.status === 'active' ? 'bg-green-500 text-white' : ev.status === 'completed' ? 'bg-slate-500 text-white' : 'bg-red-500 text-white'}`}>
                        {ev.status}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-700 text-slate-800 mb-0.5 leading-snug">{ev.title}</h3>
                  {ev.description && <p className="text-[11px] text-slate-400 mb-2 line-clamp-2">{ev.description}</p>}
                  <div className="space-y-1 text-xs text-slate-500 mb-3">
                    <div className="flex items-center gap-1.5"><Clock size={12} />{dateInfo.display} • {dateInfo.time}</div>
                    {ev.location_name && <div className="flex items-center gap-1.5"><MapPin size={12} />{ev.location_name}</div>}
                  </div>
                  {capacity > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                        <span className="flex items-center gap-1"><Users size={11} /> {ev.participant_count}/{capacity} participants</span>
                        <span className={spots !== null && spots <= 5 ? 'text-red-500 font-700' : 'text-slate-400'}>
                          {full ? 'Full' : spots !== null ? `${spots} spots left` : ''}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${full ? 'bg-red-400' : pct > 80 ? 'bg-orange-400' : 'bg-green-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {user ? (
                      <>
                        <button className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-600 hover:bg-slate-50 cursor-pointer transition-all">
                          View Details
                        </button>
                        <button
                          onClick={() => handleJoinLeave(ev.id)}
                          disabled={isJoining || full}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-700 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isJoined
                              ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 border border-slate-200'
                              : 'bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-100'
                          }`}
                        >
                          {isJoining ? '...' : isJoined ? '✓ Joined' : full ? 'Full' : 'Join Event'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => _?.('login')}
                        className="w-full py-2.5 bg-green-500 text-white rounded-xl text-xs font-700 hover:bg-green-600 cursor-pointer transition-all shadow-md shadow-green-100"
                      >
                        Login to Join
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow py-16 text-center">
          <div className="text-4xl mb-3">📅</div>
          {showMyEvents ? (
            <>
              <p className="text-sm font-600 text-slate-700">You haven't joined any events yet</p>
              <p className="text-xs text-slate-400 mt-1">Browse events and click "Join Event" to get started.</p>
              <button onClick={() => setShowMyEvents(false)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-600 hover:bg-green-600 transition-all cursor-pointer">
                Browse Events
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-600 text-slate-700">No community events yet</p>
              <p className="text-xs text-slate-400 mt-1">Check back later or propose an event to get started.</p>
              {user && (
                <button onClick={() => setShowProposeForm(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-600 hover:bg-green-600 transition-all cursor-pointer">
                  <Plus size={14} /> Propose an Event
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
