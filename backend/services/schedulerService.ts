import cron from "node-cron";
import { Post } from "../models/Post.js";
import { Account } from "../models/Account.js";
import zernio from "../config/zernio.js";
import { ActivityLog } from "../models/Activity.js";

// Zernio statuses that mean a platform did not publish
const FAILED_STATUSES = ["failed", "cancelled"];

let isRunning = false;

const markFailed = async (postId: unknown, reason: string) => {
    try {
        await Post.updateOne({ _id: postId }, { status: "failed", failureReason: reason.slice(0, 500) });
    } catch (error) {
        console.error(`Could not mark post ${postId} as failed:`, error);
    }
};

const publishPost = async (post: InstanceType<typeof Post>) => {
    const accounts = await Account.find({
        user: post.user,
        platform: { $in: post.platforms },
        status: "connected",
        zernioAccountId: { $exists: true, $ne: null }
    })

    if (accounts.length === 0) {
        // retrying every minute would never help, so surface it to the user instead
        console.log(`No connected Zernio accounts found for post ${post._id}`);
        await markFailed(post._id, "No connected account for the selected platform(s)");
        return;
    }

    const zernioPlatforms = accounts.map((acc) => ({
        platform: acc.platform as any,
        accountId: acc.zernioAccountId!
    }))

    const payload = {
        content: post.content,
        publishNow: true,
        ...(post.mediaUrl ? {
            mediaItems: [{
                type: post.mediaType || "image",
                url: post.mediaUrl
            }]
        } : {}),
        platforms: zernioPlatforms,
    }

    console.log(`Publishing post ${post._id} to Zernio with media: ${post.mediaUrl || "none"}`)

    const response = await zernio.posts.createPost({
        body: payload
    })

    // publishNow answers with HTTP 207 (still "ok") when some or all platforms failed,
    // so a returned body is not proof that anything was published.
    const data = response.data as any;
    const publishedPost = data?.post || data;
    if (!publishedPost) {
        throw new Error("Failed to get post object from Zernio response");
    }

    const results: Array<{ platform: string; status: string; error: string | null }> =
        Array.isArray(data?.platformResults) ? data.platformResults : [];

    let publishedTo: string[];
    let failures: string[];

    if (results.length > 0) {
        publishedTo = results.filter((r) => !FAILED_STATUSES.includes(r.status)).map((r) => r.platform);
        failures = results
            .filter((r) => FAILED_STATUSES.includes(r.status))
            .map((r) => `${r.platform}: ${r.error || r.status}`);
    } else if (publishedPost.status === "failed") {
        publishedTo = [];
        failures = [data?.error || data?.message || "Zernio reported the post as failed"];
    } else {
        publishedTo = accounts.map((a) => a.platform);
        failures = [];
    }

    if (publishedTo.length === 0) {
        throw new Error(failures.join("; ") || "Post was not published to any platform");
    }

    console.log(`Zernio post created: ${publishedPost._id || publishedPost.id}`)

    await Post.updateOne(
        { _id: post._id },
        failures.length > 0
            // partially published: keep the details so the user can see what went wrong
            ? { status: "published", failureReason: `Not published to: ${failures.join("; ")}`.slice(0, 500) }
            : { status: "published", $unset: { failureReason: "" } }
    );

    await ActivityLog.create({
        user: post.user,
        actionType: "POST_PUBLISHED",
        description: `Published post to ${publishedTo.join(", ")}`,
        relatedPost: post._id,
    })
};

// One scheduler tick: publish every post that has come due.
export const processDuePosts = async () => {
    // a slow Zernio call must not let the next tick publish the same posts twice
    if (isRunning) return;
    isRunning = true;

    try {
        const now = new Date();
        const postsToPublish = await Post.find({
            status: "scheduled", scheduledFor:
                { $lte: now }
        }).sort({ scheduledFor: 1 });

        for (const post of postsToPublish) {
            try {
                await publishPost(post);
            } catch (err: any) {
                const reason = err?.message || "Unknown error";
                console.error(`Failed to publish post ${post._id} :`, err?.body || reason);
                await markFailed(post._id, reason);
            }
        }
        if (postsToPublish.length > 0) {
            console.log(`Evaluated ${postsToPublish.length} posts at ${now.toISOString()}`);
        }

    } catch (error) {
        console.log("Error in scheduler: ", error);
    } finally {
        isRunning = false;
    }
};

export const initScheduler = () => {
    cron.schedule("* * * * *", processDuePosts)
    console.log("Scheduler service initialized!")
}
