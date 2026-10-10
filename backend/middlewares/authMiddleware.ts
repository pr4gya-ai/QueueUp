import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export interface AuthRequest extends Request {
    user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ message: "Not authorized, no token" });
        return;
    }

    let decoded: jwt.JwtPayload;
    try {
        decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET!) as jwt.JwtPayload;
    } catch {
        res.status(401).json({ message: "Not authorized, token failed" });
        return;
    }

    try {
        const user = await User.findById(decoded.id).select("-password");
        if (!user) {
            // valid token for an account that no longer exists
            res.status(401).json({ message: "Not authorized, user no longer exists" });
            return;
        }
        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};
