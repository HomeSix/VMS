"use client"

import { translations, type Locale } from "@/lib/translations";
import { useParams } from "next/navigation"

import { useState } from "react"
import {
  Field,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function BookingPage() {
    const params = useParams<{ locale?: string }>()
    const localeParam = params?.locale
    const locale: Locale = localeParam === "my" ? "my" : "en"
    const t = translations[locale] ?? translations.en
    const { fName, pNumber, email, date: dateLabel, time, plateNumber } = t

    const [date, setDate] = useState<Date | undefined>()
    const [open, setOpen] = useState(false)

    return (
        <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
            
            <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
                <Field className="max-w-sm">
                    <FieldLabel htmlFor="fullname">{fName}</FieldLabel>
                    <InputGroup>
                        <InputGroupInput id="fullname" placeholder={fName} required />
                        <InputGroupAddon align="inline-start">
                        </InputGroupAddon>
                    </InputGroup>
                    <FieldLabel htmlFor="phonenumber">{pNumber}</FieldLabel>
                    <InputGroup>
                        <InputGroupInput id="phonenumber" placeholder={pNumber} required />
                        <InputGroupAddon align="inline-start">
                        </InputGroupAddon>
                    </InputGroup>
                    <FieldLabel htmlFor="email-address">{email}</FieldLabel>
                    <InputGroup>
                        <InputGroupInput id="email-address" placeholder={email} />
                        <InputGroupAddon align="inline-start">
                        </InputGroupAddon>
                    </InputGroup>
                    <FieldLabel htmlFor="date-picker-optional">{dateLabel}</FieldLabel>
                    <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger render={<Button variant="outline" id="date-picker-optional" className="w-32 justify-between font-normal">{date ? format(date, "PPP") : dateLabel}<ChevronDownIcon data-icon="inline-end" /></Button>} />
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                        <Calendar
                        mode="single"
                        selected={date}
                        captionLayout="dropdown"
                        defaultMonth={date}
                        onSelect={(date) => {
                            setDate(date)
                            setOpen(false)
                        }}
                        />
                    </PopoverContent>
                    </Popover>
                    <FieldLabel htmlFor="time-picker-optional">{time}</FieldLabel>
                        <Input
                        type="time"
                        id="time-picker-optional"
                        step="1"
                        defaultValue="10:30:00"
                        className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                        />
                    <FieldLabel htmlFor="plate-number">{plateNumber}</FieldLabel>
                    <InputGroup>
                        <InputGroupInput id="plate-number" placeholder={plateNumber} required />
                        <InputGroupAddon align="inline-start">
                        </InputGroupAddon>
                    </InputGroup>
                </Field>
            </main>
        </div>
    );
}