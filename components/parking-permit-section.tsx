"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Car, Plus, MoreHorizontal, ExternalLink, Pencil, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ParkingPermitDialog } from "./parking-permit-dialog"
import { getParkingPermits, deleteParkingPermit, updateParkingPermit, ParkingPermit } from "@/lib/booking-addons"
import { toast } from "sonner"

export function ParkingPermitsSection() {
  const [permits, setPermits] = useState<ParkingPermit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [timeFilter, setTimeFilter] = useState("all")
  const [selectedPermits, setSelectedPermits] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPermit, setEditingPermit] = useState<ParkingPermit | null>(null)

  // Load permits from database
  const loadPermits = async () => {
    try {
      setIsLoading(true)
      const data = await getParkingPermits()
      setPermits(data)
    } catch (error) {
      console.error("Error loading parking permits:", error)
      toast.error("Failed to load parking permits")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPermits()
  }, [])

  const filteredPermits = permits.filter((permit) => {
    const listingName = permit.listing?.name || ""
    const matchesSearch =
      listingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (permit.vehicle_registration || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || permit.permit_status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleEdit = (permit: ParkingPermit) => {
    setEditingPermit(permit)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this parking permit?")) return
    
    try {
      await deleteParkingPermit(id)
      toast.success("Parking permit deleted successfully")
      loadPermits()
    } catch (error) {
      console.error("Error deleting parking permit:", error)
      toast.error("Failed to delete parking permit")
    }
  }

  const handleAdd = () => {
    setEditingPermit(null)
    setIsDialogOpen(true)
  }

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setEditingPermit(null)
    }
  }

  const handleSaveSuccess = () => {
    loadPermits()
  }

  const handlePermitStatusChange = async (id: string, newStatus: "permit_os" | "permit_completed") => {
    try {
      await updateParkingPermit(id, { permit_status: newStatus })
      toast.success("Permit status updated")
      loadPermits()
    } catch (error) {
      console.error("Error updating permit status:", error)
      toast.error("Failed to update permit status")
    }
  }

  const handleFeePaidStatusChange = async (id: string, newStatus: "paid" | "payment_pending") => {
    try {
      await updateParkingPermit(id, { fee_paid_status: newStatus })
      toast.success("Fee paid status updated")
      loadPermits()
    } catch (error) {
      console.error("Error updating fee paid status:", error)
      toast.error("Failed to update fee paid status")
    }
  }

  return (
    <>
      <Card className="shadow-sm rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Parking Permits</CardTitle>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Parking Permit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Input
              placeholder="Search by listing or vehicle reg..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Permit Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Permits</SelectItem>
                <SelectItem value="permit_completed">Permit Completed</SelectItem>
                <SelectItem value="permit_os">Permit O/S</SelectItem>
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
                  <TableHead>Vehicle Reg</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead className="text-center">Link</TableHead>
                  <TableHead>Permit</TableHead>
                  <TableHead>Fee Paid</TableHead>
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
                ) : filteredPermits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPermits.map((permit) => (
                    <TableRow key={permit.id}>
                      <TableCell>
                        <Checkbox />
                      </TableCell>
                      <TableCell>
                        <button className="text-blue-400 hover:text-blue-300 text-left">
                          {permit.listing?.name || "Unknown Listing"}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{permit.vehicle_registration || "-"}</TableCell>
                      <TableCell>{permit.check_in_date ? format(new Date(permit.check_in_date), "dd/MM/yyyy") : "-"}</TableCell>
                      <TableCell>{permit.check_out_date ? format(new Date(permit.check_out_date), "dd/MM/yyyy") : "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-normal">
                          {permit.parking_days}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {permit.platform_link ? (
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <a href={permit.platform_link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={permit.permit_status} 
                          onValueChange={(val) => handlePermitStatusChange(permit.id, val as "permit_os" | "permit_completed")}
                        >
                          <SelectTrigger className={`w-[180px] h-8 ${
                            permit.permit_status === "permit_completed" 
                              ? "border-green-500 text-green-700 bg-green-50" 
                              : "border-orange-500 text-orange-700 bg-orange-50"
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="permit_os" className="text-orange-700">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                Permit O/S
                              </span>
                            </SelectItem>
                            <SelectItem value="permit_completed" className="text-green-700">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Permit Completed
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={permit.fee_paid_status} 
                          onValueChange={(val) => handleFeePaidStatusChange(permit.id, val as "paid" | "payment_pending")}
                        >
                          <SelectTrigger className={`w-[180px] h-8 ${
                            permit.fee_paid_status === "paid" 
                              ? "border-green-500 text-green-700 bg-green-50" 
                              : "border-amber-500 text-amber-700 bg-amber-50"
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="payment_pending" className="text-amber-700">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Payment Pending
                              </span>
                            </SelectItem>
                            <SelectItem value="paid" className="text-green-700">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Paid
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(permit)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(permit.id)}>
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
        <ParkingPermitDialog 
          key={editingPermit?.id || 'new'} 
          open={isDialogOpen} 
          onOpenChange={handleDialogClose}
          onSave={handleSaveSuccess}
          permit={editingPermit} 
        />
      )}
    </>
  )
}
