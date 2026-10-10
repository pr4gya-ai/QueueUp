import { Response } from "express";
import { AuthRequest } from "../middlewares/authMiddleware.js";
import { GoogleGenAI } from "@google/genai";
import { InferenceClient } from "@huggingface/inference";
import sharp from "sharp";
import { cloudinary } from "../config/cloudinary.js";
import { Generation } from "../models/Generation.js";
import { Post } from "../models/Post.js";
import { PLATFORM_IDS, isPlatformId, type PlatformId } from "../models/platforms.js";

// Override with GEMINI_MODEL if Google retires or restricts this one.
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

// Max caption length per platform. Anything not listed falls back to the Facebook limit.
const CHAR_LIMITS: Record<string, number> = {
    twitter: 280,
    instagram: 2200,
    instagram_business: 2200,
    linkedin: 3000,
    linkedin_page: 3000,
    facebook: 63206,
    facebook_page: 63206,
};

export const generatePost = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { prompt, tone, generateImage } = req.body ?? {};

        if (typeof prompt !== "string" || !prompt.trim()) {
            res.status(400).json({ message: "A prompt is required" });
            return;
        }
        if (prompt.length > 2000) {
            res.status(400).json({ message: "Prompt is too long (max 2000 characters)" });
            return;
        }
        const safeTone = typeof tone === "string" && tone.trim() ? tone.trim().slice(0, 50) : "Professional";

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            res.status(400).json({ message: "Gemini API Key is missing. Please add GEMINI_API_KEY to your backend/.env file." })
            return;
        }

        const ai = new GoogleGenAI({ apiKey });

        // generate texts
        const textResponse = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
            contents: `Generate a social media post based on this prompt: "${prompt}"!
            Tone: ${safeTone}.
            Include relevant hashtags.
            Format the response as JSON with "content" and "imagePrompt" fields.
            The "imagePrompt" should be a highly descriptive prompt for an image generator that complements the post`,
            config: { responseMimeType: "application/json" },
        });

        const rawText = textResponse.text || "";
        let content = rawText;
        let imagePrompt: string = prompt;

        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[0]);
                if (typeof data.content === "string" && data.content.trim()) content = data.content.trim();
                if (typeof data.imagePrompt === "string" && data.imagePrompt.trim()) imagePrompt = data.imagePrompt.trim();
            } catch {
                // not valid JSON, fall back to the raw text above
            }
        }

        if (!content.trim()) {
            res.status(502).json({ message: "The AI returned an empty response. Please try again." });
            return;
        }

        let mediaUrl = "";
        let imageFailed = false;
        if (generateImage) {
            try {
                const huggingFaceKey = process.env.HUGGINGFACE_API_KEY;
                if (!huggingFaceKey) {
                    throw new Error("HUGGINGFACE_API_KEY is not set");
                }
                const hfClient = new InferenceClient(huggingFaceKey);

                const imageBlob = await hfClient.textToImage(
                    {
                        provider: "fal-ai",
                        model: "black-forest-labs/FLUX.1-dev",
                        inputs: imagePrompt,
                    },
                    { outputType: "blob" }
                );

                const arrayBuffer = await imageBlob.arrayBuffer();
                const rawBuffer = Buffer.from(arrayBuffer);

                const resizedBuffer = await sharp(rawBuffer)
                    .resize(1024, 1024, { fit: "cover" })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                const base64Image = resizedBuffer.toString("base64");
                const dataUri = `data:image/jpeg;base64,${base64Image}`;

                // upload to cloudinary for persistence
                const uploadResult = await cloudinary.uploader.upload(dataUri, {
                    folder: "ai-generations",
                });

                mediaUrl = uploadResult.secure_url;
            } catch (error: any) {
                // the text is still useful, so don't fail the whole request, but tell the client
                console.error("Image generation failed:", error?.message || error);
                imageFailed = true;
            }
        }

        // save generation to DB
        const generation = await Generation.create({
            user: req.user._id,
            prompt,
            content,
            mediaUrl,
            mediaType: mediaUrl ? "image" : undefined,
            tone: safeTone,
        });

        res.status(200).json({ ...generation.toObject(), imageGenerationFailed: imageFailed });
    }
    catch (error: any) {
        console.error("generatePost error:", error);
        res.status(500).json({
            message: error?.message ? `Failed to generate post: ${error.message}` : "Failed to generate post",
        });
    }
}

export const getGenerations = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const generation = await Generation.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50)
        res.json(generation)
    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" })
    }
}

export const getPosts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const posts = await Post.find({ user: req.user._id }).sort({ scheduledFor: -1 })
        res.json(posts);
    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" })
    }
}

export const schedulePost = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { content, platforms, scheduledFor, status } = req.body ?? {};

        if (typeof content !== "string" || !content.trim()) {
            res.status(400).json({ message: "Post content is required" });
            return;
        }

        // platforms arrives as a JSON string (or comma list) from FormData, or as an array from JSON
        let parsedPlatforms: unknown = platforms;
        if (typeof platforms === "string") {
            try {
                parsedPlatforms = JSON.parse(platforms);
            } catch {
                parsedPlatforms = platforms.split(",");
            }
        }
        const requested: string[] = Array.isArray(parsedPlatforms)
            ? [...new Set(parsedPlatforms.map((p) => String(p).trim()).filter(Boolean))]
            : [];

        const invalid = requested.filter((p) => !isPlatformId(p));
        if (invalid.length > 0) {
            res.status(400).json({ message: `Unknown platform: ${invalid.join(", ")}. Use: ${PLATFORM_IDS.join(", ")}` });
            return;
        }
        const platformList = requested as PlatformId[];

        // clients may only create drafts or scheduled posts; "published"/"failed" are set by the scheduler
        const postStatus = status === "draft" ? "draft" : "scheduled";
        if (postStatus === "scheduled" && platformList.length === 0) {
            res.status(400).json({ message: "Select at least one platform" });
            return;
        }

        const when = new Date(scheduledFor);
        if (!scheduledFor || Number.isNaN(when.getTime())) {
            res.status(400).json({ message: "A valid scheduled date and time is required" });
            return;
        }

        let mediaUrl: string | undefined;
        let mediaType: "image" | "video" | undefined;

        if (req.file) {
            const result = await new Promise<any>((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({
                    resource_type: "auto",
                    folder: "social-scheduler"
                }, (error, result) => {
                    if (error) reject(error);
                    else resolve(result)
                })
                stream.end(req.file!.buffer);
            })
            mediaUrl = result.secure_url;
            mediaType = result.resource_type === "video" ? "video" : "image";
        } else if (typeof req.body.mediaUrl === "string" && req.body.mediaUrl) {
            // reuse already-hosted media, e.g. an AI generated image
            if (!/^https?:\/\//.test(req.body.mediaUrl)) {
                res.status(400).json({ message: "mediaUrl must be an http(s) URL" });
                return;
            }
            mediaUrl = req.body.mediaUrl;
            mediaType = req.body.mediaType === "video" ? "video" : "image";
        }

        if (!mediaUrl && platformList.some((p) => p.startsWith("instagram"))) {
            res.status(400).json({ message: "Instagram requires an image or video" });
            return;
        }

        for (const p of platformList) {
            const limit = CHAR_LIMITS[p];
            if (limit && content.length > limit) {
                res.status(400).json({ message: `Content is ${content.length} characters; the ${p} limit is ${limit}` });
                return;
            }
        }

        const post = await Post.create({
            user: req.user._id,
            content,
            platforms: platformList,
            mediaUrl,
            mediaType,
            scheduledFor: when,
            status: postStatus,
        })
        res.status(201).json(post);

    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" })
    }
}
