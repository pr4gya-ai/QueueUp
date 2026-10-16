// Single source of truth for the platform ids used by Account and Post documents
// and by request validation in the controllers.
export const PLATFORM_IDS = [
    "twitter",
    "linkedin",
    "facebook",
    "instagram",
    "facebook_page",
    "linkedin_page",
    "instagram_business",
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

export const isPlatformId = (value: unknown): value is PlatformId =>
    typeof value === "string" && (PLATFORM_IDS as readonly string[]).includes(value);
