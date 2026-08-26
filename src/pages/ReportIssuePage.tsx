import { useEffect, useRef, useState } from 'react'
import { Camera, MapPin, Navigation, ChevronRight, X, Upload } from 'lucide-react'
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Icon, type LatLngExpression } from 'leaflet'
import type { Page } from '../App'

type Props = { onNavigate: (page: Page, issueId?: number) => void }

const bangladeshCenter: LatLngExpression = [23.685, 90.3563]
const locationMarker = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function MapLocationPicker({ onSelect }: { onSelect: (coordinates: [number, number]) => void }) {
  useMapEvents({
    click: ({ latlng }) => onSelect([latlng.lat, latlng.lng]),
  })

  return null
}

function RecenterMap({ coordinates }: { coordinates: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (coordinates) {
      map.setView(coordinates, Math.max(map.getZoom(), 13))
    }
  }, [coordinates, map])

  return null
}

const categories = [
  { id: 'road',        icon: '🛣️', label: 'Road',        desc: 'Broken road, bridge, path' },
  { id: 'water',       icon: '💧', label: 'Water',       desc: 'Tube well, drinking water' },
  { id: 'flood',       icon: '🌊', label: 'Flood',       desc: 'Waterlogging, flooding' },
  { id: 'garbage',     icon: '🗑️', label: 'Garbage',     desc: 'Waste, plastic, littering' },
  { id: 'school',      icon: '🏫', label: 'School',      desc: 'Classroom, furniture damage' },
  { id: 'electricity', icon: '💡', label: 'Electricity', desc: 'Street light, electric pole' },
  { id: 'sanitation',  icon: '🚽', label: 'Sanitation',  desc: 'Drainage, toilet facilities' },
  { id: 'environment', icon: '🌱', label: 'Environment', desc: 'River erosion, tree damage' },
  { id: 'other',       icon: '📌', label: 'Other',       desc: 'Any other community issue' },
]

const divisions = ['Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh']
const districtsByDiv: Record<string, string[]> = {
  Dhaka: ['Dhaka', 'Gazipur', 'Narayanganj', 'Tangail', 'Manikganj', 'Munshiganj', 'Narsingdi', 'Faridpur'],
  Chittagong: ['Chittagong', 'Cox\'s Bazar', 'Comilla', 'Feni', 'Noakhali', 'Lakshmipur', 'Chandpur'],
  Rajshahi: ['Rajshahi', 'Natore', 'Sirajganj', 'Pabna', 'Bogura', 'Chapai Nawabganj'],
  Khulna: ['Khulna', 'Jessore', 'Satkhira', 'Bagerhat', 'Kushtia', 'Meherpur'],
  Barisal: ['Barisal', 'Bhola', 'Patuakhali', 'Barguna', 'Jhalokati', 'Pirojpur'],
  Sylhet: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
  Rangpur: ['Rangpur', 'Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Thakurgaon'],
  Mymensingh: ['Mymensingh', 'Jamalpur', 'Sherpur', 'Netrokona'],
}
const upazilas = ['Mirzapur', 'Basail', 'Bhuapur', 'Delduar', 'Ghatail', 'Gopalpur', 'Kalihati', 'Madhupur', 'Nagarpur', 'Sakhipur', 'Tangail Sadar']
const unions = ['Jamurki', 'Gorai', 'Batian', 'Banshail', 'Trishal']

const NOT_DETECTED = 'Not detected'

type DetectedLocation = {
  division?: string
  district?: string
  upazila?: string
  union?: string
  village?: string
}

const firstAddressValue = (address: Record<string, string>, keys: string[]) =>
  keys.map((key) => address[key]).find((value) => value?.trim()) || ''

const cleanAdministrativeName = (value: string) =>
  value.replace(/\s+Division$/i, '').replace(/\s+District$/i, '').trim()

