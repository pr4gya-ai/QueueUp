import { Request, Response } from "express";

// Helper to ensure user has a Zernio Profile.


// Generate OAuth authorization URL
// GET /api/auth/:platform
export const generateAuthUrl = async (req: Request, res: Response) : Promise<void> => {
    try {
        const {platform} = req.params;

    } catch (error) {

    }
}