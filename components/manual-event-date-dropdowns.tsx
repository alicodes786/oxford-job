"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface ManualEventDateDropdownsProps {
  label: string
  value: string
  onChange: (value: string) => void
  allowEmpty?: boolean
  idPrefix: string
}

function parseDdMmYyyy(s: string): { day: string; month: string; year: string } | null {
  if (!s?.trim()) return null
  const p = s.trim().split("/")
  if (p.length !== 3) return null
  const day = p[0].replace(/\D/g, "").slice(0, 2).padStart(2, "0")
  const month = p[1].replace(/\D/g, "").slice(0, 2).padStart(2, "0")
  let year = p[2].replace(/\D/g, "")
  if (year.length === 2) year = `20${year}`
  if (year.length !== 4) return null
  return { day, month, year }
}

function emit(day: string, month: string, year: string, onChange: (v: string) => void, allowEmpty?: boolean) {
  if (!day && !month && !year) {
    if (allowEmpty) onChange("")
    return
  }
  const d = day || "01"
  const m = month || "01"
  const y = year || String(new Date().getFullYear())
  onChange(`${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`)
}

/** dd/MM/yyyy via day / month / year dropdowns (London parity UI). */
export function ManualEventDateDropdowns({
  label,
  value,
  onChange,
  allowEmpty,
  idPrefix,
}: ManualEventDateDropdownsProps) {
  const parsed = parseDdMmYyyy(value)
  const y0 = new Date().getFullYear()
  const years = Array.from({ length: 7 }, (_, i) => String(y0 - 3 + i))
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"))
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))

  const day = parsed?.day ?? ""
  const month = parsed?.month ?? ""
  const year = parsed?.year ?? ""

  const emptyVal = "__none__"

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${idPrefix}-day`}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        <Select
          value={day || emptyVal}
          onValueChange={(v) => {
            const next = v === emptyVal ? "" : v
            emit(next, month, year, onChange, allowEmpty)
          }}
        >
          <SelectTrigger id={`${idPrefix}-day`} className="w-[88px]">
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent>
            {allowEmpty && <SelectItem value={emptyVal}>—</SelectItem>}
            {days.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={month || emptyVal}
          onValueChange={(v) => {
            const next = v === emptyVal ? "" : v
            emit(day, next, year, onChange, allowEmpty)
          }}
        >
          <SelectTrigger id={`${idPrefix}-month`} className="w-[88px]">
            <SelectValue placeholder="Mo" />
          </SelectTrigger>
          <SelectContent>
            {allowEmpty && <SelectItem value={emptyVal}>—</SelectItem>}
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={year || emptyVal}
          onValueChange={(v) => {
            const next = v === emptyVal ? "" : v
            emit(day, month, next, onChange, allowEmpty)
          }}
        >
          <SelectTrigger id={`${idPrefix}-year`} className="w-[100px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {allowEmpty && <SelectItem value={emptyVal}>—</SelectItem>}
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
