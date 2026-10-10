export interface User {
    _id: string;
    name: string;
    email: string;
}

export interface Account {
    _id: string;
    zernioAccountId?: string;
    handle: string;
    platform: string;
    status: "connected" | "disconnected";
    avatarUrl?: string;
    createdAt: string;
    updatedAt: string;
    user: string;
}

export type PostStatus = "draft" | "scheduled" | "published" | "failed";

export interface Post {
    _id: string;
    user: string;
    content: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
    platforms: string[];
    scheduledFor: string;
    status: PostStatus;
    failureReason?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Generation {
    _id: string;
    user: string;
    prompt: string;
    content: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
    tone?: string;
    createdAt: string;
    updatedAt: string;
    // only present on the response to a fresh generation
    imageGenerationFailed?: boolean;
}

export interface Activity {
    _id: string;
    actionType: "POST_PUBLISHED" | "AI_REPLY";
    description: string;
    relatedPost?: { _id: string; content: string } | null;
    createdAt: string;
}
