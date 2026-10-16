import "dotenv/config";
import express, { Request, Response, NextFunction } from 'express';
import cors from "cors";
import multer from "multer";
import connectDB from "./config/db.js";
import { MAX_UPLOAD_MB } from "./config/multer.js";
import authRouter from "./routes/authRoute.js";
import socialAuthRouter from "./routes/socialAuthRoute.js";
import accountRouter from "./routes/accountRoutes.js";
import postRoute from "./routes/postRoute.js";
import activityRouter from "./routes/activityRoute.js";
import { initScheduler } from "./services/schedulerService.js";
import { User } from "./models/User.js";

// Fail fast on config the app cannot run without, instead of crashing on the first request.
const missingEnv = ["MONGODB_URL", "JWT_SECRET"].filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnv.join(", ")}. See backend/.env.example.`);
  process.exit(1);
}

// Features degrade (with a clear error) rather than the server refusing to start.
const optionalEnv: Record<string, string> = {
  ZERNIO_API_KEY: "connecting accounts and publishing posts",
  GEMINI_API_KEY: "AI post generation",
  HUGGINGFACE_API_KEY: "AI image generation",
  CLOUDINARY_CLOUD_NAME: "media uploads",
  CLOUDINARY_API_KEY: "media uploads",
  CLOUDINARY_API_SECRET: "media uploads",
};
for (const [key, feature] of Object.entries(optionalEnv)) {
  if (!process.env[key]) console.warn(`Warning: ${key} is not set, ${feature} will not work.`);
}

const app = express();

// database connection
await connectDB();
await User.syncIndexes();


// Middleware
app.use(cors())
app.use(express.json());

const port = process.env.PORT || 3000;

app.get('/', (_req: Request, res: Response) => {
  res.send('Server is Live!');
});

app.use("/api/auth", authRouter);
app.use("/api/oauth", socialAuthRouter);
app.use('/api/accounts', accountRouter);
app.use('/api/post', postRoute);
app.use('/api/activity', activityRouter);

// Unknown API routes get JSON like every other error, so the client can show the message
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

initScheduler()

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    res.status(tooLarge ? 413 : 400).json({
      message: tooLarge ? `File is too large (max ${MAX_UPLOAD_MB} MB)` : err.message,
    });
    return;
  }

  const message =
    err?.response?.data?.message || err?.message || "Something went wrong";
  const status = Number(err?.response?.status || err?.statusCode || err?.status);
  res.status(status >= 400 && status < 600 ? status : 500).json({ message });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
