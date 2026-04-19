"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface EarlyCheckinRequestedTimeDropdownsProps {
  label: string
  value: string
  onChange: (value: string) => void
  allowEmpty?: boolean
  idPrefix: string
}

function parseHHmm(s: string): { h: number; m: number } | null {
  if (!s?.trim()) return null
  const [a, b] = s.trim().split(":")
  const h = parseInt(a, 10)
  const m = parseInt(b, 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return { h: Math.min(23, Math.max(0, h)), m: Math.min(59, Math.max(0, m)) }
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** HH:mm (24h) via hour + minute dropdowns. */
export function EarlyCheckinRequestedTimeDropdowns({
  label,
  value,
  onChange,
  allowEmpty,
  idPrefix,
}: EarlyCheckinRequestedTimeDropdownsProps) {
  const parsed = parseHHmm(value)
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = [0, 15, 30, 45]

  const emptyVal = "__none__"
  const hVal = parsed !== null ? parsed.h : -1
  const mVal = parsed !== null ? parsed.m : -1

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${idPrefix}-hour`}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        <Select
          value={hVal >= 0 ? String(hVal) : emptyVal}
          onValueChange={(v) => {
            if (v === emptyVal) {
              if (allowEmpty) onChange("")
              return
            }
            const h = parseInt(v, 10)
            const m = mVal >= 0 ? mVal : 0
            onChange(`${pad(h)}:${pad(m)}`)
          }}
        >
          <SelectTrigger id={`${idPrefix}-hour`} className="w-[100px]">
            <SelectValue placeholder="Hour" />
          </SelectTrigger>
          <SelectContent>
            {allowEmpty && <SelectItem value={emptyVal}>—</SelectItem>}
            {hours.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {pad(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="self-center text-muted-foreground">:</span>
        <Select
          value={mVal >= 0 ? String(mVal) : emptyVal}
          onValueChange={(v) => {
            if (v === emptyVal) {
              if (allowEmpty) onChange("")
              return
            }
            const m = parseInt(v, 10)
            const h = hVal >= 0 ? hVal : 0
            onChange(`${pad(h)}:${pad(m)}`)
          }}
        >
          <SelectTrigger id={`${idPrefix}-minute`} className="w-[100px]">
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent>
            {allowEmpty && <SelectItem value={emptyVal}>—</SelectItem>}
            {minutes.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {pad(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
