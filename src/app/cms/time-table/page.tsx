"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/client";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, Eye, Search } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

const OPEN_START = 8 * 60;
const OPEN_END = 16 * 60 + 30;
const SLOT_STEP = 30;
const PAGE_SIZE = 5;

type TeacherRecord = {
	id: string;
	fullName: string;
	roleName: string;
	isAvailable: boolean;
};

type BookingDetail = {
	id: number | null;
	full_name: string | null;
	phone_number: string | null;
	email: string | null;
	visit_reason: string | null;
	visit_date: string | null;
	start_time: string | null;
	end_time: string | null;
	plate_number: string | null;
	created_at: string | null;
	dial_code: string | null;
	book_teacher: string | null;
	status: boolean | null;
};

type SlotRenderItem =
	| { type: "hidden" }
	| { type: "booking"; booking: BookingDetail; colSpan: number }
	| { type: "free"; isAvailable: boolean; label: string; slotTime: string };

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

const formatDateForDisplay = (date: Date) =>
	new Intl.DateTimeFormat("en-MY", {
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

const BOOKING_COLORS = [
	"#1a237e",
	"#311b92",
	"#004d40",
	"#b71c1c",
	"#1b5e20",
	"#3e2723",
	"#4a148c",
	"#880e4f",
	"#006064",
	"#e65100",
];

const getBookingColor = (id: number | null) => {
	if (id === null) return "#000000";
	return BOOKING_COLORS[Number(id) % BOOKING_COLORS.length];
};

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
	startA < endB && startB < endA;

export default function TimeTablePage() {
	const supabase = useMemo(() => createClient(), []);

	const [dateOpen, setDateOpen] = useState(false);
	const [date, setDate] = useState<Date | undefined>(undefined);

	useEffect(() => {
		setDate(new Date());
	}, []);

	const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
	const [detailedBookings, setDetailedBookings] = useState(
		new Map<string, BookingDetail[]>()
	);
	const [availabilityByTeacher, setAvailabilityByTeacher] = useState(
		new Map<string, Set<string>>()
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const dateValue = date ? toDateKey(date) : "";

	const [lecturerFilter, setLecturerFilter] = useState("");
	const [timeStart, setTimeStart] = useState(TIME_SLOTS[0]);
	const [timeEnd, setTimeEnd] = useState(TIME_SLOTS[TIME_SLOTS.length - 1]);
	const [page, setPage] = useState(1);

	useEffect(() => {
		setPage(1);
	}, [lecturerFilter]);

	const timeStartIdx = TIME_SLOTS.indexOf(timeStart);
	const timeEndIdx = TIME_SLOTS.indexOf(timeEnd);
	const filteredTimeSlots = TIME_SLOTS.slice(
		timeStartIdx >= 0 ? timeStartIdx : 0,
		timeEndIdx >= 0 ? timeEndIdx + 1 : TIME_SLOTS.length
	);
	const filteredSlotLabels = SLOT_LABELS.slice(
		timeStartIdx >= 0 ? timeStartIdx : 0,
		timeEndIdx >= 0 ? timeEndIdx + 1 : SLOT_LABELS.length
	);

	const filteredTeachers = useMemo(() => {
		if (!lecturerFilter.trim()) return teachers;
		const q = lecturerFilter.toLowerCase();
		return teachers.filter((t) => t.fullName.toLowerCase().includes(q));
	}, [teachers, lecturerFilter]);

	const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const paginatedTeachers = filteredTeachers.slice(
		(safePage - 1) * PAGE_SIZE,
		safePage * PAGE_SIZE
	);

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
					.select("id, full_name, phone_number, email, visit_reason, visit_date, start_time, end_time, plate_number, created_at, dial_code, book_teacher, status")
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

			const bookingsMap = new Map<string, BookingDetail[]>();
			(bookingResult.data ?? []).forEach((row: BookingDetail) => {
				const teacherName = String(row.book_teacher ?? "").trim();
				if (!teacherName) return;
				const existing = bookingsMap.get(teacherName) ?? [];
				existing.push(row);
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
			setDetailedBookings(bookingsMap);
			setAvailabilityByTeacher(availabilityMap);
			setLoading(false);
		};

		void loadData();

		return () => {
			isMounted = false;
		};
	}, [dateValue, supabase]);

	const findBookingForSlot = (teacherName: string, slotTime: string): BookingDetail | undefined => {
		const teacherBookings = detailedBookings.get(teacherName) ?? [];
		const slotStart = toMinutes(slotTime);
		const slotEnd = slotStart + SLOT_STEP;
		return teacherBookings.find((b) =>
			rangesOverlap(slotStart, slotEnd, toMinutes(b.start_time ?? ""), toMinutes(b.end_time ?? ""))
		);
	};

	const computeTeacherSlots = (
		teacherName: string,
		hasCustomSlots: boolean,
		customSlots: Set<string> | undefined,
		allDayAvailable: boolean,
		timeSlots: string[]
	): SlotRenderItem[] => {
		const items: SlotRenderItem[] = [];
		let i = 0;
		while (i < timeSlots.length) {
			const slotTime = timeSlots[i];
			const booking = findBookingForSlot(teacherName, slotTime);
			if (booking) {
				let colSpan = 0;
				while (
					i + colSpan < timeSlots.length &&
					findBookingForSlot(teacherName, timeSlots[i + colSpan])?.id === booking.id
				) {
					colSpan++;
				}
				items.push({ type: "booking", booking, colSpan });
				i += colSpan;
			} else {
				const isAvailable = hasCustomSlots
					? customSlots?.has(slotTime) ?? false
					: allDayAvailable;
				items.push({ type: "free", isAvailable, label: "-", slotTime });
				i++;
			}
		}
		return items;
	};

	const headerColCount = filteredSlotLabels.length + 1;

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold tracking-tight">Time Table</h1>
				<div className="flex flex-wrap items-center gap-3">
					<div className="relative flex-1 min-w-[160px] max-w-[200px]">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
						<Input
							placeholder="Lecturer..."
							value={lecturerFilter}
							onChange={(e) => setLecturerFilter(e.target.value)}
							className="pl-8 h-9"
						/>
					</div>
					<div className="flex items-center gap-2">
						<FieldLabel htmlFor="appointment-date" className="text-xs whitespace-nowrap">
							Date
						</FieldLabel>
						<Popover open={dateOpen} onOpenChange={setDateOpen}>
							<PopoverTrigger
								render={
									<Button
										variant="outline"
										id="appointment-date"
										className="w-44 justify-between font-normal"
									>
										{date ? formatDateForDisplay(date) : "Select date"}
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
					<div className="flex items-center gap-2">
						<FieldLabel className="text-xs whitespace-nowrap">From:</FieldLabel>
							<Select
								value={timeStart}
								onValueChange={(v) => {
									if (v == null) return;       // guard null
									setTimeStart(v);
									setPage(1);
								}}
								>
							<SelectTrigger className="w-20">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TIME_SLOTS.map((slot) => (
									<SelectItem key={slot} value={slot}>{slot}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center gap-2">
						<FieldLabel className="text-xs whitespace-nowrap">To:</FieldLabel>
						<Select
							value={timeEnd}
							onValueChange={(v) => {
								if (v == null) return;
								setTimeEnd(v);
								setPage(1);
							}}
							>
							<SelectTrigger className="w-20">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TIME_SLOTS.map((slot) => (
									<SelectItem key={slot} value={slot}>{slot}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{filteredTeachers.length > 0 && (
						<span className="text-xs text-muted-foreground whitespace-nowrap">
							{filteredTeachers.length}
						</span>
					)}
				</div>
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
									Teacher
								</th>
								{filteredSlotLabels.map((slotLabel, index) => (
									<th
										key={filteredTimeSlots[index]}
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
										colSpan={headerColCount}
										className="p-6 text-center text-sm text-muted-foreground"
									>
										Loading schedule...
									</td>
								</tr>
							) : filteredTeachers.length === 0 ? (
								<tr>
									<td
										colSpan={headerColCount}
										className="p-6 text-center text-sm text-muted-foreground"
									>
										{lecturerFilter ? "No lecturers match your filter." : "No teachers found."}
									</td>
								</tr>
							) : (
								paginatedTeachers.map((teacher) => {
									const customSlots = availabilityByTeacher.get(teacher.id);
									const hasCustomSlots = (customSlots?.size ?? 0) > 0;
									const allDayAvailable = teacher.isAvailable && !hasCustomSlots;
									const slots = computeTeacherSlots(
										teacher.fullName,
										hasCustomSlots,
										customSlots,
										allDayAvailable,
										filteredTimeSlots
									);
									return (
										<tr key={teacher.id} className="border-t">
											<td className="sticky left-0 z-10 min-w-[180px] bg-background border-b border-r p-3 font-semibold text-sm whitespace-nowrap">
												{teacher.fullName}
											</td>
											{slots.map((item) => {
												if (item.type === "hidden") return null;

												const key =
													item.type === "booking"
														? `${teacher.id}-booking-${item.booking.id}`
														: `${teacher.id}-${item.slotTime}`;

												if (item.type === "booking") {
													const b = item.booking;
													const timeRange = `${b.start_time?.slice(0, 5) ?? ""} - ${b.end_time?.slice(0, 5) ?? ""}`;
													const bgColor = getBookingColor(b.id);
													return (
														<td
															key={key}
															colSpan={item.colSpan}
															className="border-b border-r text-white h-14"
															style={{ backgroundColor: bgColor }}
														>
															<div className="flex items-center justify-between gap-1 px-2 h-full">
																<div className="min-w-0 flex-1">
																	<div className="text-[11px] font-semibold leading-tight truncate">
																		{b.full_name}
																	</div>
																	<div className="text-[9px] text-white/60 leading-tight truncate">
																		{b.visit_reason || "No reason"}
																	</div>
																</div>
																<Dialog>
																	<DialogTrigger
																		render={
																			<Button
																				variant="ghost"
																				size="icon-sm"
																				className="shrink-0 text-white hover:text-white hover:bg-white/20"
																			/>
																		}
																	>
																		<Eye className="h-3.5 w-3.5" />
																	</DialogTrigger>
																	<DialogContent>
																		<DialogHeader>
																			<DialogTitle>Appointment Details</DialogTitle>
																			<DialogDescription>
																				{timeRange} &middot; {b.visit_date}
																			</DialogDescription>
																		</DialogHeader>
																		<div className="space-y-3 text-sm">
																			<div className="grid grid-cols-3 gap-1">
																				<span className="text-muted-foreground">Teacher:</span>
																				<span className="col-span-2 font-medium">{b.book_teacher}</span>
																			</div>
																			<div className="grid grid-cols-3 gap-1">
																				<span className="text-muted-foreground">Visitor:</span>
																				<span className="col-span-2 font-medium">{b.full_name}</span>
																			</div>
																			<div className="grid grid-cols-3 gap-1">
																				<span className="text-muted-foreground">Phone:</span>
																				<span className="col-span-2 font-medium">
																					{b.dial_code}{b.phone_number}
																				</span>
																			</div>
																			<div className="grid grid-cols-3 gap-1">
																				<span className="text-muted-foreground">Email:</span>
																				<span className="col-span-2 font-medium break-all">{b.email}</span>
																			</div>
																			<div className="grid grid-cols-3 gap-1">
																				<span className="text-muted-foreground">Reason:</span>
																				<span className="col-span-2">{b.visit_reason || "—"}</span>
																			</div>
																			<div className="grid grid-cols-3 gap-1">
																				<span className="text-muted-foreground">Plate No:</span>
																				<span className="col-span-2 font-medium">{b.plate_number || "—"}</span>
																			</div>
																			<div className="grid grid-cols-3 gap-1">
																				<span className="text-muted-foreground">Status:</span>
																				<span className="col-span-2 font-medium">
																					{b.status ? "Confirmed" : "Pending"}
																				</span>
																			</div>
																			<div className="grid grid-cols-3 gap-1">
																				<span className="text-muted-foreground">Booked at:</span>
																				<span className="col-span-2 font-medium">
																					{b.created_at
																						? new Date(b.created_at).toLocaleString("en-MY")
																						: "—"}
																				</span>
																			</div>
																		</div>
																	</DialogContent>
																</Dialog>
															</div>
														</td>
													);
												}

												const cellClass = item.isAvailable
													? "bg-emerald-50 text-emerald-700"
													: "bg-muted text-muted-foreground";
												return (
													<td
														key={key}
														className={`border-b border-r h-14 text-center align-middle text-[10px] ${cellClass}`}
													>
														{item.label}
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

			{!loading && filteredTeachers.length > PAGE_SIZE && (
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs text-muted-foreground">
						Page {safePage} of {totalPages}
					</span>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon-sm"
							disabled={safePage <= 1}
							onClick={() => setPage(safePage - 1)}
						>
							<ChevronLeftIcon className="h-4 w-4" />
						</Button>
						{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
							<Button
								key={p}
								variant={p === safePage ? "default" : "outline"}
								size="icon-sm"
								onClick={() => setPage(p)}
							>
								{p}
							</Button>
						))}
						<Button
							variant="outline"
							size="icon-sm"
							disabled={safePage >= totalPages}
							onClick={() => setPage(safePage + 1)}
						>
							<ChevronRightIcon className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
