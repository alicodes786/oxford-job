"use client"

import { ParkingPermitsSection } from "./parking-permit-section"
import { EarlyCheckinsSection } from "./early-checkins-section"

interface BookingAddonsTabProps {
  refreshKey?: number;
}

export function BookingAddonsTab({ refreshKey }: BookingAddonsTabProps) {
  return (
    <div className="space-y-6">
      {/* Parking Permits Section */}
      <ParkingPermitsSection key={`permits-${refreshKey}`} />
      
      {/* Early Check-ins Section */}
      <EarlyCheckinsSection key={`checkins-${refreshKey}`} />
    </div>
  )
}

