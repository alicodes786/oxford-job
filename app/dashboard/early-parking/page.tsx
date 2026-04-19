"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { EarlyCheckinsSection } from "@/components/early-checkins-section"
import { ParkingPermitsSection } from "@/components/parking-permit-section"

export default function BookingAddonsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Same access model as listings dashboard: admin + sub-admin only (no dashboard_permissions)
  useEffect(() => {
    if (!loading && user) {
      const ok = user.role === 'admin' || user.role === 'sub-admin'
      if (!ok) {
        router.push('/dashboard')
        toast.error('You do not have permission to access this page')
      }
    }
  }, [user, loading, router])

  if (loading) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Booking Add-ons</h1>
          <p className="text-muted-foreground">Manage parking permits and early check-in requests</p>
        </div>

        {/* Parking Permits Section */}
        <ParkingPermitsSection />

        {/* Early Check-ins Section */}
        <EarlyCheckinsSection />
      </div>
    </div>
  )
}
