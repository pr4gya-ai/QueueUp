// backend/routes/postRoute.ts
import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
    generatePost,
    getGenerations,
    getPosts,
    schedulePost,
} from "../controllers/postController.js";
import { upload } from "../config/multer.js";

const postRouter = express.Router();

postRouter.post("/generate", protect, generatePost);
postRouter.get("/generations", protect, getGenerations);
postRouter.get("/", protect, getPosts);
postRouter.post("/schedule", protect,upload.single("media"), schedulePost);

export default postRouter;