import { useEffect, useState } from 'react'
import { MapPin, Clock, Users, ChevronLeft, CheckCircle, Share2, Package } from 'lucide-react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { Icon } from 'leaflet'
import type { Page } from '../App'

type Props = {
  onNavigate: (page: Page) => void
  issueId: number | null
}

const detailsLocationMarker = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

type Issue = {
  id: number
  title: string
  description: string
  category: string
  priority: string | null
  status: string | null
  division: string | null
  district: string | null
  upazila: string | null
  union_name: string | null
  village: string | null
  latitude: number | string | null
  longitude: number | string | null
  image_url: string | null
  created_at: string
}

type IssueImage = {
  id: number
  issue_id: number
  uploaded_by: number | null
  image_url: string
  caption: string | null
  is_primary: boolean
  created_at: string
}

type AIAnalysis = {
  id: number
  issue_id: number
  summary: string
  recommended_priority: 'High' | 'Medium' | 'Low'
  estimated_budget: number | string | null
  estimated_volunteers: number | null
  confidence_score: number | string | null
  raw_result: unknown
  analyzed_at: string
  created_at: string
  updated_at: string
}

type ImageAnalysis = {
  provider?: string
  detected_issue: string
  category: 'Road' | 'Water' | 'Flood' | 'Garbage' | 'School' | 'Electricity' | 'Sanitation' | 'Environment' | 'Other'
  severity: 'Low' | 'Medium' | 'High'
  confidence_score: number
  description: string
  matches_report: boolean
}

type ActionPlan = {
  action_plan: string[]
  required_resources: string[]
  estimated_time: string
  notes: string
}

type VolunteerRecommendation = {
  volunteer_id: number
  name: string
  skills: string
  location: string
  reason: string
  match_score: number
}

