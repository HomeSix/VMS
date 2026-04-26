"use client"

import Link from "next/link"
import { useState } from "react"
import { useParams, useSearchParams } from "next/navigation"

import { translations, type Locale } from "@/lib/translations"
import { createClient } from "@/lib/client"

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"

function isDateKey(value: string | null) {
  if (!value) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isTimeValue(value: string | null) {
  if (!value) return false
  return /^\d{2}:\d{2}$/.test(value)
}

function toMinutes(timeValue: string) {
  const [hours, minutes] = timeValue.split(":").map(Number)
  return hours * 60 + minutes
}

function formatDateForDisplay(dateKey: string, locale: Locale) {
  const [year, month, day] = dateKey.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat(locale === "my" ? "ms-MY" : "en-MY", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

const DIAL_CODES = ["+60"]

export default function BookingPage() {
  const params = useParams<{ locale?: string }>()
  const searchParams = useSearchParams()

  const localeParam = params?.locale
  const locale: Locale = localeParam === "my" ? "my" : "en"
  const t = translations[locale] ?? translations.en

  const selectedDate = searchParams.get("date")
  const selectedStartTime = searchParams.get("start")
  const selectedEndTime = searchParams.get("end")

  const hasValidSchedule =
    selectedDate !== null &&
    selectedStartTime !== null &&
    selectedEndTime !== null &&
    isDateKey(selectedDate) &&
    isTimeValue(selectedStartTime) &&
    isTimeValue(selectedEndTime) &&
    toMinutes(selectedStartTime) < toMinutes(selectedEndTime)

  const scheduleHref = `/${locale}/booking/schedule${
    hasValidSchedule && selectedDate && selectedStartTime && selectedEndTime
      ? `?date=${selectedDate}&start=${selectedStartTime}&end=${selectedEndTime}`
      : ""
  }`

  const [hasCar, setHasCar] = useState(false)
  const [fullNameValue, setFullNameValue] = useState("")
  const [dialCodeValue, setDialCodeValue] = useState("+60")
  const [phoneNumberValue, setPhoneNumberValue] = useState("")
  const [emailValue, setEmailValue] = useState("")
  const [visitReasonValue, setVisitReasonValue] = useState("")
  const [plateNumberValue, setPlateNumberValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(null)

    if (!fullNameValue.trim() || !phoneNumberValue.trim() || !visitReasonValue.trim()) {
      setSubmitError("Please fill in all required fields.")
      return
    }

    if (!hasValidSchedule || !selectedDate || !selectedStartTime || !selectedEndTime) {
      setSubmitError(t.bookingPickScheduleFirst)
      return
    }

    if (hasCar && !plateNumberValue.trim()) {
      setSubmitError("Please enter your plate number.")
      return
    }

    setIsSubmitting(true)

    const supabase = createClient()

    const { error } = await supabase.from("bookings").insert({
      full_name: fullNameValue.trim(),
      dial_code: dialCodeValue,
      phone_number: phoneNumberValue.trim(),
      email: emailValue.trim() || null,
      visit_reason: visitReasonValue.trim(),
      visit_date: selectedDate,
      start_time: selectedStartTime,
      end_time: selectedEndTime,
      plate_number: hasCar ? plateNumberValue.trim() : null,
    })

    if (error) {
      setSubmitError(error.message)
      setIsSubmitting(false)
      return
    }

    setSubmitSuccess("Booking submitted successfully.")
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[#f7f5f1] px-4 py-10 sm:px-6">
      <main className="mx-auto w-full max-w-2xl">
        <Card className="border border-black/10 bg-white shadow-sm">
          <CardContent className="pt-6">
            <form className="w-full" onSubmit={handleSubmit}>
              <Field className="w-full">
            <Link href={`/${locale}`} className="mb-2 inline-block">
              <Button type="button" variant="ghost">Back</Button>
            </Link>

            <div className="mb-4 rounded-md border border-input p-3 text-sm">
              {hasValidSchedule && selectedDate && selectedStartTime && selectedEndTime ? (
                <div className="grid gap-2">
                  <p>
                    <span className="font-medium">{t.date}: </span>
                    {formatDateForDisplay(selectedDate, locale)}
                  </p>
                  <p>
                    <span className="font-medium">{t.time}: </span>
                    {selectedStartTime} - {selectedEndTime}
                  </p>
                </div>
              ) : (
                <p className="text-destructive">{t.bookingPickScheduleFirst}</p>
              )}

              <Link
                href={`/${locale}`}
                className="mt-3 inline-block"
              >
                <Button type="button" variant="secondary">
                  {t.bookingChangeScheduleButton}
                </Button>
              </Link>
            </div>

            <FieldLabel htmlFor="fullname">{t.fName}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="fullname"
                placeholder={t.fName}
                value={fullNameValue}
                onChange={(e) => setFullNameValue(e.target.value)}
                required
              />
              <InputGroupAddon align="inline-start"></InputGroupAddon>
            </InputGroup>

            <FieldLabel htmlFor="phonenumber">{t.pNumber}</FieldLabel>
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
                  placeholder={t.pNumber}
                  type="tel"
                  value={phoneNumberValue}
                  onChange={(e) => setPhoneNumberValue(e.target.value)}
                  required
                />
                <InputGroupAddon align="inline-start"></InputGroupAddon>
              </InputGroup>
            </div>

            <FieldLabel htmlFor="email-address">{t.email}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="email-address"
                type="email"
                placeholder={t.email}
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
              />
              <InputGroupAddon align="inline-start"></InputGroupAddon>
            </InputGroup>

            <FieldLabel htmlFor="visitationReason">{t.visitationReason}</FieldLabel>
            <Textarea
              id="visitationReason"
              placeholder={t.visitationReasonPlaceholder}
              rows={4}
              value={visitReasonValue}
              onChange={(e) => setVisitReasonValue(e.target.value)}
            />

            <FieldGroup className="mx-auto w-56">
              <Field orientation="horizontal">
                <Checkbox
                  id="carInCheckbox"
                  name="carInCheckbox"
                  checked={hasCar}
                  onCheckedChange={(checked) => setHasCar(checked === true)}
                />
                <FieldLabel htmlFor="carInCheckbox">{t.carPlateCheckBoxLabel}</FieldLabel>
              </Field>
            </FieldGroup>

            {hasCar && (
              <>
                <FieldLabel htmlFor="plate-number">{t.plateNumber}</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="plate-number"
                    placeholder={t.plateNumber}
                    value={plateNumberValue}
                    onChange={(e) => setPlateNumberValue(e.target.value)}
                    required
                  />
                  <InputGroupAddon align="inline-start"></InputGroupAddon>
                </InputGroup>
              </>
            )}

            {submitError && <p className="mt-3 text-sm text-destructive">{submitError}</p>}
            {submitSuccess && <p className="mt-3 text-sm text-emerald-600">{submitSuccess}</p>}

            <Button variant="outline" type="submit" className="mt-4 w-full" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Booking"}
            </Button>
              </Field>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
