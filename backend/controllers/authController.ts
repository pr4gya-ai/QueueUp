import { Request, Response } from "express";
import { User } from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const generateToken = (id: string) => {
  // JWT_SECRET is validated at startup (see server.ts), so there is no insecure fallback
  return jwt.sign({ id }, process.env.JWT_SECRET!, {
    expiresIn: "30d",
  });
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;
const MAX_PASSWORD = 72; // bcrypt ignores everything past 72 bytes

const normalizeEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

// Emails are stored lowercase, but accounts created before that change may still have
// mixed case, so look up case-insensitively.
const findByEmail = (email: string) =>
  User.findOne({ email }).collation({ locale: "en", strength: 2 });

// Register user
// POST /api/auth/register
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, password } = req.body ?? {};
    const email = normalizeEmail(req.body?.email);

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ message: "A valid email is required" });
      return;
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      res.status(400).json({ message: `Password must be ${MIN_PASSWORD}-${MAX_PASSWORD} characters` });
      return;
    }

    const userExists = await findByEmail(email);
    if (userExists) {
      res.status(400).json({ message: "User already exists" });
      return;
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await User.create({
      name: name.trim(),
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id.toString()),
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      // lost a race with a concurrent registration for the same email
      res.status(400).json({ message: "User already exists" });
      return;
    }
    console.error("registerUser error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Login user
// POST /api/auth/login
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!email || typeof password !== "string" || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await findByEmail(email);

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id.toString()),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error: any) {
    console.error("loginUser error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
