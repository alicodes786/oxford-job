"use client"

import { useState, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { X, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format, isToday, isTomorrow } from 'date-fns'
import { parseLocalDateString } from '@/lib/bin-collection-schedule'
import type { EarlyCheckin } from '@/lib/booking-addons'

function checkInAsLocalDate(checkInDate: string | null | undefined): Date | null {
  if (!checkInDate) return null
  const day = checkInDate.includes('T') ? checkInDate.split('T')[0]! : checkInDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return parseLocalDateString(day)
}

interface EarlyCheckinAlertsProps {
  earlyCheckins: EarlyCheckin[]
  isMobile?: boolean
}

export function EarlyCheckinAlerts({ earlyCheckins, isMobile = false }: EarlyCheckinAlertsProps) {
  // Initialize state synchronously from localStorage to prevent flash
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    
    try {
      const stored = localStorage.getItem('dismissedEarlyCheckinAlerts')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch (e) {
      console.error('Error loading dismissed alerts:', e)
      return new Set()
    }
  })
  const [isExpanded, setIsExpanded] = useState(false)

  // Clear dismissed alerts at midnight (new day = new alerts)
  useEffect(() => {
    const checkAndClearDismissed = () => {
      const lastClear = localStorage.getItem('lastAlertClear')
      const today = format(new Date(), 'yyyy-MM-dd')
      
      if (lastClear !== today) {
        localStorage.removeItem('dismissedEarlyCheckinAlerts')
        localStorage.setItem('lastAlertClear', today)
        setDismissedAlerts(new Set())
      }
    }
    
    checkAndClearDismissed()
    
    // Check every hour
    const interval = setInterval(checkAndClearDismissed, 3600000)
    return () => clearInterval(interval)
  }, [])

  // Filter for today and tomorrow check-ins
  const todayCheckins = earlyCheckins.filter((ec) => {
    const date = checkInAsLocalDate(ec.check_in_date)
    if (!date || Number.isNaN(date.getTime())) return false
    return isToday(date) && !dismissedAlerts.has(`today-${ec.id}`)
  })

  const tomorrowCheckins = earlyCheckins.filter((ec) => {
    const date = checkInAsLocalDate(ec.check_in_date)
    if (!date || Number.isNaN(date.getTime())) return false
    return isTomorrow(date) && !dismissedAlerts.has(`tomorrow-${ec.id}`)
  })

  const dismissAlert = (key: string) => {
    const newDismissed = new Set(dismissedAlerts)
    newDismissed.add(key)
    setDismissedAlerts(newDismissed)
    localStorage.setItem('dismissedEarlyCheckinAlerts', JSON.stringify([...newDismissed]))
  }

  const formatTime = (time24: string | null | undefined) => {
    if (!time24) return ''
    const [hours, minutes] = time24.split(':')
    const hour = parseInt(hours)
    const period = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${hour12}:${minutes} ${period}`
  }

  // Don't render anything if no alerts to show
  if (todayCheckins.length === 0 && tomorrowCheckins.length === 0) {
    return null
  }

  const totalCount = todayCheckins.length + tomorrowCheckins.length

  // MOBILE COMPACT VIEW
  if (isMobile) {
    return (
      <div className="space-y-2">
        {/* Compact Summary Card */}
        <div 
          className={`border-l-4 rounded-md p-3 cursor-pointer transition-all ${
            todayCheckins.length > 0 
              ? 'bg-red-50 border-red-500' 
              : 'bg-blue-50 border-blue-500'
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {todayCheckins.length > 0 ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : (
                <Clock className="h-4 w-4 text-blue-600" />
              )}
              <span className={`font-semibold text-sm ${
                todayCheckins.length > 0 ? 'text-red-900' : 'text-blue-900'
              }`}>
                Early Check-ins
              </span>
              <Badge variant="secondary" className="text-xs">
                {totalCount}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {todayCheckins.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {todayCheckins.length} Today
                </Badge>
              )}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              )}
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-3 space-y-2">
              {todayCheckins.map((checkin) => (
                <div 
                  key={checkin.id}
                  className="bg-red-100 rounded p-2 border border-red-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-red-900 text-sm truncate">
                        🚨 {checkin.listing?.name || 'Unknown'}
                      </div>
                      <div className="text-red-700 text-xs mt-0.5">
                        Today at <strong>{formatTime(checkin.requested_time)}</strong>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-600 hover:bg-red-200 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        dismissAlert(`today-${checkin.id}`)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {tomorrowCheckins.map((checkin) => (
                <div 
                  key={checkin.id}
                  className="bg-blue-100 rounded p-2 border border-blue-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-blue-900 text-sm truncate">
                        📅 {checkin.listing?.name || 'Unknown'}
                      </div>
                      <div className="text-blue-700 text-xs mt-0.5">
                        Tomorrow at <strong>{formatTime(checkin.requested_time)}</strong>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-blue-600 hover:bg-blue-200 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        dismissAlert(`tomorrow-${checkin.id}`)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // DESKTOP FULL VIEW
  return (
    <div className="space-y-3">
      {/* TODAY ALERTS - Red/Orange (Urgent) */}
      {todayCheckins.map((checkin) => (
        <Alert 
          key={checkin.id}
          className="relative bg-red-50 border-red-200 border-l-4 border-l-red-500 shadow-lg"
        >
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <AlertTitle className="text-red-900 text-lg font-bold flex items-center gap-2">
                🚨 EARLY CHECK-IN TODAY
              </AlertTitle>
              <AlertDescription className="text-red-800 text-base mt-1">
                <strong>{checkin.listing?.name || 'Unknown Listing'}</strong> at{' '}
                <strong className="text-lg">{formatTime(checkin.requested_time)}</strong>
                <div className="text-sm mt-1">⚡ Prepare property ASAP!</div>
              </AlertDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-600 hover:text-red-800 hover:bg-red-100 h-8 w-8 shrink-0"
              onClick={() => dismissAlert(`today-${checkin.id}`)}
              aria-label="Dismiss alert"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </Alert>
      ))}

      {/* TOMORROW ALERTS - Blue (Important) */}
      {tomorrowCheckins.map((checkin) => (
        <Alert 
          key={checkin.id}
          className="relative bg-blue-50 border-blue-200 border-l-4 border-l-blue-500 shadow-lg"
        >
          <Clock className="h-5 w-5 text-blue-600" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <AlertTitle className="text-blue-900 text-lg font-bold flex items-center gap-2">
                📅 EARLY CHECK-IN TOMORROW
              </AlertTitle>
              <AlertDescription className="text-blue-800 text-base mt-1">
                <strong>{checkin.listing?.name || 'Unknown Listing'}</strong> at{' '}
                <strong className="text-lg">{formatTime(checkin.requested_time)}</strong>
                <div className="text-sm mt-1">📝 Don't forget to prepare in advance!</div>
              </AlertDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 h-8 w-8 shrink-0"
              onClick={() => dismissAlert(`tomorrow-${checkin.id}`)}
              aria-label="Dismiss alert"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  )
}

