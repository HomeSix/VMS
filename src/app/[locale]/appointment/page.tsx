"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/client";
import { translations, type Locale } from "@/lib/translations";
import { ChevronDownIcon } from "lucide-react";

const OPEN_START = 8 * 60;
const OPEN_END = 16 * 60 + 30;
const SLOT_STEP = 30;

type TeacherRecord = {
	id: string;
	fullName: string;
	roleName: string;
	isAvailable: boolean;
};

type BookingRange = {
	start: string;
	end: string;
};

const toMinutes = (value: string) => {
	const [hour, minute] = value.split(":").map(Number);
	return (hour || 0) * 60 + (minute || 0);
};

const toTime = (minutes: number) => {
	const hours = Math.floor(minutes / 60)
		.toString()
		.padStart(2, "0");
	const mins = Math.floor(minutes % 60)
		.toString()
		.padStart(2, "0");
	return `${hours}:${mins}`;
};

const toDateKey = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (date: Date, locale: Locale) =>
	new Intl.DateTimeFormat(locale === "my" ? "ms-MY" : "en-MY", {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(date);

const TIME_SLOTS = Array.from(
	{ length: Math.ceil((OPEN_END - OPEN_START) / SLOT_STEP) },
	(_, index) => toTime(OPEN_START + index * SLOT_STEP)
);

const SLOT_LABELS = TIME_SLOTS.map(
	(start) => `${start} - ${toTime(toMinutes(start) + SLOT_STEP)}`
);

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
	startA < endB && startB < endA;

export default function AppointmentPage() {
	const params = useParams<{ locale?: string }>();
	const localeParam = params?.locale;
	const locale: Locale = localeParam === "my" ? "my" : "en";
	const t = translations[locale] ?? translations.en;
	const supabase = useMemo(() => createClient(), []);

	const [dateOpen, setDateOpen] = useState(false);
	const [date, setDate] = useState<Date | undefined>(undefined);

	useEffect(() => {
		setDate(new Date());
	}, []);
	const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
	const [bookingsByTeacher, setBookingsByTeacher] = useState(
		new Map<string, BookingRange[]>()
	);
	const [availabilityByTeacher, setAvailabilityByTeacher] = useState(
		new Map<string, Set<string>>()
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const dateValue = date ? toDateKey(date) : "";

	useEffect(() => {
		let isMounted = true;

		const loadData = async () => {
			setLoading(true);
			setError(null);

			const { data: teacherRows, error: teacherError } = await supabase
				.from("system_user")
				.select("id, full_name, isAvailable, roles(name)")
				.order("full_name", { ascending: true });

			if (!isMounted) return;

			if (teacherError) {
				setError(teacherError.message);
				setTeachers([]);
				setLoading(false);
				return;
			}

			const normalizedTeachers = (teacherRows ?? [])
				.map((row: any) => {
					const roleName = Array.isArray(row.roles)
						? row.roles[0]?.name ?? ""
						: row.roles?.name ?? "";
					return {
						id: String(row.id),
						fullName: String(row.full_name ?? "").trim(),
						roleName: String(roleName ?? ""),
						isAvailable: Boolean(
							row.isAvailable ?? true
						),
					};
				})
				.filter((row) => row.fullName.length > 0)
				.filter((row) => {
					const role = row.roleName.toLowerCase();
					if (!role) return true;
					return role === "staff" || role === "teacher";
				});

			const [bookingResult, availabilityResult] = await Promise.all([
				supabase
					.from("bookings")
					.select("start_time, end_time, book_teacher")
					.eq("visit_date", dateValue)
					.order("start_time", { ascending: true }),
				supabase
					.from("teacher_availability")
					.select("user_id, slot_time")
					.eq("available_date", dateValue),
			]);

			if (!isMounted) return;

			if (bookingResult.error) {
				setError(bookingResult.error.message);
			}

			const bookingsMap = new Map<string, BookingRange[]>();
			(bookingResult.data ?? []).forEach((row: any) => {
				const teacherName = String(row.book_teacher ?? "").trim();
				const start = String(row.start_time ?? "").slice(0, 5);
				const end = String(row.end_time ?? "").slice(0, 5);
				if (!teacherName || start.length !== 5 || end.length !== 5) return;
				const existing = bookingsMap.get(teacherName) ?? [];
				existing.push({ start, end });
				bookingsMap.set(teacherName, existing);
			});

			const availabilityMap = new Map<string, Set<string>>();
			(availabilityResult.data ?? []).forEach((row: any) => {
				const userId = String(row.user_id ?? "");
				const slotTime = String(row.slot_time ?? "").slice(0, 5);
				if (!userId || slotTime.length !== 5) return;
				if (!availabilityMap.has(userId)) {
					availabilityMap.set(userId, new Set());
				}
				availabilityMap.get(userId)?.add(slotTime);
			});

			setTeachers(normalizedTeachers);
			setBookingsByTeacher(bookingsMap);
			setAvailabilityByTeacher(availabilityMap);
			setLoading(false);
		};

		void loadData();

		return () => {
			isMounted = false;
		};
	}, [dateValue, supabase]);

	const isSlotBooked = (teacherName: string, slotStart: string) => {
		const ranges = bookingsByTeacher.get(teacherName) ?? [];
		const slotStartMinutes = toMinutes(slotStart);
		const slotEndMinutes = slotStartMinutes + SLOT_STEP;
		return ranges.some((range) =>
			rangesOverlap(
				slotStartMinutes,
				slotEndMinutes,
				toMinutes(range.start),
				toMinutes(range.end)
			)
		);
	};

	return (
		<div className="min-h-screen bg-[#f5f4f0] px-6 py-10">
			<div className="max-w-7xl mx-auto space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<Link href={`/${locale}`}>
						<Button type="button" variant="secondary">Back</Button>
					</Link>
					<div className="flex flex-wrap items-center gap-2">
						<FieldLabel htmlFor="appointment-date" className="text-xs">
							{t.date}
						</FieldLabel>
						<Popover open={dateOpen} onOpenChange={setDateOpen}>
							<PopoverTrigger
								render={
									<Button
										variant="outline"
										id="appointment-date"
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
										setDateOpen(false)
									}}
								/>
							</PopoverContent>
						</Popover>
					</div>
				</div>

				<div className="bg-[#111] text-white px-6 py-6 text-center">
					<h1 className="text-xl font-bold tracking-wide">
						{t.appointmentTitle}
					</h1>
					<p className="text-xs text-white/60 mt-1 uppercase tracking-widest">
						{t.appointmentSubtitle}
					</p>
				</div>

				{error && (
					<div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
						{error}
					</div>
				)}

				<div className="overflow-hidden rounded-md border border-input bg-white shadow-sm">
					<div className="overflow-x-auto">
						<table className="w-full border-collapse text-xs">
						<thead>
							<tr>
								<th className="sticky left-0 z-10 min-w-[180px] bg-muted border-b border-r p-3 text-[11px] uppercase tracking-wider">
									{t.teacherLabel}
								</th>
								{SLOT_LABELS.map((slotLabel, index) => (
									<th
										key={TIME_SLOTS[index]}
										className="border-b border-r bg-muted/20 p-2 text-[10px] font-medium whitespace-nowrap"
									>
										{slotLabel}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td
										colSpan={SLOT_LABELS.length + 1}
										className="p-6 text-center text-sm text-muted-foreground"
									>
										Loading schedule...
									</td>
								</tr>
							) : teachers.length === 0 ? (
								<tr>
									<td
										colSpan={SLOT_LABELS.length + 1}
										className="p-6 text-center text-sm text-muted-foreground"
									>
										No teachers found.
									</td>
								</tr>
							) : (
								teachers.map((teacher) => {
									const customSlots = availabilityByTeacher.get(teacher.id);
									const hasCustomSlots = (customSlots?.size ?? 0) > 0;
									const allDayAvailable = teacher.isAvailable && !hasCustomSlots;
									return (
										<tr key={teacher.id} className="border-t">
											<td className="sticky left-0 z-10 min-w-[180px] bg-background border-b border-r p-3 font-semibold text-sm whitespace-nowrap">
												{teacher.fullName}
											</td>
											{TIME_SLOTS.map((slotTime) => {
												const isBooked = isSlotBooked(
													teacher.fullName,
													slotTime
												);
												const isAvailable = hasCustomSlots
													? customSlots?.has(slotTime) ?? false
													: allDayAvailable;
												const cellLabel = isBooked
													? t.appointmentBooked
													: isAvailable
														? t.appointmentAvailable
														: t.appointmentUnavailable;
												const cellClass = isBooked
													? "bg-black text-white"
													: isAvailable
														? "bg-emerald-50 text-emerald-700"
														: "bg-muted text-muted-foreground";
												return (
													<td
														key={`${teacher.id}-${slotTime}`}
														className={`border-b border-r h-14 text-center align-middle text-[10px] ${cellClass}`}
													>
														{cellLabel}
													</td>
												);
											})}
										</tr>
									);
								})
							)}
						</tbody>
									</table>
								</div>
				</div>

				{/* <div className="mt-4 text-xs text-[#666] flex flex-wrap gap-4">
					<span>{t.appointmentBooked}</span>
					<span>{t.appointmentAvailable}</span>
					<span>{t.appointmentUnavailable}</span>
				</div> */}
			</div>
		</div>
	);
}