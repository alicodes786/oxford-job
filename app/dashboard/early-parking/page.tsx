"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { EarlyCheckinsSection } from '@/components/early-checkins-section'
import { ParkingPermitsSection } from '@/components/parking-permit-section'

export default function BookingAddonsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (
      !loading &&
      user &&
      user.role !== 'admin' &&
      user.role !== 'sub-admin'
    ) {
      router.push('/dashboard')
      toast.error('You do not have permission to access this page')
    }
  }, [user, loading, router])

  if (loading) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Booking Add-ons</h1>
          <p className="text-muted-foreground">
            Manage parking permits and early check-in requests
          </p>
        </div>

        <ParkingPermitsSection />

        <EarlyCheckinsSection />
      </div>
    </div>
  )
}
