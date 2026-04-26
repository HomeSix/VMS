"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/client";
import { locales, translations, type Locale } from "@/lib/translations";

// Remove this — generateStaticParams belongs in a Server Component, not a "use client" file
// export function generateStaticParams() { ... }

const DEFAULT_LOCALE: Locale = "en";

const LOCALE_META: Record<Locale, { label: string; name: string }> = {
    en: { label: "EN", name: "English" },
    my: { label: "BM", name: "Bahasa Melayu" },
};

export default function Page() {
    const router = useRouter();
    const [selected, setSelected] = useState<Locale | null>(null);

    const t = translations[selected ?? DEFAULT_LOCALE];

    const handleBooking = () => {
        if (!selected) return;
        router.push(`/${selected}/booking`);
    };

    const handleAppointment = () => {
        if (!selected) return;
        router.push(`/${selected}/appointment`);
    };

    const handleCms = async () => {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        router.push(data.session ? "/cms/dashboard" : "/auth/login");
    };

    const badges = [
        {
            key: "secure",
            label: t.landingBadgeSecure,
            icon: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
        },
        {
            key: "log",
            label: t.landingBadgeLog,
            icon: "M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z",
        },
        {
            key: "tracking",
            label: t.landingBadgeTracking,
            icon: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
        },
    ];

    return (
        <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-[#f5f4f0]">
            <div className="w-full max-w-[560px]">
                <div className="bg-white border border-[#e0ddd8] overflow-hidden">
                    <div
                        className="h-1"
                        style={{
                            background:
                                "repeating-linear-gradient(90deg, #111 0px, #111 12px, #fff 12px, #fff 16px)",
                        }}
                    />

                    <div className="bg-[#111] px-10 py-10 text-center">
                        <div className="inline-flex items-center justify-center mb-5">
                            <img
                                src="/lencana_sekolah.png"
                                alt="School badge"
                                className="w-[100px] h-auto object-contain"
                            />
                        </div>
                        <p className="text-[9px] font-medium tracking-[0.28em] uppercase text-white/45 mb-2">
                            {t.landingSystemTag}
                        </p>
                        <h1
                            className="text-2xl font-bold text-white tracking-wide leading-tight"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                            {t.landingTitle}
                        </h1>
                        <div className="w-8 h-px bg-white/20 mx-auto my-4" />
                        <p className="text-[10px] font-normal tracking-[0.2em] uppercase text-white/40">
                            SK SERI TELOK PARIT YAANI
                        </p>
                    </div>

                    <div className="px-10 py-10">
                        <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#aaa] text-center mb-5">
                            {t.landingPrompt}
                        </p>

                        <div className="grid grid-cols-2 gap-2.5 mb-7">
                            {locales.map((locale) => {
                                const isActive = selected === locale;
                                const meta = LOCALE_META[locale];
                                return (
                                    <button
                                        key={locale}
                                        onClick={() => setSelected(locale)}
                                        className={cn(
                                            "relative text-left px-4 py-5 border overflow-hidden transition-colors duration-200",
                                            isActive
                                                ? "border-[#111] bg-[#111]"
                                                : "border-[#ddd] bg-white hover:bg-[#111] hover:border-[#111] group"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "absolute top-2.5 right-2.5 w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors duration-200",
                                                isActive
                                                    ? "bg-white border-white"
                                                    : "bg-white border-[#ddd] group-hover:border-white/40"
                                            )}
                                        >
                                            <svg
                                                viewBox="0 0 10 8"
                                                className={cn(
                                                    "w-[9px] h-[9px] transition-opacity duration-200",
                                                    isActive ? "opacity-100" : "opacity-0"
                                                )}
                                            >
                                                <path d="M1 4l3 3 5-6" stroke="#111" strokeWidth="1.5" fill="none" />
                                            </svg>
                                        </span>
                                        <span
                                            className={cn(
                                                "block text-xl font-bold transition-colors duration-200",
                                                isActive ? "text-white" : "text-[#111] group-hover:text-white"
                                            )}
                                            style={{ fontFamily: "'Playfair Display', serif" }}
                                        >
                                            {meta.label}
                                        </span>
                                        <span
                                            className={cn(
                                                "block text-[10px] font-normal tracking-[0.12em] uppercase mt-1 transition-colors duration-200",
                                                isActive ? "text-white/50" : "text-[#999] group-hover:text-white/50"
                                            )}
                                        >
                                            {meta.name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="h-px bg-[#f0ede8]" />

                        <button
                            onClick={handleBooking}
                            disabled={!selected}
                            className={cn(
                                "w-full flex items-center justify-center gap-2.5 py-4 text-[10px] font-medium tracking-[0.24em] uppercase transition-colors duration-150",
                                selected
                                    ? "bg-[#111] text-white hover:bg-[#333] cursor-pointer"
                                    : "bg-[#f0ede8] text-[#bbb] cursor-not-allowed"
                            )}
                        >
                            <svg viewBox="0 0 24 24" className={cn("w-3 h-3 flex-shrink-0", selected ? "fill-white" : "fill-[#bbb]")}>
                                <path d="M12.089 3.634A2 2 0 0 0 11 5.414L10.999 8H6a1 1 0 0 0-1 1v6l.007.117A1 1 0 0 0 6 16l4.999-.001l.001 2.587A2 2 0 0 0 14.414 20L21 13.414a2 2 0 0 0 0-2.828L14.414 4a2 2 0 0 0-2.18-.434zM3 8a1 1 0 0 1 .993.883L4 9v6a1 1 0 0 1-1.993.117L2 15V9a1 1 0 0 1 1-1" />
                            </svg>
                            {selected ? t.landingForm : t.landingFormPlaceholder}
                        </button>

                        <div className="h-px bg-[#f0ede8] mb-3" />

                        <button
                            onClick={handleAppointment}
                            disabled={!selected}
                            className={cn(
                                "w-full flex items-center justify-center gap-2.5 py-4 text-[10px] font-medium tracking-[0.24em] uppercase transition-colors duration-150",
                                selected
                                    ? "bg-[#111] text-white hover:bg-[#333] cursor-pointer"
                                    : "bg-[#f0ede8] text-[#bbb] cursor-not-allowed"
                            )}
                        >
                            <svg viewBox="0 0 24 24" className={cn("w-3 h-3 flex-shrink-0", selected ? "fill-white" : "fill-[#bbb]")}>
                                <path d="M12.089 3.634A2 2 0 0 0 11 5.414L10.999 8H6a1 1 0 0 0-1 1v6l.007.117A1 1 0 0 0 6 16l4.999-.001l.001 2.587A2 2 0 0 0 14.414 20L21 13.414a2 2 0 0 0 0-2.828L14.414 4a2 2 0 0 0-2.18-.434zM3 8a1 1 0 0 1 .993.883L4 9v6a1 1 0 0 1-1.993.117L2 15V9a1 1 0 0 1 1-1" />
                            </svg>
                            {selected ? t.landingAppointment : t.landingAppointmentPlaceholder}
                        </button>

                        <div className="h-px bg-[#f0ede8] mb-6" />

                        <button
                            onClick={handleCms}
                            className="mx-auto block text-sm text-grey-600 hover:text-grey-800 hover:underline transition"
                            style={{ fontSize: 12, fontFamily: "'Inter', sans-serif" }}
                        >
                            Are you a staff?
                        </button>
                    </div>

                    <div className="px-10 pb-7 pt-0 flex items-center justify-center gap-2 border-t border-[#f0ede8]">
                        {badges.map((badge, i) => (
                            <React.Fragment key={badge.key}>
                                <span className="flex items-center gap-1">
                                    <svg viewBox="0 0 24 24" className="w-[9px] h-[9px] fill-[#bbb]">
                                        <path d={badge.icon} />
                                    </svg>
                                    <span className="text-[9px] font-normal tracking-[0.16em] uppercase text-[#bbb]">
                                        {badge.label}
                                    </span>
                                </span>
                                {i < badges.length - 1 && (
                                    <span className="w-[3px] h-[3px] rounded-full bg-[#ddd]" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');`}</style>
            </div>
        </div>
    );
}