async function reverseGeocode([latitude, longitude]: [number, number]) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    { headers: { Accept: 'application/json' } },
  )

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed (${response.status}).`)
  }

  const result = await response.json() as { address?: Record<string, string> }
  const address = result.address || {}

  return {
    division: cleanAdministrativeName(firstAddressValue(address, ['state', 'region'])),
    district: cleanAdministrativeName(firstAddressValue(address, ['state_district', 'district', 'county'])),
    upazila: firstAddressValue(address, ['county', 'municipality', 'town']),
    union: firstAddressValue(address, ['union', 'ward', 'municipality']),
    village: firstAddressValue(address, ['village', 'suburb', 'neighbourhood', 'hamlet', 'town']),
  } satisfies DetectedLocation
}

const withDetectedValue = (options: string[], value: string) => [
  NOT_DETECTED,
  ...(value && value !== NOT_DETECTED && !options.includes(value) ? [value] : []),
  ...options.filter((option) => option !== NOT_DETECTED && option !== value),
]

const steps = ['Describe Problem', 'Add Photos', 'Location', 'Submit']
const MAX_PHOTOS = 5
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const DUPLICATE_CONFIDENCE_THRESHOLD = 0.7

const demoPhotos = [
  'https://images.unsplash.com/photo-1554080353-a4f8cb5e62a6?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=900&q=80',
]

type PhotoEntry = {
  id: string
  source: 'upload' | 'demo'
  url: string
  file?: File
}

type DuplicateResult = {
  is_duplicate: boolean
  confidence_score: number
  reason: string
  similar_issue_id: number | null
  similar_issue?: {
    title: string
    division: string | null
    district: string | null
    upazila: string | null
    union_name: string | null
    village: string | null
  }
}

async function readApiResponse(response: Response) {
  const responseText = await response.text()

  try {
    return responseText ? JSON.parse(responseText) : {}
  } catch {
    return {
      message: responseText.slice(0, 240) || `Server returned HTTP ${response.status}.`,
    }
  }
}

export default function ReportIssuePage({ onNavigate }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState(1)
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [division, setDivision] = useState(NOT_DETECTED)
  const [district, setDistrict] = useState(NOT_DETECTED)
  const [upazila, setUpazila] = useState(NOT_DETECTED)
  const [union, setUnion] = useState(NOT_DETECTED)
  const [village, setVillage] = useState(NOT_DETECTED)
  const [locationUsed, setLocationUsed] = useState(false)
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation>({})
  const [geocoding, setGeocoding] = useState(false)
  const [geocodingError, setGeocodingError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submittedIssueId, setSubmittedIssueId] = useState<number | null>(null)
  const [duplicateResult, setDuplicateResult] = useState<DuplicateResult | null>(null)
  const [duplicateWarningVisible, setDuplicateWarningVisible] = useState(false)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)

  const selectedCat = categories.find((c) => c.id === category)

  const locationFields = [
    { label: 'Division', value: division, opts: withDetectedValue(divisions, division), setter: setDivision },
    { label: 'District', value: district, opts: withDetectedValue(districtsByDiv[division] || [], district), setter: setDistrict },
    { label: 'Upazila', value: upazila, opts: withDetectedValue(upazilas, upazila), setter: setUpazila },
    { label: 'Union / Ward', value: union, opts: withDetectedValue(unions, union), setter: setUnion },
  ]

  useEffect(() => {
    if (!coordinates) {
      return
    }

    let cancelled = false
    setGeocoding(true)
    setGeocodingError('')

    reverseGeocode(coordinates)
      .then((location) => {
        if (cancelled) return
        setDetectedLocation(location)
        if (location.division) setDivision(location.division)
        if (location.district) setDistrict(location.district)
        if (location.upazila) setUpazila(location.upazila)
        if (location.union) setUnion(location.union)
        if (location.village) setVillage(location.village)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Reverse geocoding error:', error)
        setDetectedLocation({})
        setGeocodingError('Location details could not be detected. You can select them manually.')
      })
      .finally(() => {
        if (!cancelled) setGeocoding(false)
      })

    return () => { cancelled = true }
  }, [coordinates])

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read selected file.'))
    reader.readAsDataURL(file)
  })

  const handlePhotoSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])

    if (!selected.length) {
      return
    }

    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of selected) {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name} is not a supported image file.`)
        continue
      }

      if (file.size > MAX_IMAGE_SIZE) {
        errors.push(`${file.name} is larger than 10MB.`)
        continue
      }

      validFiles.push(file)
    }

    if (errors.length > 0) {
      alert(errors.join('\n'))
    }

    const remainingSlots = MAX_PHOTOS - photos.length
    const filesToAdd = validFiles.slice(0, Math.max(remainingSlots, 0))

    if (filesToAdd.length === 0 && validFiles.length > 0) {
      alert(`You can upload up to ${MAX_PHOTOS} photos.`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    const nextEntries = filesToAdd.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      source: 'upload' as const,
      url: URL.createObjectURL(file),
      file,
    }))

    setPhotos((current) => [...current, ...nextEntries])

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleAddDemoPhotos = () => {
    const remainingSlots = MAX_PHOTOS - photos.length
    if (remainingSlots <= 0) {
      alert(`You can upload up to ${MAX_PHOTOS} photos.`)
      return
    }

    const nextDemo = demoPhotos.slice(0, remainingSlots).map((url, index) => ({
      id: `demo-${Date.now()}-${index}`,
      source: 'demo' as const,
      url,
    }))

    setPhotos((current) => [...current, ...nextDemo])
  }

  const handleRemovePhoto = (id: string) => {
    setPhotos((current) => {
      const nextPhotos = current.filter((photo) => photo.id !== id)
      const removed = current.find((photo) => photo.id === id)

      if (removed?.source === 'upload' && removed.url.startsWith('blob:')) {
        URL.revokeObjectURL(removed.url)
      }

      return nextPhotos
    })
  }

  const handleMapLocationSelect = (nextCoordinates: [number, number]) => {
    setCoordinates(nextCoordinates)
    setDetectedLocation({})
    setDivision(NOT_DETECTED)
    setDistrict(NOT_DETECTED)
    setUpazila(NOT_DETECTED)
    setUnion(NOT_DETECTED)
    setVillage(NOT_DETECTED)
    setLocationUsed(false)
  }

  const handleDivisionChange = (nextDivision: string) => {
    setDivision(nextDivision)
    setDistrict(NOT_DETECTED)
    setUpazila(NOT_DETECTED)
    setUnion(NOT_DETECTED)
    setVillage(NOT_DETECTED)
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Location is not available in this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords: currentPosition }) => {
        const nextCoordinates: [number, number] = [currentPosition.latitude, currentPosition.longitude]
        setCoordinates(nextCoordinates)
        setMapCenter(nextCoordinates)
        setDetectedLocation({})
        setDivision(NOT_DETECTED)
        setDistrict(NOT_DETECTED)
        setUpazila(NOT_DETECTED)
        setUnion(NOT_DETECTED)
        setVillage(NOT_DETECTED)
        setLocationUsed(true)
      },
      (error) => {
        console.error('Geolocation error:', error)
        alert('Location permission was not granted. You can select the location manually.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const handleSubmit = async () => {
    if (!duplicateWarningVisible) {
      setCheckingDuplicate(true)
      try {
        const duplicateResponse = await fetch('http://localhost:5000/api/issues/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            category,
            division: division === NOT_DETECTED ? '' : division,
            district: district === NOT_DETECTED ? '' : district,
            upazila: upazila === NOT_DETECTED ? '' : upazila,
            union_name: union === NOT_DETECTED ? '' : union,
            village: village === NOT_DETECTED ? '' : village,
            latitude: coordinates?.[0] ?? null,
            longitude: coordinates?.[1] ?? null,
          }),
        })
        const duplicateData = await readApiResponse(duplicateResponse) as DuplicateResult

        if (
          duplicateResponse.ok &&
          duplicateData.is_duplicate &&
          duplicateData.confidence_score >= DUPLICATE_CONFIDENCE_THRESHOLD &&
          duplicateData.similar_issue_id
        ) {
          setDuplicateResult(duplicateData)
          setDuplicateWarningVisible(true)
          return
        }
      } catch (error) {
        console.error('Duplicate detection failed; continuing submission:', error)
      } finally {
        setCheckingDuplicate(false)
      }
    }

    let submissionStage = 'issue creation'

    try {
      const issueEndpoint = 'http://localhost:5000/api/issues'
      const response = await fetch(issueEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 1,
          title,
          description,
          category,
          division,
          district,
          upazila,
          union_name: union,
          village,
          latitude: coordinates?.[0] ?? null,
          longitude: coordinates?.[1] ?? null,
        }),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(`${submissionStage} failed at ${issueEndpoint} (${response.status}): ${data.message || 'Unknown server error'}`)
      }

      const issueId = data.issue.id
      setSubmittedIssueId(issueId)

      submissionStage = 'image preparation'
      const orderedPhotos = await Promise.all(
        photos.map(async (photo, index) => {
          const imageUrl = photo.source === 'upload' && photo.file
            ? await fileToDataUrl(photo.file)
            : photo.url

          return {
            uploaded_by: 1,
            image_url: imageUrl,
            caption: null,
            is_primary: index === 0,
          }
        })
      )

      submissionStage = 'image upload'
      for (const photoPayload of orderedPhotos) {
        const imageEndpoint = `http://localhost:5000/api/issues/${issueId}/images`
        const imageResponse = await fetch(imageEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(photoPayload),
        })

        const imageData = await readApiResponse(imageResponse)

        if (!imageResponse.ok) {
          throw new Error(`${submissionStage} failed at ${imageEndpoint} (${imageResponse.status}): ${imageData.message || 'Unknown server error'}`)
        }
      }

      setSubmitted(true)

      void fetch(`http://localhost:5000/api/ai/priority/${issueId}`, {
        method: 'POST',
      })
        .then((aiResponse) => {
          if (!aiResponse.ok) {
            console.error('AI priority analysis failed:', aiResponse.status)
          }
        })
        .catch((error) => {
          console.error('AI priority analysis network error:', error)
        })
    } catch (error) {
      const message = error instanceof TypeError
        ? `${submissionStage} network error: ${error.message}`
        : error instanceof Error
          ? error.message
          : `${submissionStage} failed: Unknown error`

      console.error('Report submission failed:', {
        stage: submissionStage,
        error,
      })
      alert(`Could not submit report.\n\n${message}`)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="bg-white rounded-3xl card-shadow p-12 text-center max-w-sm w-full">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-xl font-700 text-slate-900 mb-3">Thank you!</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-2">
            Your issue has been reported to the community.
          </p>
          <p className="text-xs text-green-700 bg-green-50 rounded-xl px-4 py-2.5 mb-6 font-500">
            আপনার রিপোর্ট সাবমিট হয়েছে। ধন্যবাদ!
          </p>
          <p className="text-xs text-slate-400 mb-6">Report ID: <strong className="text-slate-600">#RPT-{submittedIssueId}</strong></p>
          <div className="flex gap-3">
            <button onClick={() => submittedIssueId !== null && onNavigate('issue-details', submittedIssueId)} className="flex-1 py-3 bg-green-500 text-white rounded-xl text-sm font-700 hover:bg-green-600 transition-all cursor-pointer">
              View Issue
            </button>
            <button onClick={() => onNavigate('dashboard')} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-600 hover:bg-slate-50 transition-all cursor-pointer">
              Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-700 text-slate-900">Report a Problem</h1>
        <p className="text-sm text-slate-500 mt-0.5">আপনার এলাকার সমস্যা রিপোর্ট করুন</p>
      </div>

      {/* Step indicator */}
      <div className="bg-white rounded-2xl card-shadow p-5 mb-5">
        <div className="flex items-center gap-0">
          {steps.map((s, i) => {
            const num = i + 1
            const done = num < step
            const active = num === step
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-700 transition-all ${
                    done ? 'bg-green-500 text-white' : active ? 'bg-green-500 text-white ring-4 ring-green-100' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {done ? '✓' : num}
                  </div>
                  <span className={`text-[11px] mt-1 font-500 whitespace-nowrap ${active ? 'text-green-700' : done ? 'text-slate-500' : 'text-slate-400'}`}>
                    {s}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mt-[-14px] ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1 — Describe */}
      {step === 1 && (
        <div className="bg-white rounded-2xl card-shadow p-6 space-y-6">
          <div>
            <h2 className="text-base font-700 text-slate-800 mb-0.5">Step 1 — What is the problem?</h2>
            <p className="text-xs text-slate-400">সমস্যাটি বর্ণনা করুন</p>
          </div>

          <div>
            <label className="block text-sm font-600 text-slate-700 mb-2">Issue Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Broken village road near school"'
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-600 text-slate-700 mb-3">Category *</label>
            <div className="grid grid-cols-3 gap-2.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    category === cat.id
                      ? 'border-green-400 bg-green-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className={`text-xs font-700 ${category === cat.id ? 'text-green-700' : 'text-slate-700'}`}>{cat.label}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{cat.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-600 text-slate-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the problem in a few words. How long has this been a problem? How does it affect people?"
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all resize-none"
            />
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!title || !category}
            className="w-full py-3.5 bg-green-500 text-white font-700 rounded-xl hover:bg-green-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Next — Add Photos <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Step 2 — Photos */}
      {step === 2 && (
        <div className="bg-white rounded-2xl card-shadow p-6 space-y-5">
          <div>
            <h2 className="text-base font-700 text-slate-800 mb-0.5">Step 2 — Add Photos</h2>
            <p className="text-xs text-slate-400">Add up to 5 photos of the problem</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoSelection}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:border-green-300 hover:bg-green-50 transition-all cursor-pointer text-sm font-600"
            >
              <Camera size={16} className="text-green-600" />
              Take / Choose Photo
            </button>
            <button
              type="button"
              onClick={handleAddDemoPhotos}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer text-sm font-600"
            >
              <Upload size={16} className="text-blue-600" />
              Use Demo Photos
            </button>
          </div>

          {photos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{photos.length} / {MAX_PHOTOS} photos</span>
                {photos[0] && <span className="text-green-700 font-600">Primary</span>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, i) => (
                  <div key={photo.id} className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-100 group border border-slate-200">
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-2 top-2 bg-green-500 text-white text-[10px] font-700 px-2 py-1 rounded-full">
                        Primary
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(1)} className="px-5 py-3 border border-slate-200 text-slate-600 font-600 rounded-xl hover:bg-slate-50 transition-all cursor-pointer text-sm">
              Back
            </button>
            <button onClick={() => setStep(3)} className="flex-1 py-3 bg-green-500 text-white font-700 rounded-xl hover:bg-green-600 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm">
              Next — Set Location <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Location */}
      {step === 3 && (
        <div className="bg-white rounded-2xl card-shadow p-6 space-y-5">
          <div>
            <h2 className="text-base font-700 text-slate-800 mb-0.5">Step 3 — Where is the problem?</h2>
            <p className="text-xs text-slate-400">সমস্যার স্থান নির্বাচন করুন</p>
          </div>

          {/* GPS button */}
          <button
            onClick={handleUseCurrentLocation}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-700 transition-all cursor-pointer ${
              locationUsed
                ? 'bg-green-50 border-2 border-green-400 text-green-700'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            <Navigation size={16} />
            {locationUsed ? '✓ Location detected automatically' : 'Use My Current Location'}
          </button>

          {/* Interactive map */}
          <div className="h-64 rounded-xl overflow-hidden border border-slate-200 relative z-0">
            <MapContainer center={bangladeshCenter} zoom={7} scrollWheelZoom className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapLocationPicker onSelect={handleMapLocationSelect} />
              <RecenterMap coordinates={mapCenter} />
              {coordinates && (
                <>
                  <Marker position={coordinates} icon={locationMarker} />
                  <CircleMarker center={coordinates} radius={12} pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.15 }} />
                </>
              )}
            </MapContainer>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin size={13} className="text-green-500" />
            {coordinates
              ? `Selected coordinates: ${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}`
              : 'Click the map or use GPS to select the problem location.'}
          </div>
          {coordinates && (
            <p className="text-xs text-slate-500">
              {geocoding
                ? 'Detecting the administrative location...'
                : geocodingError || `Detected location: ${[detectedLocation.village, detectedLocation.upazila, detectedLocation.district, detectedLocation.division].filter(Boolean).join(', ') || NOT_DETECTED}`}
            </p>
          )}

          {/* Location dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            {locationFields.map((f) => (
              <div key={f.label}>
                <label className="block text-xs font-600 text-slate-600 mb-1">{f.label}</label>
                <select
                  value={f.value}
                  onChange={(e) => f.label === 'Division' ? handleDivisionChange(e.target.value) : f.setter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 cursor-pointer focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all appearance-none"
                >
                  {f.opts.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-600 text-slate-600 mb-1">Village / Area</label>
            <input
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder="Enter village or area name"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all"
            />
          </div>

          <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-3 leading-relaxed">
            📍 Your location will help nearby community members find and support this issue.
          </p>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-5 py-3 border border-slate-200 text-slate-600 font-600 rounded-xl hover:bg-slate-50 transition-all cursor-pointer text-sm">
              Back
            </button>
            <button onClick={() => setStep(4)} className="flex-1 py-3 bg-green-500 text-white font-700 rounded-xl hover:bg-green-600 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm">
              Next — Review & Submit <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Review & Submit */}
      {step === 4 && (
        <div className="bg-white rounded-2xl card-shadow p-6 space-y-5">
          <div>
            <h2 className="text-base font-700 text-slate-800 mb-0.5">Step 4 — Review & Submit</h2>
            <p className="text-xs text-slate-400">সমস্যাটি নিশ্চিত করুন এবং সাবমিট করুন</p>
          </div>

          {/* Summary card */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{selectedCat?.icon}</span>
              <div>
                <div className="text-sm font-700 text-slate-800">{title || 'Broken village road'}</div>
                <div className="text-xs text-slate-500 mt-0.5">{selectedCat?.label} • {description || 'No description'}</div>
              </div>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <MapPin size={13} className="text-green-500" />
              {village}, {union}, {upazila}, {district}, {division}
            </div>
            {photos.length > 0 && (
              <div className="flex gap-2">
                {photos.map((photo) => (
                  <img key={photo.id} src={photo.url} alt="" className="w-16 h-12 rounded-lg object-cover" />
                ))}
              </div>
            )}
          </div>

          {duplicateResult && duplicateWarningVisible && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-700 text-amber-900">⚠️ Possible duplicate report</h3>
              <p className="text-xs text-amber-800">A very similar issue may already have been reported:</p>
              <div className="text-xs text-amber-900">
                <div className="font-700">{duplicateResult.similar_issue?.title || `Issue #${duplicateResult.similar_issue_id}`}</div>
                <div>
                  {[duplicateResult.similar_issue?.village, duplicateResult.similar_issue?.union_name, duplicateResult.similar_issue?.upazila, duplicateResult.similar_issue?.district, duplicateResult.similar_issue?.division].filter(Boolean).join(', ') || 'Location not provided'}
                </div>
              </div>
              <p className="text-xs text-amber-800">
                {Math.round(duplicateResult.confidence_score * 100)}% similar · {duplicateResult.reason}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('issue-details', duplicateResult.similar_issue_id || undefined)}
                className="w-full py-2.5 border border-amber-300 text-amber-900 rounded-lg text-xs font-700 hover:bg-amber-100 cursor-pointer transition-all"
              >
                View Existing Issue
              </button>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Reporting something genuinely different? Press “Report This Problem” again to continue.
              </p>
            </div>
          )}

          <button
            onClick={() => { void handleSubmit() }}
            disabled={checkingDuplicate}
            className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-700 text-base rounded-xl shadow-lg shadow-green-100 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {checkingDuplicate ? 'Checking for similar reports...' : '📢 Report This Problem'}
          </button>
          <button
            onClick={() => { setDuplicateResult(null); setDuplicateWarningVisible(false); setStep(3) }}
            className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
          >
            ← Go Back
          </button>
        </div>
      )}
    </div>
  )
}
