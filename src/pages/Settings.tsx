/**
 * WorkProof Settings Page
 * User and app settings
 */

import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useUser, useClerk } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Building,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  ExternalLink,
  Trash2,
  Cloud,
} from 'lucide-react'
import { clearSession } from '../hooks/useSessionTimeout'
import { getStorageStats, clearSyncedEvidence } from '../utils/indexedDB'
import { formatFileSize } from '../utils/compression'
import type { OfflineStorageStats } from '../types/api'

export default function Settings() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { signOut } = useClerk()

  const [storageStats, setStorageStats] = useState<OfflineStorageStats | null>(null)
  const [isClearing, setIsClearing] = useState(false)

  useState(() => {
    loadStorageStats()
  })

  const loadStorageStats = async () => {
    const stats = await getStorageStats()
    setStorageStats(stats)
  }

  const handleSignOut = async () => {
    clearSession()
    await signOut()
    navigate('/login')
  }

  const handleClearSynced = async () => {
    if (!confirm('Clear all synced evidence from local storage? This won\'t delete anything from the cloud.')) {
      return
    }

    setIsClearing(true)
    try {
      const deleted = await clearSyncedEvidence()
      alert(`Cleared ${deleted} synced items from local storage.`)
      await loadStorageStats()
    } catch (error) {
      alert('Failed to clear storage.')
    } finally {
      setIsClearing(false)
    }
  }

  const settingsSections = [
    {
      title: 'Account',
      items: [
        {
          icon: User,
          label: 'Profile',
          description: user?.primaryEmailAddress?.emailAddress || 'Manage your profile',
          action: () => {
            // TODO: Open profile editor
          },
        },
        {
          icon: Building,
          label: 'Organisation',
          description: 'Company details & NICEIC number',
          action: () => {
            // TODO: Open org settings
          },
        },
      ],
    },
    {
      title: 'App',
      items: [
        {
          icon: Bell,
          label: 'Notifications',
          description: 'Sync alerts & reminders',
          action: () => {
            // TODO: Open notification settings
          },
        },
        {
          icon: Shield,
          label: 'Privacy & Security',
          description: 'Data handling & permissions',
          action: () => {
            // TODO: Open privacy settings
          },
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: HelpCircle,
          label: 'Help Centre',
          description: 'FAQs & documentation',
          action: () => {
            window.open('https://workproof.co.uk/help', '_blank')
          },
          external: true,
        },
      ],
    },
  ]

  return (
    <>
      <Helmet>
        <title>Settings | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        {/* User Card */}
        <div className="card flex items-center gap-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.firstName || 'User'}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <User className="w-7 h-7 text-green-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>

        {/* Storage Stats */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900">Local Storage</h3>
            </div>
            {storageStats && (
              <span className="text-sm text-gray-500">
                {formatFileSize(storageStats.totalSizeBytes)} used
              </span>
            )}
          </div>

          {storageStats && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total items</span>
                <span className="font-medium">{storageStats.totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pending upload</span>
                <span className="font-medium text-amber-600">
                  {storageStats.pendingUploadCount}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleClearSynced}
            disabled={isClearing}
            className="mt-4 w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? 'Clearing...' : 'Clear synced evidence'}
          </button>
        </div>

        {/* Settings Sections */}
        {settingsSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-medium text-gray-500 mb-2 px-1">
              {section.title}
            </h2>
            <div className="card divide-y divide-gray-100">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full py-3 flex items-center justify-between text-left hover:bg-gray-50 -mx-4 px-4 first:rounded-t-xl last:rounded-b-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                  {item.external ? (
                    <ExternalLink className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>

        {/* Version */}
        <p className="text-center text-xs text-gray-400">
          WorkProof v1.0.0 • Built with ❤️ for UK electricians
        </p>
      </div>
    </>
  )
}
