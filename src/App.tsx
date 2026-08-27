import { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import ReportIssuePage from './pages/ReportIssuePage'
import IssueDetailsPage from './pages/IssueDetailsPage'
import VolunteerDashboard from './pages/VolunteerDashboard'
import EventDashboard from './pages/EventDashboard'
import AISuggestionsPage from './pages/AISuggestionsPage'
import ProfilePage from './pages/ProfilePage'
import AdminDashboard from './pages/AdminDashboard'
import Layout from './components/Layout'
import SignupPage from './pages/SignupPage'

export type Page =
  | 'login'
  | 'signup'
  | 'dashboard'
  | 'report-issue'
  | 'issue-details'
  | 'volunteer'
  | 'events'
  | 'ai-suggestions'
  | 'profile'
  | 'admin'

export type AuthUser = {
  id: number
  name: string
  email: string
  role: string
  division?: string | null
  district?: string | null
  upazila?: string | null
}

const validPages: Page[] = [
  'login',
  'signup',
  'dashboard',
  'report-issue',
  'issue-details',
  'volunteer',
  'events',
  'ai-suggestions',
  'profile',
  'admin',
]

const getStoredIssueId = (): number | null => {
  const storedIssueId = Number(localStorage.getItem('cab_selected_issue_id'))
  return Number.isInteger(storedIssueId) && storedIssueId > 0 ? storedIssueId : null
}

const getInitialPage = (): Page => {
  const storedPage = localStorage.getItem('cab_current_page')

  if (!storedPage || !validPages.includes(storedPage as Page)) {
    return 'login'
  }

  if (storedPage === 'issue-details' && getStoredIssueId() === null) {
    return 'dashboard'
  }

  return storedPage as Page
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>(getInitialPage)
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(getStoredIssueId)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authChecking, setAuthChecking] = useState(true)

  useEffect(() => {
    fetch('http://localhost:5000/api/auth/me', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json() as { success?: boolean; user?: AuthUser }
        if (data.success && data.user) setUser(data.user)
      })
      .catch((error) => console.error('Session restoration failed:', error))
      .finally(() => setAuthChecking(false))
  }, [])

  const navigate = (page: Page, issueId?: number) => {
    if (page === 'admin' && user?.role !== 'admin') {
      return
    }
    const nextIssueId = issueId !== undefined
      ? Number.isInteger(issueId) && issueId > 0 ? issueId : null
      : selectedIssueId

    if (page === 'issue-details' && nextIssueId === null) {
      setCurrentPage('dashboard')
      localStorage.setItem('cab_current_page', 'dashboard')
      return
    }

    setCurrentPage(page)
    localStorage.setItem('cab_current_page', page)

    if (issueId !== undefined) {
      setSelectedIssueId(nextIssueId)

      if (nextIssueId === null) {
        localStorage.removeItem('cab_selected_issue_id')
      } else {
        localStorage.setItem('cab_selected_issue_id', String(nextIssueId))
      }
    }
  }

  if (authChecking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading...</div>
  }

  if (currentPage === 'signup') {
    return <SignupPage onSignup={(authenticatedUser) => { setUser(authenticatedUser); navigate('dashboard') }} onLogin={() => navigate('login')} />
  }

  if (!user || currentPage === 'login') {
    return <LoginPage onLogin={(authenticatedUser) => { setUser(authenticatedUser); navigate('dashboard') }} onSignup={() => navigate('signup')} />
  }

  if (currentPage === 'admin' && user.role === 'admin') {
    return <AdminDashboard onNavigate={navigate} onLogout={async () => {
      await fetch('http://localhost:5000/api/auth/logout', { method: 'POST', credentials: 'include' })
      setUser(null)
      navigate('login')
    }} />
  }

  if (currentPage === 'admin') {
    setCurrentPage('dashboard')
    localStorage.setItem('cab_current_page', 'dashboard')
    return null
  }

  return (
    <Layout currentPage={currentPage} onNavigate={navigate} user={user} onLogout={async () => {
      await fetch('http://localhost:5000/api/auth/logout', { method: 'POST', credentials: 'include' })
      setUser(null)
      navigate('login')
    }}>

      {currentPage === 'dashboard' && (
        <Dashboard onNavigate={navigate} user={user} />
      )}

      {currentPage === 'report-issue' && (
        <ReportIssuePage onNavigate={navigate} user={user} />
      )}

      {currentPage === 'issue-details' && (
        <IssueDetailsPage
          onNavigate={navigate}
          issueId={selectedIssueId}
          user={user}
        />
      )}

      {currentPage === 'volunteer' && (
        <VolunteerDashboard onNavigate={navigate} />
      )}

      {currentPage === 'events' && (
        <EventDashboard onNavigate={navigate} user={user} />
      )}

      {currentPage === 'ai-suggestions' && (
        <AISuggestionsPage onNavigate={navigate} />
      )}

      {currentPage === 'profile' && (
        <ProfilePage onNavigate={navigate} user={user} onLogout={async () => {
          await fetch('http://localhost:5000/api/auth/logout', { method: 'POST', credentials: 'include' })
          setUser(null)
          navigate('login')
        }} />
      )}

    </Layout>
  )
}