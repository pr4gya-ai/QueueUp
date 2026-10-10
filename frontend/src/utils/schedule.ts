// Helpers shared by the Scheduler and AI Composer scheduling forms.

export interface ScheduleValue {
    date: string; // yyyy-mm-dd, as produced by <input type="date">
    hour: string; // "01".."12"
    minute: string; // "00".."55"
    period: "AM" | "PM";
}

export const emptySchedule = (): ScheduleValue => ({
    date: "",
    hour: "12",
    minute: "00",
    period: "PM",
});

export const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
export const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

// Combines the form fields into a Date in the user's local timezone.
// 12 AM is midnight and 12 PM is noon, which is why the hour is taken modulo 12.
export const toScheduledDate = ({ date, hour, minute, period }: ScheduleValue): Date | null => {
    if (!date) return null;
    const hours24 = (Number(hour) % 12) + (period === "PM" ? 12 : 0);
    const result = new Date(`${date}T${String(hours24).padStart(2, "0")}:${minute}:00`);
    return Number.isNaN(result.getTime()) ? null : result;
};

// Mirrors the limits enforced by the backend.
const CHAR_LIMITS: Record<string, number> = {
    twitter: 280,
    instagram: 2200,
    linkedin: 3000,
    facebook: 63206,
};

// The strictest limit among the selected platforms, or null if none are selected.
export const getCharLimit = (platforms: string[]): number | null =>
    platforms.length === 0
        ? null
        : Math.min(...platforms.map((p) => CHAR_LIMITS[p] ?? CHAR_LIMITS.facebook));

export const formatDateTime = (iso: string): string =>
    new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
