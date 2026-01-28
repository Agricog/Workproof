/**
 * WorkProof Bottom Navigation
 * Mobile-first bottom nav bar
 */

import { NavLink, useLocation } from 'react-router-dom'
import { Home, Briefcase, FileText, Settings } from 'lucide-react'
import SyncStatus from '../common/SyncStatus'

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/packs', icon: FileText, label: 'Packs' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Navigation() {
  const location = useLocation()

  // Hide nav on certain pages
  const hideNavPaths = ['/login', '/']
  if (hideNavPaths.includes(location.pathname)) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      {/* Sync status bar */}
      <div className="px-4 py-2 border-b border-gray-100 flex justify-center">
        <SyncStatus />
      </div>

      {/* Navigation items */}
      <div className="flex items-center justify-around py-2 safe-area-bottom">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
