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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

const START_MINUTE = 7.5 * 60
const END_MINUTE = 17 * 60
const SLOT_STEP = 30
const TIME_SLOTS = Array.from({ length: (END_MINUTE - START_MINUTE) / SLOT_STEP }, (_, index) =>
  toTimeValue(START_MINUTE + index * SLOT_STEP)
)

type TimeRange = { start: string; end: string }

type Teacher = { id: string; fullName: string; isAvailable: boolean }

export default function BookingSchedulePage() {
  const params = useParams<{ locale?: string }>()
  const searchParams = useSearchParams()

  const localeParam = params?.locale
  const locale: Locale = localeParam === "my" ? "my" : "en"
  const t = translations[locale] ?? translations.en

  const incomingDate = searchParams.get("date")
  const incomingStart = searchParams.get("start")
  const incomingEnd = searchParams.get("end")
  const incomingTeacher = searchParams.get("teacher")

  const [dateOpen, setDateOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>()
  const [bookedRanges, setBookedRanges] = useState<TimeRange[]>([])
  const [selectedRange, setSelectedRange] = useState<TimeRange | null>(null)
  const [pendingStartTime, setPendingStartTime] = useState<string | null>(null)
  const [teacherName, setTeacherName] = useState(incomingTeacher ?? "")
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teachersLoading, setTeachersLoading] = useState(true)
  const [teacherAllowedSlots, setTeacherAllowedSlots] = useState<Set<string> | null>(null)

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
    if (!incomingTeacher) return
    setTeacherName(incomingTeacher)
  }, [incomingTeacher])

  useEffect(() => {
    const loadTeachers = async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from("system_user")
        .select("id, full_name, isAvailable, roles(name)")
        .order("full_name", { ascending: true })

      if (error) {
        setTeachers([])
        setTeachersLoading(false)
        return
      }

      const normalized = (data ?? [])
        .filter((row: any) => row.roles?.name !== "admin")
        .map((row: any) => {
          const raw = row.isAvailable;
          return {
            id: String(row.id),
            fullName: String(row.full_name ?? "").trim(),
            isAvailable: raw === null || raw === undefined || raw === true || raw === "true",
          };
        })
        .filter((row) => row.fullName.length > 0)

      setTeachers(normalized)
      setTeachersLoading(false)
    }

    void loadTeachers()
  }, [])

  useEffect(() => {
    const loadAvailability = async () => {
      if (!date || !teacherName) {
        setBookedRanges([]);
        setTeacherAllowedSlots(null);
        return;
      }

      const teacher = teachers.find((t) => t.fullName === teacherName);
      if (!teacher) {
        setBookedRanges([]);
        setTeacherAllowedSlots(null);
        return;
      }

      const supabase = createClient();
      const dateKey = toDateKey(date);

      const [bookingResult, availabilityResult] = await Promise.all([
        supabase
          .from("bookings")
          .select("start_time, end_time, book_teacher")
          .eq("visit_date", dateKey)
          .eq("book_teacher", teacherName)
          .or("book_status.is.null,book_status.eq.pending,book_status.eq.approved")
          .order("start_time", { ascending: true }),
        supabase
          .from("teacher_availability")
          .select("slot_time")
          .eq("user_id", teacher.id)
          .eq("available_date", dateKey),
      ]);

      const normalized = (bookingResult.data ?? [])
        .map((item) => ({
          start: String(item.start_time).slice(0, 5),
          end: String(item.end_time).slice(0, 5),
        }))
        .filter((item) => item.start.length === 5 && item.end.length === 5);

      setBookedRanges(normalized);

      const customSlots = new Set(
        (availabilityResult.data ?? [])
          .map((row: any) => String(row.slot_time ?? "").slice(0, 5))
          .filter((s) => s.length === 5)
      );

      setTeacherAllowedSlots(customSlots.size > 0 ? customSlots : null);
    };

    void loadAvailability();
  }, [date, teacherName, teachers]);

  const dateKey = date ? toDateKey(date) : null
  const teacherParam = teacherName ? `&teacher=${encodeURIComponent(teacherName)}` : ""

  const isSlotBooked = (slotTime: string) => {
    const slotStart = toMinutes(slotTime)
    const slotEnd = slotStart + SLOT_STEP

    return bookedRanges.some((booked) =>
      rangesOverlap(slotStart, slotEnd, toMinutes(booked.start), toMinutes(booked.end))
    )
  }

  const isSlotAllowed = (slotTime: string) => {
    if (teacherAllowedSlots === null) return true;
    return teacherAllowedSlots.has(slotTime);
  }

  const availableSlots = TIME_SLOTS.filter((slot) => !isSlotBooked(slot) && isSlotAllowed(slot))

  const handleTimeClick = (slotTime: string) => {
    if (isSlotBooked(slotTime) || !isSlotAllowed(slotTime)) return

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
          <div className="grid gap-2">
            <FieldLabel htmlFor="teacher-select">{t.teacherLabel}</FieldLabel>
            <Select
              value={teacherName}
              onValueChange={(value) => setTeacherName(value ?? "")}
              disabled={teachersLoading}
            >
              <SelectTrigger id="teacher-select" className="w-full sm:w-72">
                <SelectValue
                  placeholder={teachersLoading ? t.teacherLoading : t.teacherPlaceholder}
                />
              </SelectTrigger>
              <SelectContent align="start">
                {teachers.length === 0 ? (
                  <SelectItem value="no-teachers" disabled>
                    {t.teacherEmpty}
                  </SelectItem>
                ) : (
                  teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.fullName}>
                      {teacher.fullName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

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
                fromDate={new Date()}
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
                  const notAllowed = !isSlotAllowed(slotTime)
                  const unavailable = booked || notAllowed
                  const isPendingStart = pendingStartTime === slotTime

                  const inConfirmed =
                    selectedRange !== null &&
                    toMinutes(slotTime) >= toMinutes(selectedRange.start) &&
                    toMinutes(slotTime) <= toMinutes(selectedRange.end)

                  return (
                    <button
                      key={slotTime}
                      type="button"
                      disabled={unavailable}
                      onClick={() => handleTimeClick(slotTime)}
                      className={[
                        "h-10 rounded-md border text-sm",
                        unavailable && "cursor-not-allowed border-muted bg-muted text-muted-foreground",
                        !unavailable && !isPendingStart && !inConfirmed && "border-input hover:bg-accent",
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

              {teacherName && teacherAllowedSlots !== null && teacherAllowedSlots.size === 0 && (
                <p className="text-sm text-destructive">This staff has no available slots on this date.</p>
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
                  ? `/${locale}/booking?date=${dateKey}&start=${selectedRange.start}&end=${selectedRange.end}${teacherParam}`
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
