"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Clock, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EarlyCheckinDialog } from "./early-checkin-dialog"
import { getEarlyCheckins, deleteEarlyCheckin, updateEarlyCheckin, EarlyCheckin } from "@/lib/booking-addons"
import { toast } from "sonner"

// Helper function for 12-hour time format
const convertTo12Hour = (time24: string): string => {
  if (!time24) return ""
  const [hours, minutes] = time24.split(":")
  const hour = parseInt(hours)
  const period = hour >= 12 ? "PM" : "AM"
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${hour12}:${minutes} ${period}`
}

export function EarlyCheckinsSection() {
  const [checkins, setCheckins] = useState<EarlyCheckin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [timeFilter, setTimeFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCheckin, setEditingCheckin] = useState<EarlyCheckin | null>(null)

  // Load check-ins from database
  const loadCheckins = async () => {
    try {
      setIsLoading(true)
      const data = await getEarlyCheckins()
      setCheckins(data)
    } catch (error) {
      console.error("Error loading early check-ins:", error)
      toast.error("Failed to load early check-ins")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCheckins()
  }, [])

  const filteredCheckins = checkins.filter((checkin) => {
    const listingName = checkin.listing?.name || ""
    const matchesSearch =
      listingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (checkin.booking_platform || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || checkin.payment_status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleEdit = (checkin: EarlyCheckin) => {
    setEditingCheckin(checkin)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this early check-in request?")) return
    
    try {
      await deleteEarlyCheckin(id)
      toast.success("Early check-in deleted successfully")
      loadCheckins()
    } catch (error) {
      console.error("Error deleting early check-in:", error)
      toast.error("Failed to delete early check-in")
    }
  }

  const handleAdd = () => {
    setEditingCheckin(null)
    setIsDialogOpen(true)
  }

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setEditingCheckin(null)
    }
  }

  const handleSaveSuccess = () => {
    loadCheckins()
  }

  const handlePaymentStatusChange = async (id: string, newStatus: "payment_requested" | "payment_made") => {
    try {
      await updateEarlyCheckin(id, { payment_status: newStatus })
      toast.success("Payment status updated")
      loadCheckins()
    } catch (error) {
      console.error("Error updating payment status:", error)
      toast.error("Failed to update payment status")
    }
  }

  return (
    <>
      <Card className="shadow-sm rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Early Check-ins</CardTitle>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Check-in Request
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Input
              placeholder="Search by listing or booking ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="payment_requested">Payment Requested</SelectItem>
                <SelectItem value="payment_made">Payment Made</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox />
                  </TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead>Booking Platform</TableHead>
                  <TableHead>Check-in Date</TableHead>
                  <TableHead>Standard Time</TableHead>
                  <TableHead>Requested Time</TableHead>
                  <TableHead>Fee Paid</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                        Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredCheckins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCheckins.map((checkin) => (
                    <TableRow key={checkin.id}>
                      <TableCell>
                        <Checkbox />
                      </TableCell>
                      <TableCell>
                        <button className="text-blue-400 hover:text-blue-300 text-left">
                          {checkin.listing?.name || "Unknown Listing"}
                        </button>
                      </TableCell>
                      <TableCell>{checkin.booking_platform || "-"}</TableCell>
                      <TableCell>{checkin.check_in_date ? format(new Date(checkin.check_in_date), "dd/MM/yyyy") : "-"}</TableCell>
                      <TableCell>{convertTo12Hour(checkin.standard_time)}</TableCell>
                      <TableCell>
                        {checkin.requested_time ? (
                          <span
                            className={
                              parseInt(checkin.requested_time.split(":")[0]) < 9
                                ? "text-orange-500 font-medium"
                                : ""
                            }
                          >
                            {convertTo12Hour(checkin.requested_time)}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {checkin.fee_paid === 0 ? (
                          <Badge variant="outline" className="border-green-500 text-green-600">
                            Free
                          </Badge>
                        ) : (
                          <span className="font-medium">£{checkin.fee_paid.toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={checkin.payment_status} 
                          onValueChange={(val) => handlePaymentStatusChange(checkin.id, val as "payment_requested" | "payment_made")}
                        >
                          <SelectTrigger className={`w-[200px] h-8 ${
                            checkin.payment_status === "payment_made" 
                              ? "border-green-500 text-green-700 bg-green-50" 
                              : "border-amber-500 text-amber-700 bg-amber-50"
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="payment_requested" className="text-amber-700">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Payment Requested
                              </span>
                            </SelectItem>
                            <SelectItem value="payment_made" className="text-green-700">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Payment Made
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={checkin.notes || ""}>
                        {checkin.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(checkin)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(checkin.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isDialogOpen && (
        <EarlyCheckinDialog 
          key={editingCheckin?.id || 'new'} 
          open={isDialogOpen} 
          onOpenChange={handleDialogClose}
          onSave={handleSaveSuccess}
          checkin={editingCheckin} 
        />
      )}
    </>
  )
}
