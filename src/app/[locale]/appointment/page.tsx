import { translations, type Locale } from "@/lib/translations";

const dayKeys = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

const slots = [
	"08:00 - 09:00",
	"09:00 - 10:00",
	"10:00 - 11:00",
	"11:00 - 12:00",
	"12:00 - 13:00",
	"13:00 - 14:00",
	"14:00 - 15:00",
	"15:00 - 16:00",
];

// dummy data
const bookings: Record<string, string> = {
	"Monday-09:00 - 10:00": "John Tan",
	"Tuesday-10:00 - 11:00": "Siti Aisyah",
	"Wednesday-13:00 - 14:00": "Supplier Meeting",
	"Friday-14:00 - 15:00": "Audit Session",
};

export default async function AppointmentPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale: localeParam } = await params;
	const locale = (localeParam as Locale) || "en";
	const t = translations[locale];
	const days = t.appointmentDays;
	const slotLabels = t.appointmentTimeSlots;

	return (
		<div className="min-h-screen bg-[#f5f4f0] px-6 py-10">
			<div className="max-w-7xl mx-auto">

				{/* Header */}
				<div className="bg-[#111] text-white px-6 py-6 text-center">
					<h1 className="text-xl font-bold tracking-wide">
						{t.appointmentTitle}
					</h1>
					<p className="text-xs text-white/60 mt-1 uppercase tracking-widest">
						{t.appointmentSubtitle}
					</p>
				</div>

				{/* Table */}
				<div className="overflow-x-auto bg-white border border-[#e0ddd8]">
					<table className="w-full border-collapse">

						{/* Header row */}
						<thead>
							<tr>
								<th className="sticky left-0 bg-[#f0ede8] border p-3 text-xs uppercase tracking-wider">
									{t.appointmentDayLabel}
								</th>
								{slotLabels.map((slotLabel, index) => (
									<th
										key={slots[index]}
										className="border bg-[#f9f8f6] p-2 text-[10px] font-medium whitespace-nowrap"
									>
										{slotLabel}
									</th>
								))}
							</tr>
						</thead>

						{/* Body */}
						<tbody>
							{dayKeys.map((dayKey, index) => {
								const day = days[index];
								return (
									<tr key={dayKey} className="border-t">

										{/* Day */}
										<td className="sticky left-0 bg-white border p-3 font-semibold text-sm">
											{day}
										</td>

										{/* Slots */}
										{slots.map((slot) => {
											const key = `${dayKey}-${slot}`;
											const booking = bookings[key];
											return (
												<td
													key={key}
													className="border h-16 text-center align-middle"
												>
													{booking ? (
														<div className="bg-black text-white text-[10px] px-2 py-1 inline-block rounded">
															{booking}
														</div>
													) : (
														<div className="text-[10px] text-[#bbb]">
															{t.appointmentAvailable}
														</div>
													)}
												</td>
											);
										})}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				{/* Legend */}
				<div className="mt-4 text-xs text-[#666] flex gap-4">
					<span>⬛ {t.appointmentBooked}</span>
					<span>⬜ {t.appointmentAvailable}</span>
				</div>

			</div>
		</div>
	);
}