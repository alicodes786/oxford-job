"use client"

import { useState, useEffect } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EarlyCheckin, createEarlyCheckin, updateEarlyCheckin } from "@/lib/booking-addons"
import { getActiveListings, Listing } from "@/lib/models"
import { toast } from "sonner"
import { format, isValid, parse } from "date-fns"
import { ManualEventDateDropdowns } from "@/components/manual-event-date-dropdowns"
import { EarlyCheckinRequestedTimeDropdowns } from "@/components/early-checkin-requested-time-dropdowns"

/** DB / API uses yyyy-MM-dd; ManualEventDateDropdowns uses dd/MM/yyyy */
function checkInDateDbToDisplay(s: string | null | undefined): string {
  if (!s?.trim()) return ""
  const trimmed = s.trim().slice(0, 10)
  let parsed = parse(trimmed, "yyyy-MM-dd", new Date())
  if (!isValid(parsed)) {
    parsed = parse(trimmed, "dd/MM/yyyy", new Date())
  }
  if (!isValid(parsed)) return ""
  return format(parsed, "dd/MM/yyyy")
}

function checkInDateDisplayToDb(s: string): string | null {
  if (!s?.trim()) return null
  const parsed = parse(s.trim(), "dd/MM/yyyy", new Date())
  if (!isValid(parsed)) return null
  return format(parsed, "yyyy-MM-dd")
}

// Helper functions for 12-hour time format
const convertTo12Hour = (time24: string): string => {
  if (!time24) return ""
  const [hours, minutes] = time24.split(":")
  const hour = parseInt(hours)
  const period = hour >= 12 ? "PM" : "AM"
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${hour12}:${minutes} ${period}`
}

interface EarlyCheckinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: () => void
  checkin: EarlyCheckin | null
}

export function EarlyCheckinDialog({ open, onOpenChange, onSave, checkin }: EarlyCheckinDialogProps) {
  const [listings, setListings] = useState<Listing[]>([])
  const [listingId, setListingId] = useState("")
  const [bookingPlatform, setBookingPlatform] = useState("")
  const [checkInDate, setCheckInDate] = useState("")
  const [standardTime, setStandardTime] = useState("15:00")
  const [requestedTime, setRequestedTime] = useState("")
  const [feePaid, setFeePaid] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<"payment_requested" | "payment_made">("payment_requested")
  const [notes, setNotes] = useState("")
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
    if (checkin && open) {
      setListingId(checkin.listing_id || "")
      setBookingPlatform(checkin.booking_platform || "")
      setCheckInDate(checkInDateDbToDisplay(checkin.check_in_date))
      setStandardTime(checkin.standard_time)
      setRequestedTime(checkin.requested_time || "")
      setFeePaid(checkin.fee_paid.toString())
      setPaymentStatus(checkin.payment_status)
      setNotes(checkin.notes || "")
    } else if (!open) {
      // Reset form when dialog closes
      setListingId("")
      setBookingPlatform("")
      setCheckInDate("")
      setStandardTime("15:00")
      setRequestedTime("")
      setFeePaid("")
      setPaymentStatus("payment_requested")
      setNotes("")
    }
  }, [checkin, open])

  const handleSave = async () => {
    // All fields are now optional, no validation required
    setIsSaving(true)
    try {
      const data = {
        listing_id: listingId || null,
        booking_platform: bookingPlatform || null,
        check_in_date: checkInDateDisplayToDb(checkInDate),
        standard_time: standardTime,
        requested_time: requestedTime || null,
        fee_paid: parseFloat(feePaid) || 0,
        payment_status: paymentStatus,
        notes: notes || null,
      }

      if (checkin) {
        await updateEarlyCheckin(checkin.id, data)
        toast.success("Early check-in updated successfully")
      } else {
        await createEarlyCheckin(data)
        toast.success("Early check-in created successfully")
      }

      setIsSaving(false)
      onOpenChange(false) // Close the dialog
      onSave?.() // Trigger refresh callback
    } catch (error) {
      console.error("Error saving early check-in:", error)
      toast.error("Failed to save early check-in")
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
          <DialogTitle>{checkin ? "Edit Early Check-in" : "Add Early Check-in Request"}</DialogTitle>
          <DialogDescription>
            {checkin
              ? "Update the early check-in request details below."
              : "Fill in the details for the new early check-in request."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
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

          <div className="grid gap-2">
            <Label htmlFor="bookingPlatform">Booking Platform</Label>
            <Select value={bookingPlatform} onValueChange={setBookingPlatform}>
              <SelectTrigger id="bookingPlatform">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Airbnb">Airbnb</SelectItem>
                <SelectItem value="Booking.com">Booking.com</SelectItem>
                <SelectItem value="Direct">Direct</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ManualEventDateDropdowns
            label="Check-in Date (Optional)"
            value={checkInDate}
            onChange={setCheckInDate}
            allowEmpty
            idPrefix="early-checkin-date"
          />

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="standardTime">Standard Check-in Time</Label>
              <div id="standardTime" className="text-sm font-medium bg-muted rounded-md px-3 py-2">
                {convertTo12Hour(standardTime)}
              </div>
            </div>

            <EarlyCheckinRequestedTimeDropdowns
              label="Requested Check-in Time (Optional)"
              value={requestedTime}
              onChange={setRequestedTime}
              allowEmpty
              idPrefix="early-checkin-requested"
            />
            {requestedTime && (
              <div className="text-xs text-muted-foreground">
                {convertTo12Hour(requestedTime)}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feePaid">Fee Paid (£)</Label>
            <Input
              id="feePaid"
              type="number"
              placeholder="0 for free"
              value={feePaid}
              onChange={(e) => setFeePaid(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="paymentStatus">Payment</Label>
            <Select value={paymentStatus} onValueChange={(val) => setPaymentStatus(val as "payment_requested" | "payment_made")}>
              <SelectTrigger id="paymentStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment_requested">Payment Requested</SelectItem>
                <SelectItem value="payment_made">Payment Made</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Cleaner assignments, property availability, special requests..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : checkin ? "Update" : "Add"} Check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
