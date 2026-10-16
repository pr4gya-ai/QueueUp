import { Response } from "express";
import { AuthRequest } from "../middlewares/authMiddleware.js";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { cloudinary } from "../config/cloudinary.js";
import { Generation } from "../models/Generation.js";
import { Post } from "../models/Post.js";
import { PLATFORM_IDS, isPlatformId, type PlatformId } from "../models/platforms.js";
 
// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
// Text model (captions)
// Google retires Gemini models regularly (and restricts older ones to existing projects),
// so captions try GEMINI_MODEL first and then fall through this list on "model not found".
const GEMINI_TEXT_MODEL_FALLBACKS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash"];
// Image models. NOTE: the text model above can NOT produce images.
const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const DEFAULT_HF_IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell";
const DEFAULT_CF_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
 
const IMAGE_SIZE = 1024;
const MIN_IMAGE_BYTES = 5 * 1024; // anything smaller is almost certainly an error payload
const MIN_IMAGE_DIMENSION = 256;
 
// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
 
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
 
// Keeps console output readable (Google error payloads are huge JSON blobs)
function shortError(err: any): string {
    return String(err?.message ?? err ?? "unknown error").replace(/\s+/g, " ").slice(0, 200);
}
 
function isQuotaError(err: any): boolean {
    const msg = String(err?.message ?? "");
    return err?.status === 429 || err?.code === 429 || /RESOURCE_EXHAUSTED|quota|daily free allocation/i.test(msg);
}
 
function isModelNotFoundError(err: any): boolean {
    const msg = String(err?.message ?? "");
    return err?.status === 404 || err?.code === 404 || /not found|is not supported/i.test(msg);
}
 
async function readImageResponse(res: Response | globalThis.Response, label: string): Promise<Buffer> {
    const response = res as globalThis.Response;
    if (!response.ok) {
        const body = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 150);
        const err: any = new Error(`${label} returned ${response.status}${body ? `: ${body}` : ""}`);
        err.status = response.status;
        throw err;
    }
    const type = response.headers.get("content-type") || "";
    if (!type.startsWith("image/")) {
        throw new Error(`${label} returned non-image content-type: ${type || "unknown"}`);
    }
    return Buffer.from(await response.arrayBuffer());
}
 
// Make sure the bytes are a real, decodable, reasonably sized image
async function validateImage(buffer: Buffer): Promise<void> {
    if (buffer.length < MIN_IMAGE_BYTES) {
        throw new Error("Image data is too small to be valid");
    }
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height || meta.width < MIN_IMAGE_DIMENSION || meta.height < MIN_IMAGE_DIMENSION) {
        throw new Error(`Image dimensions too small (${meta.width}x${meta.height})`);
    }
}
 
// ---------------------------------------------------------------------------
// Image prompt building
// ---------------------------------------------------------------------------
const TONE_STYLES: Record<string, string> = {
    professional: "clean, polished, corporate-friendly composition with a neutral, refined colour palette",
    creative: "imaginative, vibrant colours, artistic composition with a distinctive visual concept",
    funny: "playful, bright, whimsical styling with a lighthearted visual twist",
    minimalist: "minimalist composition, generous negative space, muted palette, a single clear subject",
    excited: "energetic, dynamic, saturated colours, bold and lively composition",
};
 
function getToneStyle(tone: string): string {
    const key = tone.toLowerCase();
    if (TONE_STYLES[key]) return TONE_STYLES[key];
    if (key.startsWith("minimal")) return TONE_STYLES.minimalist;
    return `${tone.toLowerCase()} mood, polished composition`;
}
 
