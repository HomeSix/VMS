"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"

import { translations, type Locale } from "@/lib/translations"
import { createClient } from "@/lib/client"

import { FieldLabel } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDownIcon } from "lucide-react"

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toMinutes(timeValue: string) {
  const [hours, minutes] = timeValue.split(":").map(Number)
  return hours * 60 + minutes
}

function toTimeValue(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd
}

function formatDateForDisplay(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "my" ? "ms-MY" : "en-MY", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

const START_MINUTE = 8 * 60
const END_MINUTE = 17 * 60
const SLOT_STEP = 30
const TIME_SLOTS = Array.from({ length: (END_MINUTE - START_MINUTE) / SLOT_STEP }, (_, index) =>
  toTimeValue(START_MINUTE + index * SLOT_STEP)
)

type TimeRange = { start: string; end: string }

export default function BookingSchedulePage() {
  const params = useParams<{ locale?: string }>()
  const searchParams = useSearchParams()

  const localeParam = params?.locale
  const locale: Locale = localeParam === "my" ? "my" : "en"
  const t = translations[locale] ?? translations.en

  const incomingDate = searchParams.get("date")
  const incomingStart = searchParams.get("start")
  const incomingEnd = searchParams.get("end")

  const [dateOpen, setDateOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>()
  const [bookedRanges, setBookedRanges] = useState<TimeRange[]>([])
  const [selectedRange, setSelectedRange] = useState<TimeRange | null>(null)
  const [pendingStartTime, setPendingStartTime] = useState<string | null>(null)

  useEffect(() => {
    if (!incomingDate) return

    const [year, month, day] = incomingDate.split("-").map(Number)
    if (!year || !month || !day) return

    setDate(new Date(year, month - 1, day))

    if (incomingStart && incomingEnd) {
      setSelectedRange({ start: incomingStart, end: incomingEnd })
    }
  }, [incomingDate, incomingStart, incomingEnd])

  useEffect(() => {
    const loadBookedSlots = async () => {
      if (!date) {
        setBookedRanges([])
        return
      }

      const supabase = createClient()

      const { data, error } = await supabase
        .from("bookings")
        .select("start_time, end_time")
        .eq("visit_date", toDateKey(date))
        .order("start_time", { ascending: true })

      if (error) {
        setBookedRanges([])
        return
      }

      const normalized = (data ?? [])
        .map((item) => ({
          start: String(item.start_time).slice(0, 5),
          end: String(item.end_time).slice(0, 5),
        }))
        .filter((item) => item.start.length === 5 && item.end.length === 5)

      setBookedRanges(normalized)
    }

    void loadBookedSlots()
  }, [date])

  const dateKey = date ? toDateKey(date) : null

  const isSlotBooked = (slotTime: string) => {
    const slotStart = toMinutes(slotTime)
    const slotEnd = slotStart + SLOT_STEP

    return bookedRanges.some((booked) =>
      rangesOverlap(slotStart, slotEnd, toMinutes(booked.start), toMinutes(booked.end))
    )
  }

  const availableSlots = TIME_SLOTS.filter((slot) => !isSlotBooked(slot))

  const handleTimeClick = (slotTime: string) => {
    if (isSlotBooked(slotTime)) return

    if (!pendingStartTime) {
      setPendingStartTime(slotTime)
      setSelectedRange(null)
      return
    }

    if (slotTime === pendingStartTime) {
      setSelectedRange(null)
      return
    }

    const start = toMinutes(slotTime) < toMinutes(pendingStartTime) ? slotTime : pendingStartTime
    const end = toMinutes(slotTime) < toMinutes(pendingStartTime) ? pendingStartTime : slotTime

    const overlapsBooking = bookedRanges.some((booked) =>
      rangesOverlap(toMinutes(start), toMinutes(end), toMinutes(booked.start), toMinutes(booked.end))
    )

    if (overlapsBooking) {
      setSelectedRange(null)
      setPendingStartTime(slotTime)
      return
    }

    setSelectedRange({ start, end })
    setPendingStartTime(null)
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex w-full max-w-3xl flex-col gap-6 row-start-2">
        <div>
          <h1 className="text-2xl font-semibold">{t.scheduleTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.scheduleSubtitle}</p>
        </div>

        {/* date and time */}
        <div className="grid gap-4 rounded-md border border-input p-4">
          <FieldLabel htmlFor="date-picker">{t.date}</FieldLabel>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  id="date-picker"
                  className="w-64 justify-between font-normal"
                >
                  {date ? formatDateForDisplay(date, locale) : t.date}
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              }
            />
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                captionLayout="dropdown"
                defaultMonth={date}
                onSelect={(nextDate) => {
                  setDate(nextDate)
                  setSelectedRange(null)
                  setPendingStartTime(null)
                  setDateOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>

          {date && (
            <>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t.scheduleDragHint}</p>
                <p className="text-sm text-muted-foreground">{t.scheduleBlockedHint}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {TIME_SLOTS.map((slotTime) => {
                  const booked = isSlotBooked(slotTime)
                  const isPendingStart = pendingStartTime === slotTime

                  const inConfirmed =
                    selectedRange !== null &&
                    toMinutes(slotTime) >= toMinutes(selectedRange.start) &&
                    toMinutes(slotTime) <= toMinutes(selectedRange.end)

                  return (
                    <button
                      key={slotTime}
                      type="button"
                      disabled={booked}
                      onClick={() => handleTimeClick(slotTime)}
                      className={[
                        "h-10 rounded-md border text-sm",
                        booked && "cursor-not-allowed border-muted bg-muted text-muted-foreground",
                        !booked && !isPendingStart && !inConfirmed && "border-input hover:bg-accent",
                        isPendingStart && "border-foreground bg-accent",
                        inConfirmed && !isPendingStart && "border-foreground bg-foreground text-background",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {slotTime}
                    </button>
                  )
                })}
              </div>

              {availableSlots.length === 0 && (
                <p className="text-sm text-destructive">{t.scheduleNoSlots}</p>
              )}

              {bookedRanges.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t.timeBookedSlotsLabel}: {bookedRanges.map((item) => `${item.start} - ${item.end}`).join(", ")}
                </p>
              )}
            </>
          )}

          <div className="grid gap-1 border-t border-input pt-4 text-sm">
            <p>
              <span className="font-medium">{t.scheduleSelectedDate}: </span>
              {date ? formatDateForDisplay(date, locale) : "-"}
            </p>
            <p>
              <span className="font-medium">{t.scheduleSelectedTime}: </span>
              {selectedRange ? `${selectedRange.start} - ${selectedRange.end}` : "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={`/${locale}`}>
              <Button type="button" variant="secondary">Back</Button>
            </Link>

            <Link
              href={
                dateKey && selectedRange
                  ? `/${locale}/booking?date=${dateKey}&start=${selectedRange.start}&end=${selectedRange.end}`
                  : `/${locale}/booking`
              }
              aria-disabled={!dateKey || !selectedRange}
              className={!dateKey || !selectedRange ? "pointer-events-none opacity-50" : ""}
            >
              <Button type="button" variant="outline" disabled={!dateKey || !selectedRange}>
                {t.scheduleContinueButton}
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
