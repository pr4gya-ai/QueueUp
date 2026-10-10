import { Response } from "express";
import zernio from "../config/zernio.js";
import { User } from "../models/User.js";
import { Account } from "../models/Account.js";
import { AuthRequest } from "../middlewares/authMiddleware.js";


// Helper to ensure each user has their own Zernio profile.
const getOrCreateZernioProfile = async (user: any): Promise<string> => {
    try {
        // reuse the profile already linked to this user
        if (user.zernioProfileId) {
            return user.zernioProfileId;
        }

        const createResult = await zernio.profiles.createProfile({
            body: { name: `${user.name || user.email}'s workspace` } as any,
        });
        const created = (createResult.data as any)?.profile || createResult.data;
        const pid = created?._id || created?.id;

        if (!pid) {
            throw new Error("Failed to create Zernio profile - no ID returned");
        }

        await User.findByIdAndUpdate(user._id, { zernioProfileId: pid });
        return pid;
    } catch (error: any) {
        console.error("getOrCreateZernioProfile Error:", error?.message || error);
        throw error;
    }
};

// Platforms the UI offers and that sync knows how to normalise
const SUPPORTED_PLATFORMS = ["twitter", "linkedin", "facebook", "instagram"];

// Generate OAuth authorization URL
// GET /api/oauth/:platform/url
export const generateAuthUrl = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const platform = String(req.params.platform);
        if (!SUPPORTED_PLATFORMS.includes(platform)) {
            res.status(400).json({ message: `Unsupported platform. Use one of: ${SUPPORTED_PLATFORMS.join(", ")}` });
            return;
        }
        const profileId = await getOrCreateZernioProfile(req.user);

        // must be an absolute URL; prefer a configured client URL over the request header
        const clientUrl = process.env.CLIENT_URL || req.headers.origin || "http://localhost:5173";
        const redirectUrl = `${clientUrl}/accounts`;

        const result = await zernio.connect.getConnectUrl({
            path: { platform: platform as any },
            query: {
                profileId,
                redirect_url: redirectUrl,
            },
        });

        const data = result.data as any;
        const authUrl = data?.authUrl;

        if (!authUrl) {
            throw new Error(`Zernio returned no authUrl. Full response: ${JSON.stringify(data)}`);
        }

        res.json({ url: authUrl });
    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" });
    }
};

// Sync accounts from Zernio into our database
// GET /api/oauth/sync
export const syncAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const profileId = await getOrCreateZernioProfile(req.user);
        const result = await zernio.accounts.listAccounts({
            query: { profileId } as any,
        });

        const data = result.data as any;
        const zernioAccounts: any[] = data?.accounts || (Array.isArray(data) ? data : []);
        const syncedAccounts = [];

        for (const zAccount of zernioAccounts) {
            const zid = zAccount._id || zAccount.id;
            if (!zid) {
                console.warn("Skipping account with no ID:", zAccount);
                continue;
            }

            const rawPlatform = (zAccount.platform || zAccount.type || "").toLowerCase();
            const normalizedPlatform = SUPPORTED_PLATFORMS.find((p) => rawPlatform.includes(p));

            if (!normalizedPlatform) {
                console.log(`Skipping unsupported platform: "${rawPlatform}"`);
                continue;
            }

            const account = await Account.findOneAndUpdate(
                { user: req.user._id, zernioAccountId: zid },
                {
                    platform: normalizedPlatform,
                    handle: zAccount.username || zAccount.name || zAccount.handle || "Unknown",
                    zernioAccountId: zid,
                    status: "connected",
                    avatarUrl: zAccount.avatarUrl || zAccount.picture || zAccount.profile_image_url,
                },
                { upsert: true, returnDocument: "after" }
            );
            syncedAccounts.push(account);
        }

        res.json(syncedAccounts);
    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" });
    }
};