// If Gemini didn't return an imagePrompt, derive one from the caption (NOT from the raw instruction)
function imagePromptFromContent(content: string): string {
    const text = content.replace(/#\w+/g, "").replace(/\s+/g, " ").trim().slice(0, 250);
    return `A visually appealing photograph that represents this idea: ${text}`;
}
 
function buildImagePrompts(imagePrompt: string, tone: string): { full: string; short: string } {
    const style = getToneStyle(tone);
    const suffix =
        `${style}. Photorealistic professional photography, soft natural lighting, shallow depth of field, ` +
        `sharp focus, high detail, square 1:1 composition. No text, captions, letters, watermarks or logos.`;
    const core = imagePrompt.replace(/\s+/g, " ").trim();
    return {
        full: `${core.slice(0, 700)}. ${suffix}`,
        // Shorter version for URL-based providers; the style suffix is always preserved
        short: `${core.slice(0, 300)}. ${suffix}`,
    };
}
 
// ---------------------------------------------------------------------------
// Image providers
// ---------------------------------------------------------------------------
async function generateImageWithGemini(ai: GoogleGenAI, prompt: string): Promise<Buffer> {
    const response = await withTimeout(
        ai.models.generateContent({
            model: process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_IMAGE_MODEL,
            contents: prompt,
            config: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        60_000,
        "Gemini image"
    );
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
        throw new Error("Gemini returned no image data (the prompt may have been blocked)");
    }
    return Buffer.from(imagePart.inlineData.data, "base64");
}
 
// Accept either env var name so a rename in .env can't silently disable the provider
function getHfToken(): string | undefined {
    const raw = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    return raw ? raw.trim().replace(/^["']|["']$/g, "") : undefined;
}
 
// Free token: https://huggingface.co/settings/tokens (needs "Make calls to Inference Providers" permission)
async function generateImageWithHuggingFace(prompt: string): Promise<Buffer> {
    const token = getHfToken();
    if (!token) throw new Error("HF_TOKEN / HUGGINGFACE_API_KEY is not set");
    const model = process.env.HF_IMAGE_MODEL || DEFAULT_HF_IMAGE_MODEL;
 
    const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "image/png",
            "x-wait-for-model": "true",
        },
        body: JSON.stringify({ inputs: prompt, parameters: { width: IMAGE_SIZE, height: IMAGE_SIZE } }),
        signal: AbortSignal.timeout(90_000),
    });
    return readImageResponse(res, "Hugging Face");
}
 
// Cloudflare Workers AI (FLUX.1-schnell). Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.
async function generateImageWithCloudflare(prompt: string): Promise<Buffer> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
    if (!accountId || !apiToken) {
        throw new Error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN is not set");
    }
    const model = process.env.CLOUDFLARE_IMAGE_MODEL || DEFAULT_CF_IMAGE_MODEL;
 
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 6 }),
        signal: AbortSignal.timeout(60_000),
    });
 
    if (!res.ok) {
        const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
        const err: any = new Error(`Cloudflare returned ${res.status}${body ? `: ${body}` : ""}`);
        err.status = res.status;
        throw err;
    }
 
    // Some models return raw image bytes, FLUX returns JSON with a base64 image
    const contentType = res.headers.get("content-type") || "";
    if (contentType.startsWith("image/")) {
        return Buffer.from(await res.arrayBuffer());
    }
    const data: any = await res.json();
    const b64: string | undefined = data?.result?.image ?? data?.image;
    if (!b64) throw new Error("Cloudflare returned no image data");
    return Buffer.from(b64, "base64");
}
 
