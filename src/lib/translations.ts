export const locales = ["en", "my"] as const;
export type Locale = (typeof locales)[number];

export const translations: Record<
	Locale,
	{
		// Booking Page
		fName: string;
		pNumber: string;
		email: string;
		date: string;
		time: string;
		plateNumber: string;

		// Home page
		title: string;
		intro: string;
		docsButton: string;
		learnButton: string;
		goToNext: string;
		editorHelp: string;

		// Landing page
		landingSystemTag: string;
		landingTitle: string;
		landingSubtitle: string;
		landingPrompt: string;
		landingCta: string;
		landingForm: string;
		landingCtaPlaceholder: string;
		landingFormPlaceholder: string;
		landingAppointment: string;
		landingAppointmentPlaceholder: string;
		landingBadgeSecure: string;
		landingBadgeLog: string;
		landingBadgeTracking: string;

		// Locale display
		localeLabelEn: string;
		localeNameEn: string;
		localeLabelMs: string;
		localeNameMs: string;

		// Appointment page
		appointmentTitle: string;
		appointmentSubtitle: string;
		appointmentDayLabel: string;
		appointmentTimeLabel: string;
		appointmentAvailable: string;
		appointmentBooked: string;
		appointmentDays: string[];
		appointmentTimeSlots: string[];
	}
> = {
	en: {
		// Booking page
		fName: "Full Name",
		pNumber: "Phone Number",
		email: "Email Address",
		date: "Date",
		time: "Time",
		plateNumber: "Plate Number",

		// Home page
		title: "Welcome",
		intro: "This site supports English and Malay. Choose your language below.",
		docsButton: "Read our docs",
		learnButton: "Learn",
		goToNext: "Go to nextjs.org →",
		editorHelp: "Get started by editing src/app/[locale]/page.tsx.",

		// Landing page
		landingSystemTag: "School Visitor Management",
		landingTitle: "Visitor Check-In",
		landingSubtitle: "All visitors must register upon entry",
		landingPrompt: "Choose your language / Pilih bahasa anda",
		landingCta: "Continue",
		landingForm: "Fill out the form",
		landingCtaPlaceholder: "Select a language to continue",
		landingFormPlaceholder: "Select a language to fill out the form",
		landingAppointment: "View Appointments",
		landingAppointmentPlaceholder: "Select a language to view appointments",
		landingBadgeSecure: "Secure",
		landingBadgeLog: "Sign-In Log",
		landingBadgeTracking: "Visitor Tracking",

		// Locale display
		localeLabelEn: "EN",
		localeNameEn: "English",
		localeLabelMs: "BM",
		localeNameMs: "Bahasa Melayu",

		// Appointment page
		appointmentTitle: "Appointment Schedule",
		appointmentSubtitle: "Weekly timetable view of all bookings",
		appointmentDayLabel: "Day",
		appointmentTimeLabel: "Time Slot",
		appointmentAvailable: "Available",
		appointmentBooked: "Booked",
		appointmentDays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
		appointmentTimeSlots: [
			"08:00 - 09:00",
			"09:00 - 10:00",
			"10:00 - 11:00",
			"11:00 - 12:00",
			"12:00 - 13:00",
			"13:00 - 14:00",
			"14:00 - 15:00",
			"15:00 - 16:00",
		],
	},
	my: {
		// Booking page
		fName: "Nama Penuh",
		pNumber: "Nombor Telefon",
		email: "Alamat Emel",
		date: "Tarikh",
		time: "Masa",
		plateNumber: "Nombor Plat",

		title: "Selamat Datang",
		intro: "Laman ini menyokong Bahasa Inggeris dan Bahasa Melayu. Pilih bahasa anda di bawah.",
		docsButton: "Baca dokumentasi kami",
		learnButton: "Belajar",
		goToNext: "Pergi ke nextjs.org →",
		editorHelp: "Mulakan dengan mengedit src/app/[locale]/page.tsx.",
		// Landing page
		landingSystemTag: "Sistem Pengurusan Pelawat Sekolah",
		landingTitle: "Daftar Masuk Pelawat",
		landingSubtitle: "Semua pelawat mesti mendaftar semasa masuk",
		landingPrompt: "Pilih bahasa anda / Choose your language",
		landingCta: "Teruskan",
		landingForm: "Isi borang",
		landingCtaPlaceholder: "Pilih bahasa untuk meneruskan",
		landingFormPlaceholder: "Pilih bahasa untuk mengisi borang",
		landingAppointment: "Lihat Janji Temu",
		landingAppointmentPlaceholder: "Pilih bahasa untuk melihat janji temu",
		landingBadgeSecure: "Selamat",
		landingBadgeLog: "Log Daftar Masuk",
		landingBadgeTracking: "Jejak Pelawat",
		// Locale display
		localeLabelEn: "EN",
		localeNameEn: "English",
		localeLabelMs: "BM",
		localeNameMs: "Bahasa Melayu",
		// Appointment page
		appointmentTitle: "Jadual Temu Janji",
		appointmentSubtitle: "Paparan mingguan semua tempahan",
		appointmentDayLabel: "Hari",
		appointmentTimeLabel: "Slot Masa",
		appointmentAvailable: "Tersedia",
		appointmentBooked: "Ditempah",
		appointmentDays: ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"],
		appointmentTimeSlots: [
			"08:00 - 09:00",
			"09:00 - 10:00",
			"10:00 - 11:00",
			"11:00 - 12:00",
			"12:00 - 13:00",
			"13:00 - 14:00",
			"14:00 - 15:00",
			"15:00 - 16:00",
		],
	},
};