/**
 * WorkProof Geolocation Hook
 * Get GPS coordinates for evidence capture
 */

import { useState, useCallback } from 'react'
import type { GeoLocation, GeoLocationError } from '../types/api'

interface UseGeolocationReturn {
  location: GeoLocation | null
  error: GeoLocationError | null
  isLoading: boolean
  getLocation: () => Promise<GeoLocation | null>
  clearError: () => void
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<GeoLocation | null>(null)
  const [error, setError] = useState<GeoLocationError | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const getLocation = useCallback(async (): Promise<GeoLocation | null> => {
    if (!navigator.geolocation) {
      setError({
        code: 'POSITION_UNAVAILABLE',
        message: 'Geolocation is not supported by this browser',
      })
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          })
        }
      )

      const loc: GeoLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      }

      setLocation(loc)
      return loc
    } catch (err) {
      const geoError = err as GeolocationPositionError

      let errorCode: GeoLocationError['code']
      let message: string

      switch (geoError.code) {
        case geoError.PERMISSION_DENIED:
          errorCode = 'PERMISSION_DENIED'
          message = 'Location permission denied. Please enable in settings.'
          break
        case geoError.POSITION_UNAVAILABLE:
          errorCode = 'POSITION_UNAVAILABLE'
          message = 'Location information unavailable.'
          break
        case geoError.TIMEOUT:
          errorCode = 'TIMEOUT'
          message = 'Location request timed out.'
          break
        default:
          errorCode = 'UNKNOWN'
          message = 'An unknown error occurred.'
      }

      setError({ code: errorCode, message })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    location,
    error,
    isLoading,
    getLocation,
    clearError,
  }
}

// ============================================================================
// HELPERS
// ============================================================================

export function formatCoordinates(
  lat: number | null,
  lng: number | null
): string {
  if (lat === null || lng === null) {
    return 'Location unavailable'
  }

  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'

  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3 // Earth's radius in metres
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in metres
}
