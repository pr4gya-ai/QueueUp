import mongoose from "mongoose";
import { PLATFORM_IDS } from "./platforms.js";

const accountSchema = new mongoose.Schema({
    user: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
    platform: {type: String, enum: [...PLATFORM_IDS], required: true},
    handle: { type: String, required: true },
    zernioAccountId: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiresAt: { type: Date },
    status: { type: String, enum: ["connected", "disconnected"], default: "connected" },
    avatarUrl: { type: String },
}, {timestamps: true})

export const Account = mongoose.model("Account", accountSchema)