async function generateImageWithPollinations(prompt: string): Promise<Buffer> {
    const models = ["flux", "turbo", "flux"];
    let lastError: any;
 
    for (let attempt = 0; attempt < models.length; attempt++) {
        try {
            const seed = Math.floor(Math.random() * 1_000_000);
            const url =
                `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
                `?width=${IMAGE_SIZE}&height=${IMAGE_SIZE}&nologo=true&model=${models[attempt]}&seed=${seed}`;
            const headers: Record<string, string> = {};
            if (process.env.POLLINATIONS_TOKEN) headers.Authorization = `Bearer ${process.env.POLLINATIONS_TOKEN}`;
 
            const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
            return await readImageResponse(res, "Pollinations");
        } catch (err: any) {
            lastError = err;
            if (attempt < models.length - 1) await sleep(1500 * (attempt + 1));
        }
    }
    throw lastError;
}
 
// Providers that failed with quota / model-not-found errors are skipped for a while
const providerBlockedUntil: Record<string, number> = {};
const loggedSkips = new Set<string>();
 
type ImageResult = { buffer: Buffer; provider: string };
 
async function generateAIImage(
    ai: GoogleGenAI,
    imagePrompt: string,
    tone: string
): Promise<ImageResult> {
    const prompts = buildImagePrompts(imagePrompt, tone);
 
    const providers: { name: string; enabled: () => boolean; run: () => Promise<Buffer> }[] = [
        {
            name: "cloudflare",
            enabled: () => !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
            run: () => generateImageWithCloudflare(prompts.full),
        },
        {
            // Opt-in: set GEMINI_IMAGE_ENABLED=true once billing is enabled on your Google project
            name: "gemini",
            enabled: () => process.env.GEMINI_IMAGE_ENABLED === "true",
            run: () => generateImageWithGemini(ai, prompts.full),
        },
        {
            name: "huggingface",
            enabled: () => !!getHfToken(),
            run: () => generateImageWithHuggingFace(prompts.full),
        },
        {
            name: "pollinations",
            enabled: () => process.env.POLLINATIONS_DISABLED !== "true",
            run: () => generateImageWithPollinations(prompts.short),
        },
    ];
 
    const failures: string[] = [];
 
    for (const provider of providers) {
        if (!provider.enabled()) {
            if (!loggedSkips.has(provider.name)) {
                loggedSkips.add(provider.name);
                console.warn(`[image] ${provider.name} skipped (not configured / disabled)`);
            }
            continue;
        }
        if (Date.now() < (providerBlockedUntil[provider.name] ?? 0)) {
            failures.push(`${provider.name}: skipped (cooldown)`);
            continue;
        }
 
        try {
            const buffer = await provider.run();
            await validateImage(buffer);
            return { buffer, provider: provider.name };
        } catch (err: any) {
            if (isQuotaError(err)) {
                providerBlockedUntil[provider.name] = Date.now() + 60 * 60 * 1000; // 1 hour
                failures.push(`${provider.name}: quota exceeded`);
                console.warn(`[image] ${provider.name} quota exceeded, skipping it for 1 hour`);
            } else if (isModelNotFoundError(err) && provider.name !== "pollinations") {
                providerBlockedUntil[provider.name] = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
                failures.push(`${provider.name}: model not available`);
                console.warn(`[image] ${provider.name} model not available, check your model name in .env`);
            } else {
                failures.push(`${provider.name}: ${shortError(err)}`);
                console.warn(`[image] ${provider.name} failed: ${shortError(err)}`);
            }
        }
    }
 
    throw new Error(failures.join(" | ") || "No image provider available");
}
 
// ---------------------------------------------------------------------------
// Cloudinary
// ---------------------------------------------------------------------------
async function uploadImageToCloudinary(buffer: Buffer): Promise<string> {
    const attempt = () =>
        new Promise<string>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: "ai-generations", resource_type: "image" },
                (error, result) => {
                    if (error || !result) reject(error || new Error("Empty Cloudinary response"));
                    else resolve(result.secure_url);
                }
            );
            stream.end(buffer);
        });
 
    try {
        return await attempt();
    } catch (err: any) {
        console.warn("[image] Cloudinary upload failed, retrying once:", shortError(err));
        await sleep(1000);
        return await attempt();
    }
}
 
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
 
        // 503 (overloaded) retries the same model; 404 (retired / unavailable model) moves on to the next one.
        const candidateModels = [
            ...new Set(
                [process.env.GEMINI_MODEL?.trim(), ...GEMINI_TEXT_MODEL_FALLBACKS].filter((m): m is string => !!m)
            ),
        ];
        let modelIndex = 0;
        let textResponse: any;
        let retries = 3;
        let lastError: any;
 
        while (retries > 0) {
            try {
                textResponse = await ai.models.generateContent({
                    model: candidateModels[modelIndex],
                    contents: `Generate a social media post based on this prompt: "${prompt}"!
                    Tone: ${safeTone}.
                    Include relevant hashtags.
                    Format the response as JSON with "content" and "imagePrompt" fields.
                    The "imagePrompt" must describe a single concrete photographable scene: the exact product/subject, setting, lighting, camera angle, colour palette and mood. Do not include any text or words in the image.`,
                    config: { responseMimeType: "application/json" },
                });
                break;
            } catch (err: any) {
                lastError = err;
                if (isModelNotFoundError(err) && modelIndex < candidateModels.length - 1) {
                    console.warn(
                        `Gemini model "${candidateModels[modelIndex]}" is unavailable, trying "${candidateModels[modelIndex + 1]}"`
                    );
                    modelIndex++;
                    retries = 3;
                } else if ((err?.status === 503 || err?.code === 503) && retries > 1) {
                    retries--;
                    console.warn(`Gemini API overloaded (503), retrying... (${retries} attempts left)`);
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                } else {
                    break;
                }
            }
        }
 
        if (!textResponse) {
            throw lastError || new Error("Failed to generate text from Gemini API.");
        }
 
        const rawText = textResponse.text || "";
        let content = rawText;
        let imagePrompt = "";
 
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[0]);
                if (typeof data.content === "string" && data.content.trim()) content = data.content.trim();
                if (typeof data.imagePrompt === "string" && data.imagePrompt.trim()) imagePrompt = data.imagePrompt.trim();
            } catch {
                // not valid JSON, fall back to raw text
            }
        }
 
        if (!content.trim()) {
            res.status(502).json({ message: "The AI returned an empty response. Please try again." });
            return;
        }
 
        if (!imagePrompt) imagePrompt = imagePromptFromContent(content);
 
        let mediaUrl = "";
        let imageFailed = false;
        let imageProvider: string | undefined;
        let imageError: string | undefined;
 
        if (generateImage) {
            console.log("[image] prompt:", imagePrompt.slice(0, 300));
            try {
                const { buffer, provider } = await generateAIImage(ai, imagePrompt, safeTone);
                imageProvider = provider;
 
                const resizedBuffer = await sharp(buffer)
                    .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "cover" })
                    .jpeg({ quality: 90 })
                    .toBuffer();
 
                mediaUrl = await uploadImageToCloudinary(resizedBuffer);
                console.log(`[image] generated with ${provider}`);
            } catch (err: any) {
                imageFailed = true;
                imageError = shortError(err);
                console.error("[image] generation failed:", imageError);
            }
        }
 
        // Save generation to DB
        const generation = await Generation.create({
            user: req.user._id,
            prompt,
            content,
            mediaUrl,
            mediaType: mediaUrl ? "image" : undefined,
            tone: safeTone,
        });
 
        res.status(200).json({
            ...generation.toObject(),
            imageGenerationFailed: imageFailed,
            imageProvider,
            imageError,
        });
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
 