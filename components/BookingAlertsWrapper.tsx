'use client'

import { EarlyCheckinAlerts } from './EarlyCheckinAlerts'
import { ParkingPermitAlerts } from './ParkingPermitAlerts'
import { BinCollectionAlerts } from './BinCollectionAlerts'
import type { BinAlertRow } from '@/lib/bin-collection-schedule'
import type { EarlyCheckin, ParkingPermit } from '@/lib/booking-addons'

interface BookingAlertsWrapperProps {
  earlyCheckins: EarlyCheckin[]
  parkingPermits: ParkingPermit[]
  binAlerts?: BinAlertRow[]
}

export function BookingAlertsWrapper({
  earlyCheckins,
  parkingPermits,
  binAlerts = [],
}: BookingAlertsWrapperProps) {
  const hasEarlyCheckins = earlyCheckins.length > 0
  const hasParkingPermits = parkingPermits.length > 0
  const hasBinAlerts = binAlerts.length > 0

  if (!hasEarlyCheckins && !hasParkingPermits && !hasBinAlerts) {
    return null
  }

  return (
    <div className="booking-alerts-container">
      <div className="hidden lg:grid lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] lg:gap-4">
        {hasEarlyCheckins && (
          <div className="space-y-3">
            <EarlyCheckinAlerts earlyCheckins={earlyCheckins} />
          </div>
        )}
        {hasParkingPermits && (
          <div className="space-y-3">
            <ParkingPermitAlerts permits={parkingPermits} />
          </div>
        )}
        {hasBinAlerts && (
          <div className="space-y-3">
            <BinCollectionAlerts alerts={binAlerts} />
          </div>
        )}
      </div>

      <div className="lg:hidden space-y-3">
        {hasEarlyCheckins && <EarlyCheckinAlerts earlyCheckins={earlyCheckins} isMobile />}
        {hasParkingPermits && <ParkingPermitAlerts permits={parkingPermits} isMobile />}
        {hasBinAlerts && <BinCollectionAlerts alerts={binAlerts} isMobile />}
      </div>
    </div>
  )
}