const formatDate = (date: string) => new Date(date).toLocaleDateString('en-BD', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export default function IssueDetailsPage({ onNavigate, issueId }: Props) {
  const [issue, setIssue] = useState<Issue | null>(null)
  const [images, setImages] = useState<IssueImage[]>([])
  const [selectedImage, setSelectedImage] = useState<IssueImage | null>(null)
  const [aiAnalysis, setAIAnalysis] = useState<AIAnalysis | null>(null)
  const [aiLoading, setAILoading] = useState(false)
  const [aiError, setAIError] = useState('')
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null)
  const [actionPlanLoading, setActionPlanLoading] = useState(false)
  const [actionPlanError, setActionPlanError] = useState(false)
  const [actionPlanMissing, setActionPlanMissing] = useState(false)
  const [actionPlanGenerating, setActionPlanGenerating] = useState(false)
  const [actionPlanReloadKey, setActionPlanReloadKey] = useState(0)
  const [volunteerRecommendations, setVolunteerRecommendations] = useState<VolunteerRecommendation[]>([])
  const [volunteerLoading, setVolunteerLoading] = useState(false)
  const [volunteerError, setVolunteerError] = useState(false)
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null)
  const [imageAnalysisLoading, setImageAnalysisLoading] = useState(false)
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
  const [imageAnalysisError, setImageAnalysisError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setIssue(null)
    setImages([])
    setSelectedImage(null)
    setAIAnalysis(null)
    setAILoading(false)
    setActionPlan(null)
    setActionPlanLoading(false)
    setActionPlanError(false)
    setActionPlanMissing(false)
    setActionPlanGenerating(false)
    setVolunteerRecommendations([])
    setVolunteerLoading(false)
    setVolunteerError(false)
    setVolunteered(false)
    setVolunteerActionError('')
    setError('')

    if (!issueId) {
      setLoading(false)
      return
    }

    setLoading(true)

    const fetchIssue = async () => {
      try {
        const issueResponse = await fetch(`http://localhost:5000/api/issues/${issueId}`)
        const issueData = await issueResponse.json() as { success: boolean; issue?: Issue; message?: string }

        if (!issueResponse.ok || !issueData.success || !issueData.issue) {
          throw new Error(issueData.message || 'Failed to fetch issue details.')
        }

        setIssue(issueData.issue)
      } catch (error) {
        console.error('Failed to fetch issue:', error)
        setError('Failed to load this issue. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    const fetchImages = async () => {
      try {
        const imagesResponse = await fetch(`http://localhost:5000/api/issues/${issueId}/images`)
        const imagesData = await imagesResponse.json() as { success: boolean; images?: IssueImage[]; message?: string }

        if (!imagesResponse.ok || !imagesData.success) {
          throw new Error(imagesData.message || 'Failed to fetch issue images.')
        }

        const issueImages = imagesData.images || []
        setImages(issueImages)
        setSelectedImage(issueImages.find((image) => image.is_primary) || issueImages[0] || null)
      } catch (error) {
        console.error('Failed to fetch issue images:', error)
      }
    }

    fetchIssue()
    fetchImages()
  }, [issueId])

  useEffect(() => {
    if (!issueId || !issue) {
      return
    }

    const fetchAIAnalysis = async () => {
      setAILoading(true)
      setAIError('')

      try {
        const response = await fetch(`http://localhost:5000/api/issues/${issueId}/ai-analysis`)
        const data = await response.json() as { success: boolean; analysis?: AIAnalysis; message?: string }

        if (response.ok && data.success && data.analysis) {
          setAIAnalysis(data.analysis)
          setAIError('')
          return
        }

        if (response.status === 404 || data.message === 'AI analysis not available.') {
          setAIAnalysis(null)
          setAIError('')
          return
        }

        setAIAnalysis(null)
        setAIError('AI assessment could not be loaded right now.')
      } catch (error) {
        console.error('Failed to fetch AI analysis:', error)
        setAIAnalysis(null)
        setAIError('AI assessment could not be loaded right now.')
      } finally {
        setAILoading(false)
      }
    }

    fetchAIAnalysis()
  }, [issueId, issue])

  useEffect(() => {
    if (!issueId || !issue) {
      return
    }

    let cancelled = false
    setActionPlanLoading(true)
    setActionPlanError(false)
    setActionPlanMissing(false)

    fetch(`http://localhost:5000/api/issues/${issueId}/action-plan`)
      .then(async (response) => {
        const data = await response.json() as { success?: boolean; action_plan?: ActionPlan; message?: string }

        if (!cancelled && response.ok && data.success && data.action_plan) {
          setActionPlan(data.action_plan)
          return
        }

        if (!cancelled && response.status === 404) {
          setActionPlan(null)
          setActionPlanMissing(true)
          return
        }

        throw new Error(data.message || 'Failed to load action plan.')
      })
      .catch((error) => {
        console.error('Failed to load action plan:', error)
        if (!cancelled) {
          setActionPlan(null)
          setActionPlanError(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setActionPlanLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [issueId, issue, actionPlanReloadKey])

  useEffect(() => {
    if (!issueId || !issue) {
      return
    }

    const refreshImageAnalysis = async () => {
      if (!images.length) {
        setImageAnalysis(null)
        setImageAnalysisError('')
        return
      }

      setImageAnalysisLoading(true)
      setImageAnalysisError('')

      try {
        const response = await fetch(`http://localhost:5000/api/issues/${issueId}/image-analysis`)
        const data = await response.json() as { success: boolean; analysis?: ImageAnalysis; message?: string }

        if (response.ok && data.success && data.analysis) {
          setImageAnalysis(data.analysis)
          return
        }

        if (response.status === 404 || data.message === 'AI image analysis not available.') {
          setImageAnalysis(null)
          return
        }

        setImageAnalysis(null)
        setImageAnalysisError('AI image analysis is temporarily unavailable.')
      } catch (error) {
        console.error('Failed to fetch AI image analysis:', error)
        setImageAnalysis(null)
        setImageAnalysisError('AI image analysis is temporarily unavailable.')
      } finally {
        setImageAnalysisLoading(false)
      }
    }

    refreshImageAnalysis()
  }, [issueId, issue, images.length])

  useEffect(() => {
    if (!issueId || !issue) return

    let cancelled = false
    setVolunteerLoading(true)
    setVolunteerError(false)

    fetch(`http://localhost:5000/api/issues/${issueId}/recommended-volunteers`)
      .then(async (response) => {
        const data = await response.json() as { success?: boolean; recommendations?: VolunteerRecommendation[] }
        if (!response.ok || !data.success) throw new Error('Volunteer recommendations failed.')
        if (!cancelled) setVolunteerRecommendations(data.recommendations || [])
      })
      .catch((error) => {
        console.error('Failed to load volunteer recommendations:', error)
        if (!cancelled) {
          setVolunteerRecommendations([])
          setVolunteerError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setVolunteerLoading(false)
      })

    return () => { cancelled = true }
  }, [issueId, issue])

  useEffect(() => {
    if (!issueId || !issue) {
      return
    }

    let cancelled = false
    setVolunteerActionError('')

    fetch(`http://localhost:5000/api/issues/${issueId}/volunteer-status`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json() as { success?: boolean; joined?: boolean }
        if (!cancelled && response.ok && data.success) {
          setVolunteered(Boolean(data.joined))
        }
      })
      .catch((error) => {
        console.error('Failed to check volunteer status:', error)
      })

    return () => { cancelled = true }
  }, [issueId, issue])

  const handleJoinAsVolunteer = async () => {
    if (!issueId || volunteered || volunteerActionPending) {
      return
    }

    setVolunteerActionPending(true)
    setVolunteerActionError('')

    try {
      const response = await fetch(`http://localhost:5000/api/issues/${issueId}/volunteer`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json() as { success?: boolean; message?: string }

      if ((response.ok && data.success) || response.status === 409) {
        setVolunteered(true)
        return
      }

      setVolunteerActionError(data.message || 'Could not join as a volunteer right now.')
    } catch (error) {
      console.error('Failed to join as volunteer:', error)
      setVolunteerActionError('Could not join as a volunteer right now.')
    } finally {
      setVolunteerActionPending(false)
    }
  }

  const handleGenerateActionPlan = async () => {
    if (!issueId || actionPlanGenerating) {
      return
    }

    setActionPlanGenerating(true)
    setActionPlanError(false)
    setActionPlanMissing(false)

    try {
      const response = await fetch(`http://localhost:5000/api/ai/action-plan/${issueId}`, { method: 'POST' })
      const data = await response.json() as { success?: boolean; action_plan?: ActionPlan; message?: string }

      if (!response.ok || !data.success || !data.action_plan) {
        throw new Error(data.message || 'Action plan request failed.')
      }

      setActionPlan(data.action_plan)
    } catch (error) {
      console.error('Failed to generate action plan:', error)
      setActionPlan(null)
      setActionPlanMissing(true)
      setActionPlanError(true)
    } finally {
      setActionPlanGenerating(false)
    }
  }

  const handleAnalyzeImages = async () => {
    if (!issueId || !images.length || isAnalyzingImage) {
      return
    }

    setIsAnalyzingImage(true)
    setImageAnalysisError('')

    try {
      const response = await fetch(`http://localhost:5000/api/ai/image-analysis/${issueId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Image analysis request failed.')
      }

      const data = await response.json() as { success?: boolean; message?: string }

      if (!data.success) {
        throw new Error(data.message || 'Image analysis request failed.')
      }

      const imageResponse = await fetch(`http://localhost:5000/api/issues/${issueId}/image-analysis`)
      const imageData = await imageResponse.json() as { success: boolean; analysis?: ImageAnalysis; message?: string }

      if (imageResponse.ok && imageData.success && imageData.analysis) {
        setImageAnalysis(imageData.analysis)
        setImageAnalysisError('')
        return
      }

      setImageAnalysis(null)
      setImageAnalysisError('AI image analysis is temporarily unavailable.')
    } catch (error) {
      console.error('Failed to analyze images:', error)
      setImageAnalysis(null)
      setImageAnalysisError('AI image analysis is temporarily unavailable.')
    } finally {
      setIsAnalyzingImage(false)
    }
  }

  const [confirmed, setConfirmed] = useState(false)
  const [volunteered, setVolunteered] = useState(false)
  const [volunteerActionPending, setVolunteerActionPending] = useState(false)
  const [volunteerActionError, setVolunteerActionError] = useState('')
  const issueLabel = issueId ? `Issue #${issueId}` : 'Issue Details'

  const priorityStyles: Record<string, string> = {
    High: 'border-red-200 bg-red-50 text-red-700',
    Medium: 'border-amber-200 bg-amber-50 text-amber-700',
    Low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }

  const imageSeverityStyles: Record<string, string> = {
    High: 'border-red-200 bg-red-50 text-red-700',
    Medium: 'border-amber-200 bg-amber-50 text-amber-700',
    Low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }

  const formatBudget = (budget: number | string | null) => {
    if (budget === null || budget === undefined || budget === '') {
      return 'Not provided'
    }

    const numericValue = Number(budget)

    if (!Number.isFinite(numericValue)) {
      return 'Not provided'
    }

    return `৳${new Intl.NumberFormat('en-BD', {
      maximumFractionDigits: 0,
    }).format(numericValue)}`
  }

  const formatConfidence = (confidence: number | string | null) => {
    const numericValue = Number(confidence)
    return Number.isFinite(numericValue) ? `${Math.round(numericValue * 100)}%` : 'Not provided'
  }

  const issueLatitude = issue ? Number(issue.latitude) : NaN
  const issueLongitude = issue ? Number(issue.longitude) : NaN
  const hasIssueCoordinates = Number.isFinite(issueLatitude) && Number.isFinite(issueLongitude)

  if (loading) {
    return (
      <div className="max-w-[1000px] space-y-5 pb-20">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-green-700 transition-colors cursor-pointer font-500"
        >
          <ChevronLeft size={17} /> Back to Home
        </button>
        <div className="bg-white rounded-2xl card-shadow p-8 text-center text-sm text-slate-500">
          Loading issue details for {issueLabel}...
        </div>
      </div>
    )
  }

  if (error || !issue) {
    return (
      <div className="max-w-[1000px] space-y-5 pb-20">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-green-700 transition-colors cursor-pointer font-500"
        >
          <ChevronLeft size={17} /> Back to Home
        </button>
        <div className="bg-white rounded-2xl card-shadow p-8 text-center text-sm text-slate-500">
          {error || 'Issue details are unavailable.'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1000px] space-y-5 pb-20">
      <button
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-green-700 transition-colors cursor-pointer font-500"
      >
        <ChevronLeft size={17} /> Back to Home
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="relative h-60 md:h-80 lg:h-88 bg-slate-100">
              {selectedImage ? (
                <>
                  <img
                    src={selectedImage.image_url}
                    alt={selectedImage.caption || issue.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  No images available
                </div>
              )}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="bg-green-500 text-white text-xs font-700 px-3 py-1 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" /> {issue.status || 'Reported'}
                  </span>
                  <span className="bg-white/25 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full border border-white/30">
                    {issue.category}
                  </span>
                </div>
                <h1 className="text-xl font-700 text-white leading-snug">{issue.title}</h1>
              </div>
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 p-4 overflow-x-auto">
                {images.map((image) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(image)}
                    className={`w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 cursor-pointer transition-all ${
                      selectedImage?.id === image.id ? 'border-green-500' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={image.image_url}
                      alt={image.caption || 'Issue thumbnail'}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="p-5">
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap mb-4">
                <span className="flex items-center gap-1"><MapPin size={13} className="text-green-500" /> {issue.village || 'Location not provided'}, {issue.district || 'District not provided'}</span>
                <span className="flex items-center gap-1"><Clock size={13} /> Reported {formatDate(issue.created_at)}</span>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-5">{issue.description}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmed(!confirmed)}
                  className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all cursor-pointer ${
                    confirmed ? 'border-green-400 bg-green-50 text-green-700' : 'border-slate-200 hover:border-green-200 hover:bg-green-50/50 text-slate-600'
                  }`}
                >
                  <span className="text-2xl">{confirmed ? '✅' : '👍'}</span>
                  <span className="text-xs font-700">{confirmed ? 'Confirmed!' : 'Confirm Problem'}</span>
                  <span className="text-[11px] text-slate-400">I also see this issue</span>
                </button>
                <button
                  type="button"
                  onClick={handleJoinAsVolunteer}
                  disabled={volunteered || volunteerActionPending}
                  className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${
                    volunteered ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 text-slate-600 cursor-pointer'
                  }`}
                >
                  <span className="text-2xl">🤝</span>
                  <span className="text-xs font-700">{volunteered ? 'Joined as Volunteer' : volunteerActionPending ? 'Joining...' : 'Join as Volunteer'}</span>
                  <span className="text-[11px] text-slate-400">Help fix this issue</span>
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center gap-2 py-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <Package size={18} className="text-slate-600" />
                  <span className="text-xs font-700">Offer Materials</span>
                  <span className="text-[11px] text-slate-400">Support with supplies</span>
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center gap-2 py-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <Share2 size={18} className="text-slate-600" />
                  <span className="text-xs font-700">Share</span>
                  <span className="text-[11px] text-slate-400">Spread awareness</span>
                </button>
              </div>
              {volunteerActionError && (
                <p className="mt-3 text-xs text-red-600">{volunteerActionError}</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="text-sm font-700 text-slate-800 mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-green-500" /> Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-slate-600">
              {[
                ['Village / Area', issue.village],
                ['Union / Ward', issue.union_name],
                ['Upazila', issue.upazila],
                ['District', issue.district],
                ['Division', issue.division],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className="font-600 text-slate-700">{value || 'Not provided'}</div>
                </div>
              ))}
            </div>
            {hasIssueCoordinates && (
              <>
                <div className="h-56 rounded-xl overflow-hidden border border-slate-200 mt-5">
                  <MapContainer center={[issueLatitude, issueLongitude]} zoom={14} scrollWheelZoom={false} dragging={false} className="h-full w-full">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[issueLatitude, issueLongitude]} icon={detailsLocationMarker} />
                  </MapContainer>
                </div>
                <div className="text-xs text-slate-500 mt-3">
                  Coordinates: {issueLatitude.toFixed(6)}, {issueLongitude.toFixed(6)}
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="text-sm font-700 text-slate-800 mb-4">Issue Information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                ['Category', issue.category],
                ['Priority', issue.priority || 'Not provided'],
                ['Status', issue.status || 'Not provided'],
                ['Reported', formatDate(issue.created_at)],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className="text-sm font-700 text-slate-700 mt-1">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="text-sm font-700 text-slate-800 mb-3">AI Priority Assessment</h3>
            {aiLoading && (
              <p className="text-xs text-slate-500">Analyzing issue...</p>
            )}
            {!aiLoading && aiAnalysis && (
              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span className="sr-only">Priority</span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-700 ${priorityStyles[aiAnalysis.recommended_priority] || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                    {aiAnalysis.recommended_priority}
                  </span>
                </div>
                <p className="leading-relaxed text-slate-600">{aiAnalysis.summary || 'No summary provided.'}</p>
                <div className="flex items-center justify-between gap-3">
                  <span>Confidence</span>
                  <span className="font-700 text-slate-800">{formatConfidence(aiAnalysis.confidence_score)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Estimated volunteers</span>
                  <span className="font-700 text-slate-800">{aiAnalysis.estimated_volunteers ?? 'Not provided'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Estimated budget</span>
                  <span className="font-700 text-slate-800">{formatBudget(aiAnalysis.estimated_budget)}</span>
                </div>
                <p className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">AI-generated estimate. Please verify with local conditions.</p>
              </div>
            )}
            {!aiLoading && !aiAnalysis && !aiError && (
              <p className="text-xs text-slate-500">AI assessment is not available yet.</p>
            )}
            {!aiLoading && aiError && (
              <p className="text-xs text-slate-500">AI assessment unavailable.</p>
            )}
          </div>

          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="text-sm font-700 text-slate-800 mb-3">AI Action Plan</h3>
            {(actionPlanLoading || actionPlanGenerating) && (
              <p className="text-xs text-slate-500">{actionPlanGenerating ? 'Generating action plan...' : 'Loading action plan...'}</p>
            )}
            {!actionPlanLoading && !actionPlanGenerating && actionPlan && (
              <div className="space-y-4 text-xs text-slate-600">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">Steps</div>
                  <ol className="list-decimal pl-4 space-y-2">
                    {actionPlan.action_plan.map((action) => (
                      <li key={action} className="pl-1 leading-relaxed">{action}</li>
                    ))}
                  </ol>
                </div>
                {actionPlan.required_resources.length > 0 && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">Required Resources</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {actionPlan.required_resources.map((resource) => (
                        <li key={resource}>{resource}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span>Estimated time</span>
                  <span className="font-700 text-slate-800">{actionPlan.estimated_time}</span>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Notes</div>
                  <p className="leading-relaxed">{actionPlan.notes}</p>
                </div>
                <p className="text-[11px] text-slate-400">
                  AI-generated suggestions. Verify with local conditions and authorities.
                </p>
              </div>
            )}
            {!actionPlanLoading && !actionPlanGenerating && !actionPlan && actionPlanMissing && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">No action plan exists for this issue yet.</p>
                {actionPlanError && (
                  <p className="text-xs text-red-600">Couldn't generate the action plan. Please try again.</p>
                )}
                <button
                  type="button"
                  onClick={handleGenerateActionPlan}
                  disabled={actionPlanGenerating}
                  className="w-full rounded-xl border border-green-200 bg-green-50 text-green-700 text-xs font-700 py-2.5 hover:bg-green-100 cursor-pointer transition-all"
                >
                  Generate Action Plan
                </button>
              </div>
            )}
            {!actionPlanLoading && !actionPlanGenerating && !actionPlan && !actionPlanMissing && actionPlanError && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Action plan could not be loaded right now.</p>
                <button
                  type="button"
                  onClick={() => setActionPlanReloadKey((key) => key + 1)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs font-700 py-2.5 hover:bg-slate-100 cursor-pointer transition-all"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="text-sm font-700 text-slate-800 mb-3">AI Image Assessment</h3>
            {imageAnalysisLoading && (
              <p className="text-xs text-slate-500">AI image assessment is being prepared...</p>
            )}
            {!imageAnalysisLoading && imageAnalysis && (
              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span>Detected issue</span>
                  <span className="font-700 text-slate-800 text-right">{imageAnalysis.detected_issue}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Category</span>
                  <span className="font-700 text-slate-800">{imageAnalysis.category}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Severity</span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-700 ${imageSeverityStyles[imageAnalysis.severity] || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                    {imageAnalysis.severity}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Confidence</span>
                  <span className="font-700 text-slate-800">{Math.round(Number(imageAnalysis.confidence_score) * 100)}%</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Matches reported issue</span>
                  <span className="font-700 text-slate-800">{imageAnalysis.matches_report ? 'Yes' : 'No'}</span>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Description</div>
                  <p className="leading-relaxed text-slate-600">{imageAnalysis.description}</p>
                </div>
              </div>
            )}
            {!imageAnalysisLoading && !imageAnalysis && !imageAnalysisError && images.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Image has not been analyzed yet.</p>
                <button
                  type="button"
                  onClick={handleAnalyzeImages}
                  disabled={isAnalyzingImage}
                  className={`w-full rounded-xl border text-xs font-700 py-2.5 transition-all ${
                    isAnalyzingImage
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer'
                  }`}
                >
                  {isAnalyzingImage ? 'Analyzing...' : 'Analyze Images with AI'}
                </button>
              </div>
            )}
            {!imageAnalysisLoading && !imageAnalysis && !imageAnalysisError && images.length === 0 && (
              <p className="text-xs text-slate-500">No images available for AI analysis.</p>
            )}
            {!imageAnalysisLoading && imageAnalysisError && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">{imageAnalysisError}</p>
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAnalyzeImages}
                    disabled={isAnalyzingImage}
                    className={`w-full rounded-xl border text-xs font-700 py-2.5 transition-all ${
                      isAnalyzingImage
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer'
                    }`}
                  >
                    {isAnalyzingImage ? 'Analyzing...' : 'Analyze Images with AI'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="text-sm font-700 text-slate-800 mb-3">Recommended Volunteers</h3>
            {volunteerLoading && (
              <p className="text-xs text-slate-500">Finding suitable volunteers...</p>
            )}
            {!volunteerLoading && volunteerError && (
              <p className="text-xs text-slate-500">Volunteer recommendations are currently unavailable.</p>
            )}
            {!volunteerLoading && !volunteerError && volunteerRecommendations.length === 0 && (
              <p className="text-xs text-slate-500">No suitable volunteers found yet.</p>
            )}
            {!volunteerLoading && !volunteerError && volunteerRecommendations.length > 0 && (
              <div className="space-y-3">
                {volunteerRecommendations.map((volunteer) => (
                  <div key={volunteer.volunteer_id} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-700 text-slate-800">{volunteer.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{volunteer.skills}</div>
                      </div>
                      <span className="text-[11px] font-700 text-green-700">{Math.round(volunteer.match_score * 100)}% match</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <MapPin size={12} className="text-green-500" /> {volunteer.location}
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5">{volunteer.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="text-sm font-700 text-slate-800 mb-4">Community Response</h3>
            <div className="space-y-3 text-xs text-slate-500">
              <div className="flex items-center gap-2"><Users size={14} className="text-green-500" /> Community confirmations will appear here.</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> Volunteer participation will appear here.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


