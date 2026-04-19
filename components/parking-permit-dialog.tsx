"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ParkingPermit, createParkingPermit, updateParkingPermit } from "@/lib/booking-addons"
import { getActiveListings, Listing } from "@/lib/models"
import { toast } from "sonner"

interface ParkingPermitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: () => void
  permit: ParkingPermit | null
}

export function ParkingPermitDialog({ open, onOpenChange, onSave, permit }: ParkingPermitDialogProps) {
  const [listings, setListings] = useState<Listing[]>([])
  const [listingId, setListingId] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [vehicleReg, setVehicleReg] = useState("")
  const [platformLink, setPlatformLink] = useState("")
  const [permitStatus, setPermitStatus] = useState<"permit_os" | "permit_completed">("permit_os")
  const [feePaidStatus, setFeePaidStatus] = useState<"paid" | "payment_pending">("payment_pending")
  const [numberOfDays, setNumberOfDays] = useState("1")
  const [isSaving, setIsSaving] = useState(false)

  // Load listings (only visible ones for dropdown)
  useEffect(() => {
    const loadListings = async () => {
      try {
        const data = await getActiveListings()
        setListings(data || [])
      } catch (error) {
        console.error("Error loading listings:", error)
        toast.error("Failed to load listings")
      }
    }
    loadListings()
  }, [])

  // Populate form when editing
  useEffect(() => {
    if (permit && open) {
      setListingId(permit.listing_id || "")
      setCheckIn(permit.check_in_date || "")
      setCheckOut(permit.check_out_date || "")
      setVehicleReg(permit.vehicle_registration || "")
      setPlatformLink(permit.platform_link || "")
      setPermitStatus(permit.permit_status)
      setFeePaidStatus(permit.fee_paid_status)
      setNumberOfDays(permit.parking_days.toString())
    } else if (!open) {
      // Reset form when dialog closes
      setListingId("")
      setCheckIn("")
      setCheckOut("")
      setVehicleReg("")
      setPlatformLink("")
      setPermitStatus("permit_os")
      setFeePaidStatus("payment_pending")
      setNumberOfDays("1")
    }
  }, [permit, open])

  const handleSave = async () => {
    // All fields are now optional, no validation required
    setIsSaving(true)
    try {
      const data = {
        listing_id: listingId || null,
        vehicle_registration: vehicleReg ? vehicleReg.toUpperCase() : null,
        check_in_date: checkIn || null,
        check_out_date: checkOut || null,
        parking_days: parseInt(numberOfDays),
        platform_link: platformLink || null,
        permit_status: permitStatus,
        fee_paid_status: feePaidStatus,
        notes: null,
      }

      if (permit) {
        await updateParkingPermit(permit.id, data)
        toast.success("Parking permit updated successfully")
      } else {
        await createParkingPermit(data)
        toast.success("Parking permit created successfully")
      }

      setIsSaving(false)
      onOpenChange(false) // Close the dialog
      onSave?.() // Trigger refresh callback
    } catch (error) {
      console.error("Error saving parking permit:", error)
      toast.error("Failed to save parking permit")
      setIsSaving(false)
    }
  }

  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{permit ? "Edit Parking Permit" : "Add Parking Permit"}</DialogTitle>
          <DialogDescription>
            {permit ? "Update the parking permit details below." : "Fill in the details for the new parking permit."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="listing">Listing</Label>
            <Select value={listingId} onValueChange={setListingId}>
              <SelectTrigger id="listing">
                <SelectValue placeholder="Select listing" />
              </SelectTrigger>
              <SelectContent>
                {listings.map((listing) => (
                  <SelectItem key={listing.id} value={listing.id}>
                    {listing.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="checkIn">Check-in Date</Label>
              <Input
                id="checkIn"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="checkOut">Check-out Date</Label>
              <Input
                id="checkOut"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vehicleReg">Vehicle Registration</Label>
            <Input
              id="vehicleReg"
              placeholder="AB12 CDE"
              value={vehicleReg}
              onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
              className="font-mono"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="numberOfDays">Number of Days (Permit Duration)</Label>
            <Select value={numberOfDays} onValueChange={setNumberOfDays}>
              <SelectTrigger id="numberOfDays">
                <SelectValue placeholder="Select number of days" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 14 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    {day} {day === 1 ? "day" : "days"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Guest may stay longer, but permit is only needed for selected days
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="platformLink">Parking Platform Link</Label>
            <Input
              id="platformLink"
              type="url"
              placeholder="https://..."
              value={platformLink}
              onChange={(e) => setPlatformLink(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="permitStatus">Permit</Label>
              <Select value={permitStatus} onValueChange={(val) => setPermitStatus(val as "permit_os" | "permit_completed")}>
                <SelectTrigger id="permitStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permit_os">Permit O/S</SelectItem>
                  <SelectItem value="permit_completed">Permit Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="feePaidStatus">Fee Paid</Label>
              <Select value={feePaidStatus} onValueChange={(val) => setFeePaidStatus(val as "paid" | "payment_pending")}>
                <SelectTrigger id="feePaidStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="payment_pending">Payment Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : permit ? "Update" : "Add"} Permit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
