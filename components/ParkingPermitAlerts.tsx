"use client"

import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Car, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'
import type { ParkingPermit } from '@/lib/booking-addons'

interface ParkingPermitAlertsProps {
  permits: ParkingPermit[]
  isMobile?: boolean
}

export function ParkingPermitAlerts({ permits, isMobile = false }: ParkingPermitAlertsProps) {
  const [collapsedNeeded, setCollapsedNeeded] = useState(false)
  const [collapsedPayment, setCollapsedPayment] = useState(false)
  const [mobileCollapsed, setMobileCollapsed] = useState(false)

  // Filter permits by type (no dismissal logic)
  const outstandingPermits = permits.filter(p => 
    p.permit_status === 'permit_os'
  )

  const paymentPendingPermits = permits.filter(p => 
    p.fee_paid_status === 'payment_pending' && 
    p.permit_status !== 'permit_os' // Don't show if already in outstanding
  )

  const formatDate = (dateStr: string | null | undefined, short = false) => {
    if (!dateStr) return '—'
    try {
      const date = parseISO(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`)
      return format(date, short ? 'MMM dd' : 'MMM dd (EEE)')
    } catch {
      return dateStr
    }
  }

  // Don't render anything if no alerts to show
  if (outstandingPermits.length === 0 && paymentPendingPermits.length === 0) {
    return null
  }

  const totalCount = outstandingPermits.length + paymentPendingPermits.length

  // MOBILE COMPACT VIEW
  if (isMobile) {
    return (
      <div className="space-y-2">
        {/* Compact Summary Card */}
        <div 
          className={`border-l-4 rounded-md p-3 cursor-pointer transition-all ${
            outstandingPermits.length > 0 
              ? 'bg-green-50 border-green-500' 
              : 'bg-amber-50 border-amber-500'
          }`}
          onClick={() => setMobileCollapsed(!mobileCollapsed)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {outstandingPermits.length > 0 ? (
                <Car className="h-4 w-4 text-green-600" />
              ) : (
                <DollarSign className="h-4 w-4 text-amber-600" />
              )}
              <span className={`font-semibold text-sm ${
                outstandingPermits.length > 0 ? 'text-green-900' : 'text-amber-900'
              }`}>
                Parking Permits
              </span>
              <Badge variant="secondary" className="text-xs">
                {totalCount}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {outstandingPermits.length > 0 && (
                <Badge className="bg-green-600 text-white text-xs">
                  {outstandingPermits.length} Needed
                </Badge>
              )}
              {paymentPendingPermits.length > 0 && (
                <Badge className="bg-amber-600 text-white text-xs">
                  {paymentPendingPermits.length} Payment
                </Badge>
              )}
              {mobileCollapsed ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronUp className="h-4 w-4 text-gray-600" />
              )}
            </div>
          </div>

          {/* Expanded Details */}
          {!mobileCollapsed && (
            <div className="mt-3 space-y-2">
              {/* Outstanding Permits */}
              {outstandingPermits.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-green-800 flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    Permits Needed ({outstandingPermits.length})
                  </div>
                  {outstandingPermits.slice(0, 3).map((permit) => (
                    <div 
                      key={permit.id}
                      className="bg-green-100 rounded p-2 border border-green-200 text-xs"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-green-900 truncate">
                            {permit.listing?.name || 'Unknown'}
                          </div>
                          <div className="text-green-700 text-[10px]">
                            {formatDate(permit.check_in_date, true)}
                            {permit.vehicle_registration && ` • ${permit.vehicle_registration}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {outstandingPermits.length > 3 && (
                    <div className="text-[10px] text-green-700 font-medium pl-1">
                      + {outstandingPermits.length - 3} more
                    </div>
                  )}
                </div>
              )}

              {/* Payment Pending */}
              {paymentPendingPermits.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  <div className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Payment Pending ({paymentPendingPermits.length})
                  </div>
                  {paymentPendingPermits.slice(0, 3).map((permit) => (
                    <div 
                      key={permit.id}
                      className="bg-amber-100 rounded p-2 border border-amber-200 text-xs"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-amber-900 truncate">
                            {permit.listing?.name || 'Unknown'}
                          </div>
                          <div className="text-amber-700 text-[10px]">
                            {formatDate(permit.check_in_date, true)} • {permit.parking_days}d
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {paymentPendingPermits.length > 3 && (
                    <div className="text-[10px] text-amber-700 font-medium pl-1">
                      + {paymentPendingPermits.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // DESKTOP FULL VIEW
  return (
    <div className="space-y-3">
      {/* OUTSTANDING PERMITS - Green (Informational) */}
      {outstandingPermits.length > 0 && (
        <Alert 
          className="relative bg-green-50 border-green-200 border-l-4 border-l-green-500 shadow-md"
        >
          <Car className="h-5 w-5 text-green-600" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <AlertTitle className="text-green-900 text-base font-semibold flex items-center gap-2">
                🅿️ Parking Permits Needed
              </AlertTitle>
              {!collapsedNeeded && (
                <AlertDescription className="text-green-800 text-sm mt-2">
                  <div className="font-medium mb-2">
                    {outstandingPermits.length} {outstandingPermits.length === 1 ? 'property needs' : 'properties need'} parking permits arranged:
                  </div>
                  <ul className="space-y-1.5 ml-1">
                    {outstandingPermits.slice(0, 5).map((permit) => (
                      <li key={permit.id} className="flex items-start gap-2 text-sm">
                        <span className="text-green-600 mt-0.5">•</span>
                        <span>
                          <strong className="font-medium">{permit.listing?.name || 'Unknown'}</strong>
                          {' - '}Check-in: {formatDate(permit.check_in_date)}
                          {permit.vehicle_registration && (
                            <span className="text-green-700 ml-1">
                              ({permit.vehicle_registration})
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                    {outstandingPermits.length > 5 && (
                      <li className="text-green-700 font-medium ml-2">
                        + {outstandingPermits.length - 5} more
                      </li>
                    )}
                  </ul>
                  <div className="text-xs mt-3 text-green-700">
                    📝 Remember to arrange permits in advance
                  </div>
                </AlertDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-green-600 hover:text-green-800 hover:bg-green-100 h-8 w-8 shrink-0"
              onClick={() => setCollapsedNeeded(!collapsedNeeded)}
              aria-label={collapsedNeeded ? "Expand alert" : "Collapse alert"}
            >
              {collapsedNeeded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </Button>
          </div>
        </Alert>
      )}

      {/* PAYMENT PENDING - Yellow-Green (Reminder) */}
      {paymentPendingPermits.length > 0 && (
        <Alert 
          className="relative bg-amber-50 border-amber-200 border-l-4 border-l-amber-500 shadow-md"
        >
          <DollarSign className="h-5 w-5 text-amber-600" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <AlertTitle className="text-amber-900 text-base font-semibold flex items-center gap-2">
                💰 Parking Permit Payments Pending
              </AlertTitle>
              {!collapsedPayment && (
                <AlertDescription className="text-amber-800 text-sm mt-2">
                  <div className="font-medium mb-2">
                    {paymentPendingPermits.length} parking {paymentPendingPermits.length === 1 ? 'permit has' : 'permits have'} pending payments:
                  </div>
                  <ul className="space-y-1.5 ml-1">
                    {paymentPendingPermits.slice(0, 5).map((permit) => (
                      <li key={permit.id} className="flex items-start gap-2 text-sm">
                        <span className="text-amber-600 mt-0.5">•</span>
                        <span>
                          <strong className="font-medium">{permit.listing?.name || 'Unknown'}</strong>
                          {' - '}Check-in: {formatDate(permit.check_in_date)}
                          {permit.parking_days && (
                            <span className="text-amber-700 ml-1">
                              ({permit.parking_days} {permit.parking_days === 1 ? 'day' : 'days'})
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                    {paymentPendingPermits.length > 5 && (
                      <li className="text-amber-700 font-medium ml-2">
                        + {paymentPendingPermits.length - 5} more
                      </li>
                    )}
                  </ul>
                  <div className="text-xs mt-3 text-amber-700">
                    💳 Don't forget to process payments
                  </div>
                </AlertDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-amber-600 hover:text-amber-800 hover:bg-amber-100 h-8 w-8 shrink-0"
              onClick={() => setCollapsedPayment(!collapsedPayment)}
              aria-label={collapsedPayment ? "Expand alert" : "Collapse alert"}
            >
              {collapsedPayment ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </Button>
          </div>
        </Alert>
      )}
    </div>
  )
}

