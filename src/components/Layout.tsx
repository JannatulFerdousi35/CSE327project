import { useState } from 'react'
import { Bell, Search, Home, MapPin, Plus, Users, Calendar, Bot, User, LogOut, ChevronRight, Leaf } from 'lucide-react'
import type { Page } from '../App'
import type { AuthUser } from '../App'

type LayoutProps = {
  currentPage: Page
  onNavigate: (page: Page) => void
  user: AuthUser
  onLogout: () => void
  children: React.ReactNode
}

const navItems: { id: Page; label: string; icon: React.ElementType; labelBn: string }[] = [
  { id: 'dashboard',      label: 'Home',           labelBn: 'হোম',         icon: Home },
  { id: 'issue-details',  label: 'Nearby Issues',  labelBn: 'সমস্যা',      icon: MapPin },
  { id: 'volunteer',      label: 'Volunteer',      labelBn: 'স্বেচ্ছাসেবক', icon: Users },
  { id: 'events',         label: 'Events',         labelBn: 'ইভেন্ট',      icon: Calendar },
  { id: 'ai-suggestions', label: 'AI Planner',     labelBn: 'AI পরিকল্পক', icon: Bot },
  { id: 'profile',        label: 'Profile',        labelBn: 'প্রোফাইল',    icon: User },
]

export default function Layout({ currentPage, onNavigate, user, onLogout, children }: LayoutProps) {
  const [lang, setLang] = useState<'en' | 'bn'>('en')
  const userInitials = user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const userLocation = [user.upazila, user.district, user.division].filter(Boolean).join(', ') || 'Location not provided'

  const label = (item: typeof navItems[0]) => lang === 'bn' ? item.labelBn : item.label

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-100 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md shadow-green-100">
              <Leaf size={16} className="text-white" />
            </div>
            <div>
              <div className="text-xs font-700 text-slate-800 leading-tight">Community</div>
              <div className="text-[11px] font-600 text-green-600 leading-tight">Action Bridge</div>
            </div>
          </div>
        </div>

        {/* Language switcher */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setLang('en')}
              className={`flex-1 py-1 rounded-md font-600 transition-all cursor-pointer ${lang === 'en' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              English
            </button>
            <button
              onClick={() => setLang('bn')}
              className={`flex-1 py-1 rounded-md font-600 transition-all cursor-pointer ${lang === 'bn' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              বাংলা
            </button>
          </div>
        </div>

        {/* User location pill */}
        <div className="px-4 py-2">
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5">
            <MapPin size={12} className="text-green-500 flex-shrink-0" />
            <span className="text-[11px] text-green-700 font-500 truncate">{userLocation}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-500 transition-all cursor-pointer ${
                  active
                    ? 'bg-green-50 text-green-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon size={18} className={active ? 'text-green-600' : 'text-slate-400'} />
                <span>{label(item)}</span>
                {active && <ChevronRight size={14} className="ml-auto text-green-400" />}
              </button>
            )
          })}

          {/* Admin link */}
          {user.role === 'admin' && <div className="pt-2 mt-2 border-t border-slate-100">
            <button
              onClick={() => onNavigate('admin')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-500 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
              Admin Panel
            </button>
          </div>}
        </nav>

        <div className="px-3 pb-3 border-t border-slate-100 pt-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-500 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
          >
            <LogOut size={17} /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center px-5 gap-4 flex-shrink-0">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={lang === 'bn' ? 'সমস্যা খুঁজুন...' : 'Search issues, events...'}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-green-200 focus:border-green-300 transition-all"
            />
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <button className="relative w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-all cursor-pointer">
              <Bell size={16} className="text-slate-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => onNavigate('profile')}
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-700 text-xs select-none">
                {userInitials}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-600 text-slate-800">{user.name}</div>
                <div className="text-[11px] text-slate-400">{userLocation}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 relative">
          {children}

          {/* Floating Report Button */}
          <button
            onClick={() => onNavigate('report-issue')}
            className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3.5 bg-green-500 hover:bg-green-600 text-white text-sm font-700 rounded-2xl shadow-xl shadow-green-200 hover:shadow-green-300 transition-all cursor-pointer z-50 active:scale-95"
          >
            <Plus size={18} />
            {lang === 'bn' ? 'সমস্যা রিপোর্ট' : 'Report Issue'}
          </button>
        </main>
      </div>
    </div>
  )
}
