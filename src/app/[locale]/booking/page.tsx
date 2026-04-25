"use client"

import { translations, type Locale } from "@/lib/translations"
import { createClient } from "@/lib/client"
import { useParams } from "next/navigation"

import { useEffect, useMemo, useState } from "react"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

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

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd
}

const DIAL_CODES = ["+60"]
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))

function getHour(timeValue: string) {
  return timeValue.split(":")[0] ?? "00"
}

function getMinute(timeValue: string) {
  return timeValue.split(":")[1] ?? "00"
}

function toTimeValue(hour: string, minute: string) {
  return `${hour}:${minute}`
}

export default function BookingPage() {
  const supabase = useMemo(() => createClient(), [])
  const params = useParams<{ locale?: string }>()
  const localeParam = params?.locale
  const locale: Locale = localeParam === "my" ? "my" : "en"
  const t = translations[locale] ?? translations.en
  const {
    fName,
    pNumber,
    email,
    visitationReason,
    visitationReasonPlaceholder,
    date: dateLabel,
    time,
    plateNumber,
    timeSelectDateFirst,
    timeFromLabel,
    timeToLabel,
    timeInvalidRange,
    timeOverlapsBooking,
    timeBookedSlotsLabel,
    timeDoneButton,
  } = t

  const [date, setDate] = useState<Date | undefined>()
  const [dateOpen, setDateOpen] = useState(false)

  // Time range state
  const [timeRangeOpen, setTimeRangeOpen] = useState(false)
  const [timeFromDraft, setTimeFromDraft] = useState("10:30")
  const [timeToDraft, setTimeToDraft] = useState("11:30")
  const [confirmedTimeRange, setConfirmedTimeRange] = useState<{
    from: string
    to: string
  } | null>(null)
  const [hasCar, setHasCar] = useState(false)
  const [fullNameValue, setFullNameValue] = useState("")
  const [dialCodeValue, setDialCodeValue] = useState("+60")
  const [phoneNumberValue, setPhoneNumberValue] = useState("")
  const [emailValue, setEmailValue] = useState("")
  const [visitReasonValue, setVisitReasonValue] = useState("")
  const [plateNumberValue, setPlateNumberValue] = useState("")
  const [bookedSlotsForSelectedDate, setBookedSlotsForSelectedDate] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  useEffect(() => {
    const loadBookedSlots = async () => {
      if (!date) {
        setBookedSlotsForSelectedDate([])
        return
      }

      const dateKey = toDateKey(date)
      const { data, error } = await supabase
        .from("bookings")
        .select("start_time, end_time")
        .eq("visit_date", dateKey)
        .order("start_time", { ascending: true })

      if (error) {
        setBookedSlotsForSelectedDate([])
        return
      }

      const slots = (data ?? []).map((item) => {
        const start = String(item.start_time).slice(0, 5)
        const end = String(item.end_time).slice(0, 5)
        return `${start} - ${end}`
      })
      setBookedSlotsForSelectedDate(slots)
    }

    void loadBookedSlots()
  }, [date, supabase])

  const isDraftRangeValid = useMemo(() => {
    if (!timeFromDraft || !timeToDraft) return false
    return toMinutes(timeFromDraft) < toMinutes(timeToDraft)
  }, [timeFromDraft, timeToDraft])

  const isDraftRangeBooked = useMemo(() => {
    if (!date || !isDraftRangeValid) return false

    const draftStart = toMinutes(timeFromDraft)
    const draftEnd = toMinutes(timeToDraft)

    return bookedSlotsForSelectedDate.some((slot) => {
      const [slotStart, slotEnd] = slot.split(" - ")
      if (!slotStart || !slotEnd) return false

      return rangesOverlap(
        draftStart,
        draftEnd,
        toMinutes(slotStart),
        toMinutes(slotEnd)
      )
    })
  }, [date, isDraftRangeValid, timeFromDraft, timeToDraft, bookedSlotsForSelectedDate])

  const canConfirmDraftRange = !!date && isDraftRangeValid && !isDraftRangeBooked

  const timeLabel = confirmedTimeRange
    ? `${confirmedTimeRange.from} - ${confirmedTimeRange.to}`
    : time

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(null)

    if (!fullNameValue.trim() || !phoneNumberValue.trim() || !visitReasonValue.trim()) {
      setSubmitError("Please fill in all required fields.")
      return
    }

    if (!date || !confirmedTimeRange) {
      setSubmitError("Please select date and confirm your time range.")
      return
    }

    if (hasCar && !plateNumberValue.trim()) {
      setSubmitError("Please enter your plate number.")
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase.from("bookings").insert({
      full_name: fullNameValue.trim(),
      dial_code: dialCodeValue,
      phone_number: phoneNumberValue.trim(),
      email: emailValue.trim() || null,
      visit_reason: visitReasonValue.trim(),
      visit_date: toDateKey(date),
      start_time: confirmedTimeRange.from,
      end_time: confirmedTimeRange.to,
      plate_number: hasCar ? plateNumberValue.trim() : null,
    })

    if (error) {
      setSubmitError(error.message)
      setIsSubmitting(false)
      return
    }

    setSubmitSuccess("Booking submitted successfully.")
    setIsSubmitting(false)
    setConfirmedTimeRange(null)

    const dateKey = toDateKey(date)
    const { data } = await supabase
      .from("bookings")
      .select("start_time, end_time")
      .eq("visit_date", dateKey)
      .order("start_time", { ascending: true })

    const slots = (data ?? []).map((item) => {
      const start = String(item.start_time).slice(0, 5)
      const end = String(item.end_time).slice(0, 5)
      return `${start} - ${end}`
    })
    setBookedSlotsForSelectedDate(slots)
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex w-full max-w-xl flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <form className="w-full max-w-lg" onSubmit={handleSubmit}>
          <Field className="w-full max-w-lg">
            <FieldLabel htmlFor="fullname">{fName}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="fullname"
                placeholder={fName}
                value={fullNameValue}
                onChange={(e) => setFullNameValue(e.target.value)}
                required
              />
              <InputGroupAddon align="inline-start"></InputGroupAddon>
            </InputGroup>

            <FieldLabel htmlFor="phonenumber">{pNumber}</FieldLabel>
            <div className="flex gap-2">
              <select
                id="dial-code"
                aria-label="Dial code"
                value={dialCodeValue}
                onChange={(e) => setDialCodeValue(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {DIAL_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>

              <InputGroup>
                <InputGroupInput
                  id="phonenumber"
                  placeholder={pNumber}
                  type="tel"
                  value={phoneNumberValue}
                  onChange={(e) => setPhoneNumberValue(e.target.value)}
                  required
                />
                <InputGroupAddon align="inline-start"></InputGroupAddon>
              </InputGroup>
            </div>

            <FieldLabel htmlFor="email-address">{email}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="email-address"
                type="email"
                placeholder={email}
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
              />
              <InputGroupAddon align="inline-start"></InputGroupAddon>
            </InputGroup>

            <FieldLabel htmlFor="visitationReason">{visitationReason}</FieldLabel>
            <Textarea
              id="visitationReason"
              placeholder={visitationReasonPlaceholder}
              rows={4}
              value={visitReasonValue}
              onChange={(e) => setVisitReasonValue(e.target.value)}
            />

            {/* Date picker */}
            <FieldLabel htmlFor="date-picker-optional">{dateLabel}</FieldLabel>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    id="date-picker-optional"
                    className="w-32 justify-between font-normal"
                  >
                    {date ? format(date, "PPP") : dateLabel}
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
                  onSelect={(d) => {
                    setDate(d)
                    setConfirmedTimeRange(null)
                    setDateOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>

            {/* Time range picker */}
            <FieldLabel htmlFor="time-picker-range">{time}</FieldLabel>
            <Popover open={timeRangeOpen} onOpenChange={setTimeRangeOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    id="time-picker-range"
                    className="w-32 justify-between font-normal"
                  >
                    <span className="truncate">{timeLabel}</span>
                    <ChevronDownIcon data-icon="inline-end" />
                  </Button>
                }
              />
              <PopoverContent className="w-72" align="start">
                <div className="grid gap-3">
                  {!date && (
                    <p className="text-sm text-muted-foreground">
                      {timeSelectDateFirst}
                    </p>
                  )}

                  {date && (
                    <>
                      <div className="grid gap-1.5">
                        <FieldLabel htmlFor="time-from">{timeFromLabel}</FieldLabel>
                        <div className="flex items-center gap-2">
                          <select
                            id="time-from-hour"
                            value={getHour(timeFromDraft)}
                            onChange={(e) =>
                              setTimeFromDraft(toTimeValue(e.target.value, getMinute(timeFromDraft)))
                            }
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {HOUR_OPTIONS.map((hour) => (
                              <option key={hour} value={hour}>
                                {hour}
                              </option>
                            ))}
                          </select>

                          <span className="text-sm text-muted-foreground">:</span>

                          <select
                            id="time-from-minute"
                            value={getMinute(timeFromDraft)}
                            onChange={(e) =>
                              setTimeFromDraft(toTimeValue(getHour(timeFromDraft), e.target.value))
                            }
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {MINUTE_OPTIONS.map((minute) => (
                              <option key={minute} value={minute}>
                                {minute}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-1.5">
                        <FieldLabel htmlFor="time-to">{timeToLabel}</FieldLabel>
                        <div className="flex items-center gap-2">
                          <select
                            id="time-to-hour"
                            value={getHour(timeToDraft)}
                            onChange={(e) =>
                              setTimeToDraft(toTimeValue(e.target.value, getMinute(timeToDraft)))
                            }
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {HOUR_OPTIONS.map((hour) => (
                              <option key={hour} value={hour}>
                                {hour}
                              </option>
                            ))}
                          </select>

                          <span className="text-sm text-muted-foreground">:</span>

                          <select
                            id="time-to-minute"
                            value={getMinute(timeToDraft)}
                            onChange={(e) =>
                              setTimeToDraft(toTimeValue(getHour(timeToDraft), e.target.value))
                            }
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {MINUTE_OPTIONS.map((minute) => (
                              <option key={minute} value={minute}>
                                {minute}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {!isDraftRangeValid && (
                        <p className="text-sm text-destructive">{timeInvalidRange}</p>
                      )}

                      {isDraftRangeBooked && (
                        <p className="text-sm text-destructive">
                          {timeOverlapsBooking}
                        </p>
                      )}

                      {bookedSlotsForSelectedDate.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {timeBookedSlotsLabel}: {bookedSlotsForSelectedDate.join(", ")}
                        </p>
                      )}

                    </>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (canConfirmDraftRange) {
                          setConfirmedTimeRange({ from: timeFromDraft, to: timeToDraft })
                          setTimeRangeOpen(false)
                        }
                      }}
                      disabled={!canConfirmDraftRange}
                    >
                      {timeDoneButton}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <FieldGroup className="mx-auto w-56">
                <Field orientation="horizontal">
                    <Checkbox
                      id="carInCheckbox"
                      name="carInCheckbox"
                      checked={hasCar}
                      onCheckedChange={(checked) => setHasCar(checked === true)}
                    />
                    <FieldLabel htmlFor="carInCheckbox">
                        {t.carPlateCheckBoxLabel}
                    </FieldLabel>
                </Field>
            </FieldGroup>

          {hasCar && (
            <>
              <FieldLabel htmlFor="plate-number">{plateNumber}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="plate-number"
                  placeholder={plateNumber}
                  value={plateNumberValue}
                  onChange={(e) => setPlateNumberValue(e.target.value)}
                  required
                />
                <InputGroupAddon align="inline-start"></InputGroupAddon>
              </InputGroup>
            </>
          )}

          {submitError && <p className="mt-3 text-sm text-destructive">{submitError}</p>}
          {submitSuccess && (
            <p className="mt-3 text-sm text-emerald-600">{submitSuccess}</p>
          )}

          <Button variant="outline" type="submit" className="mt-4" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Booking"}
          </Button>
          </Field>
        </form>
      </main>
    </div>
  )
}