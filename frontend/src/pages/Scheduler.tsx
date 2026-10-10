import { useEffect, useRef, useState } from "react";
import { PLATFORMS } from "../assets/assets";
import { CalendarDaysIcon, XIcon, SendIcon, AlertTriangleIcon } from "lucide-react";
import api, { getErrorMessage } from "../api/axios";
import toast from "react-hot-toast";
import DateTimeFields from "../components/DateTimeFields";
import useConnectedPlatforms from "../hooks/useConnectedPlatforms";
import { emptySchedule, formatDateTime, getCharLimit, toScheduledDate } from "../utils/schedule";
import type { Post } from "../types";

const loadPosts = async () => (await api.get<Post[]>("/api/post")).data;

const PostMeta = ({ post, time }: { post: Post; time: string }) => (
  <div className="flex items-center justify-between mb-2">
    <div className="flex gap-1.5 items-center">
      {post.platforms.map((pl) => {
        const meta = PLATFORMS.find((p) => p.id === pl);
        return meta ? <meta.icon key={pl} className="size-3.5 text-slate-400" /> : null;
      })}
    </div>
    <div className="flex items-center gap-2">
      {post.mediaType && (
        <span className="text-xs bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold capitalize">
          {post.mediaType}
        </span>
      )}
      <span className="text-xs text-slate-400">{time}</span>
    </div>
  </div>
);

