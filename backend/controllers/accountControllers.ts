import { AuthRequest } from "../middlewares/authMiddleware.js";
import { Response } from "express";
import { Account } from "../models/Account.js";
import zernio from "../config/zernio.js";
import { PLATFORM_IDS, isPlatformId } from "../models/platforms.js";

// never send stored OAuth tokens to the browser
const PUBLIC_FIELDS = "-accessToken -refreshToken";

// get all accounts
export const getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const accounts = await Account.find({ user: req.user._id }).select(PUBLIC_FIELDS).sort({ createdAt: 1 })
        res.json(accounts);
    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" })
    }
}

//Add accounts:
export const addAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { platform, handle, avatarUrl } = req.body ?? {};

        if (!isPlatformId(platform)) {
            res.status(400).json({ message: `platform must be one of: ${PLATFORM_IDS.join(", ")}` });
            return;
        }
        if (typeof handle !== "string" || !handle.trim()) {
            res.status(400).json({ message: "handle is required" });
            return;
        }

        const account = await Account.create({
            user: req.user._id,
            platform,
            handle: handle.trim(),
            avatarUrl: typeof avatarUrl === "string" ? avatarUrl : undefined,
        })
        res.status(201).json(await Account.findById(account._id).select(PUBLIC_FIELDS));
    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" })
    }
}

//disconnect account
export const disconnectAccount = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const account = await Account.findOne({ _id: req.params.id, user: req.user._id })
        if (!account) {
            res.status(404).json({ message: "Account not found" });
            return;
        }

        if (account.zernioAccountId) {
            try {
                await zernio.accounts.deleteAccount({ path: { accountId: account.zernioAccountId } })
            } catch (error: any) {
                // a 404 means it is already gone on Zernio's side, so carry on and remove it locally
                if (error?.statusCode !== 404) {
                    res.status(500).json({ message: error?.message || "Failed to disconnect account" })
                    return
                }
            }
        }
        await account.deleteOne()
        res.json({ message: "Account disconnected successfully" })

    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" })
    }
}
