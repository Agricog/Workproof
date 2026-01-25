import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  User,
  Bell,
  Shield,
  HardDrive,
  Trash2,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { getStorageUsage, clearAllData } from '../utils/indexedDB'
import { formatBytes } from '../utils/compression'
import { forceSyncNow, getSyncStatus } from '../services/sync'

interface SettingsLink {
  icon: typeof User
  label: string
  description: string
  action: () => void
  external?: boolean
}

export default function Settings() {
  const [storageUsed, setStorageUsed] = useState(0)
  const [storageQuota, setStorageQuota] = useState(0)
  const [pendingSync, setPendingSync] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  useEffect(() => {
    loadStorageInfo()
    loadSyncStatus()
  }, [])

  const loadStorageInfo = async () => {
    const { used, quota } = await getStorageUsage()
    setStorageUsed(used)
    setStorageQuota(quota)
  }

  const loadSyncStatus = async () => {
    const status = await getSyncStatus()
    setPendingSync(status.pendingEvidence + status.pendingQueue)
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await forceSyncNow()
      await loadSyncStatus()
    } finally {
      setIsSyncing(false)
    }
  }

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
      return
    }

    setIsClearing(true)
    try {
      await clearAllData()
      await loadStorageInfo()
      await loadSyncStatus()
    } finally {
      setIsClearing(false)
    }
  }

  const accountSettings: SettingsLink[] = [
    {
      icon: User,
      label: 'Profile',
      description: 'Manage your account details',
      action: () => {},
    },
    {
      icon: Bell,
      label: 'Notifications',
      description: 'Configure notification preferences',
      action: () => {},
    },
    {
      icon: Shield,
      label: 'Security',
      description: 'Password and two-factor authentication',
      action: () => {},
    },
  ]

  const supportLinks: SettingsLink[] = [
    {
      icon: ExternalLink,
      label: 'Help Centre',
      description: 'Guides and FAQs',
      action: () => window.open('https://help.workproof.co.uk', '_blank'),
      external: true,
    },
    {
      icon: ExternalLink,
      label: 'Contact Support',
      description: 'Get help from our team',
      action: () => window.open('mailto:support@workproof.co.uk', '_blank'),
      external: true,
    },
  ]

  const storagePercent = storageQuota > 0 ? (storageUsed / storageQuota) * 100 : 0

  return (
    <div>
      <Helmet>
        <title>Settings | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Storage</h2>

            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Used</span>
                <span className="font-medium text-gray-900">
                  {formatBytes(storageUsed)} / {formatBytes(storageQuota)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    storagePercent > 80 ? 'bg-red-500' : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(storagePercent, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
              <div>
                <p className="font-medium text-gray-900">Pending Sync</p>
                <p className="text-sm text-gray-500">
                  {pendingSync} items waiting to sync
                </p>
              </div>
              <button
                onClick={handleSync}
                disabled={isSyncing || pendingSync === 0}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button
              onClick={handleClearData}
              disabled={isClearing}
              className="w-full flex items-center justify-center gap-2 p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              <span>{isClearing ? 'Clearing...' : 'Clear Local Data'}</span>
            </button>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Account</h2>
            <div className="space-y-1">
              {accountSettings.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-gray-400" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Support</h2>
            <div className="space-y-1">
              {supportLinks.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-gray-400" />
                    <div className="text-left">
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

          <div className="text-center text-sm text-gray-500 py-4">
            <p>WorkProof v1.0.0</p>
            <p className="mt-1">© 2026 WorkProof. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