const Scheduler = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [schedule, setSchedule] = useState(emptySchedule);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [media, setMedia] = useState<{ file: File; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const connected = useConnectedPlatforms();

  // keep the latest preview URL reachable from the unmount cleanup
  const mediaRef = useRef(media);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);
  useEffect(() => () => {
    if (mediaRef.current) URL.revokeObjectURL(mediaRef.current.url);
  }, []);

  const selectMedia = (file: File) => {
    if (media) URL.revokeObjectURL(media.url);
    setMedia({ file, url: URL.createObjectURL(file) });
  };
  const clearMedia = () => {
    if (media) URL.revokeObjectURL(media.url);
    setMedia(null);
  };

  useEffect(() => {
    const refresh = () =>
      loadPosts()
        .then(setPosts)
        .catch((error) => toast.error(getErrorMessage(error, "Failed to load posts"), { id: "posts-error" }));
    void refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  const byTime = (a: Post, b: Post) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
  const scheduled = posts.filter((p) => p.status === "scheduled").sort(byTime);
  const published = posts.filter((p) => p.status === "published").sort((a, b) => byTime(b, a));
  const failed = posts.filter((p) => p.status === "failed").sort((a, b) => byTime(b, a));

  const charLimit = getCharLimit(selectedPlatforms);

  const togglePlatform = (id: string) =>
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    if (connected) {
      const missing = selectedPlatforms.filter((p) => !connected.has(p));
      if (missing.length > 0) {
        toast.error(`Connect ${missing.join(", ")} on the Accounts page first`);
        return;
      }
    }
    const when = toScheduledDate(schedule);
    if (!when) {
      toast.error("Select date and time");
      return;
    }
    if (when.getTime() < Date.now() - 60_000) {
      toast.error("Pick a time in the future");
      return;
    }
    if (selectedPlatforms.includes("instagram") && !media) {
      toast.error("Instagram requires an image or video");
      return;
    }
    if (charLimit && content.length > charLimit) {
      toast.error(`Content is over the ${charLimit}-character limit`);
      return;
    }

    const formData = new FormData();
    formData.append("content", content);
    formData.append("scheduledFor", when.toISOString());
    formData.append("status", "scheduled");
    formData.append("platforms", JSON.stringify(selectedPlatforms));
    if (media) formData.append("media", media.file);

    setLoading(true);
    try {
      // axios sets the multipart boundary itself when given FormData
      await api.post("/api/post/schedule", formData);
      toast.success("Post scheduled!");
      setContent("");
      setSchedule(emptySchedule());
      setSelectedPlatforms([]);
      clearMedia();
      loadPosts().then(setPosts).catch(() => {});
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">

      <div className="w-full lg:w-[460px] shrink-0">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-lg text-slate-700">Compose Post</h2>
          </div>

          <form className="space-y-5" onSubmit={handleSchedule}>
            {/* platform */}
            <div>
              <label className="block text-xs text-slate-500 uppercase mb-2">
                Platforms
              </label>
              <div className="flex flex-wrap gap-3">
                {PLATFORMS.map((p) => {
                  const active = selectedPlatforms.includes(p.id);
                  const notConnected = connected !== null && !connected.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      title={notConnected ? `${p.name} (not connected)` : p.name}
                      aria-label={p.name}
                      aria-pressed={active}
                      className={`flex items-center gap-1.5 p-3 rounded-md border transition-all duration-150 ${active
                        ? "bg-red-50 border-red-300 text-red-500 scale-103"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                        } ${notConnected ? "opacity-40" : ""}`}
                    >
                      <p.icon className="size-4.5" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* content */}
            <div>
              <label className="block text-xs text-slate-500 uppercase mb-2">
                Content
              </label>
              <textarea
                required
                rows={5}
                placeholder="What do you want to share today?"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm placeholder-slate-400 outline-none resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div
                className={`text-right text-xs mt-1 font-medium ${charLimit && content.length > charLimit ? "text-red-500" : "text-slate-400"
                  }`}
              >
                {charLimit ? `${content.length}/${charLimit}` : content.length}
              </div>
            </div>

            {/* media upload */}
            <div>
              <label className="block text-xs text-slate-500 mb-2">
                Media (optional)
              </label>
              {media ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  {media.file.type.startsWith("image/") ? (
                    <img src={media.url} alt="preview" className="w-full h-40 object-cover" />
                  ) : (
                    <video src={media.url} className="w-full h-40 object-cover" controls />
                  )}

                  <button
                    type="button"
                    onClick={clearMedia}
                    aria-label="Remove media"
                    className="absolute top-2 right-2 size-7 bg-slate-900/60 hover:bg-slate-900/80 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-5 py-10 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-all group">
                  <span className="text-sm text-slate-500 group-hover:text-red-600 transition-colors">
                    Click to upload images or videos
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) selectMedia(file);
                        e.target.value = "";
                      }}
                    />
                  </span>
                </label>
              )}
            </div>

            <DateTimeFields value={schedule} onChange={setSchedule} />

            {/* submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {loading ? "Scheduling..." : "Schedule Post"}
            </button>
          </form>
        </div>
      </div>

      {/* — Queue panels — */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {/* Upcoming */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
            <CalendarDaysIcon className="size-4 text-zinc-500" />
            <h3 className="text-slate-900 text-sm">Upcoming</h3>
            <span className="ml-auto text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full">
              {scheduled.length}
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {scheduled.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                No posts scheduled yet
              </div>
            ) : (
              scheduled.map((post) => (
                <div key={post._id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
                  <PostMeta post={post} time={formatDateTime(post.scheduledFor)} />
                  <p className="text-sm text-slate-500 line-clamp-2 max-w-md">{post.content}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Published */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
            <SendIcon className="size-4 text-zinc-500" />
            <h3 className="text-slate-900 text-sm">Published</h3>
            <span className="ml-auto text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full">
              {published.length}
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {published.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                No published posts yet
              </div>
            ) : (
              published.map((post) => (
                <div key={post._id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
                  <PostMeta post={post} time={formatDateTime(post.updatedAt)} />
                  <p className="text-sm text-slate-500 line-clamp-2 max-w-[80%]">{post.content}</p>
                  {post.failureReason && (
                    <p className="mt-1 text-xs text-amber-600">{post.failureReason}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Failed */}
        {failed.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-red-100">
              <AlertTriangleIcon className="size-4 text-red-500" />
              <h3 className="text-slate-900 text-sm">Failed</h3>
              <span className="ml-auto text-xs font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                {failed.length}
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
              {failed.map((post) => (
                <div key={post._id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
                  <PostMeta post={post} time={formatDateTime(post.scheduledFor)} />
                  <p className="text-sm text-slate-500 line-clamp-2 max-w-[80%]">{post.content}</p>
                  <p className="mt-1 text-xs text-red-600">
                    {post.failureReason || "Publishing failed"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scheduler;
