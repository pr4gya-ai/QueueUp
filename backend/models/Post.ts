import mongoose from "mongoose";
import { PLATFORM_IDS } from "./platforms.js";

const postSchema = new mongoose.Schema({
    user: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
    content: { type: String, required: true },
    mediaUrl: { type: String },
    mediaType: { type: String, enum: ["image", "video"] },
    platforms: [{ type: String, enum: [...PLATFORM_IDS] }],
    scheduledFor: { type: Date, required: true },
    status: { type: String, enum: ["draft", "scheduled", "published", "failed"], default: "scheduled" },
    // why the scheduler marked this post as failed (shown in the UI)
    failureReason: { type: String },
}, {timestamps: true})

// the scheduler polls for due posts every minute
postSchema.index({ status: 1, scheduledFor: 1 });
postSchema.index({ user: 1, scheduledFor: -1 });

export const Post = mongoose.model("Post", postSchema)
