import { useEffect, useState } from "react";
import { PLATFORMS } from "../assets/assets";
import { ArrowRightIcon, Loader2Icon, ImageIcon, TypeIcon, HistoryIcon, Wand2Icon, XIcon, TimerIcon } from "lucide-react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/axios";
import DateTimeFields from "../components/DateTimeFields";
import useConnectedPlatforms from "../hooks/useConnectedPlatforms";
import { emptySchedule, getCharLimit, toScheduledDate } from "../utils/schedule";
import type { Generation } from "../types";

const TONES = ["Professional", "Creative", "Funny", "Minimalist", "Excited"];

const AIComposer = () => {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("Professional");
  const [generateImage, setGenerateImage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [generationsLoaded, setGenerationsLoaded] = useState(false);
  const connected = useConnectedPlatforms();

  // Scheduling state
  const [activeScheduler, setActiveScheduler] = useState<Generation | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [schedule, setSchedule] = useState(emptySchedule);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    api.get<Generation[]>("/api/post/generations")
      .then(({ data }) => setGenerations(data))
      .catch((error) => toast.error(getErrorMessage(error, "Failed to load generations")))
      .finally(() => setGenerationsLoaded(true));
  }, []);

  // close the schedule modal with Escape
  useEffect(() => {
    if (!activeScheduler) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveScheduler(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeScheduler]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<Generation>("/api/post/generate", { prompt, tone, generateImage });
      setGenerations((prev) => [data, ...prev]);
      if (data.imageGenerationFailed) {
        toast("Post generated, but the image could not be created.", { icon: "⚠️" });
      } else {
        toast.success("Post generated!");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to generate post"));
    } finally {
      setLoading(false);
    }
  };

  const openScheduler = (gen: Generation) => {
    setSelectedPlatforms([]);
    setSchedule(emptySchedule());
    setActiveScheduler(gen);
  };

  const handleSchedule = async () => {
    if (!activeScheduler) return;

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
    if (selectedPlatforms.includes("instagram") && !activeScheduler.mediaUrl) {
      toast.error("Instagram requires an image. Generate this post with an image.");
      return;
    }
    const limit = getCharLimit(selectedPlatforms);
    if (limit && activeScheduler.content.length > limit) {
      toast.error(`This post is ${activeScheduler.content.length} characters; the limit for the selected platforms is ${limit}.`);
      return;
    }

    setScheduling(true);
    try {
      await api.post("/api/post/schedule", {
        content: activeScheduler.content,
        platforms: selectedPlatforms,
        scheduledFor: when.toISOString(),
        status: "scheduled",
        ...(activeScheduler.mediaUrl ? { mediaUrl: activeScheduler.mediaUrl, mediaType: "image" } : {}),
      });
      toast.success("Post scheduled!");
      setActiveScheduler(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to schedule post"));
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      {/* Input Section */}
      <div className="space-y-6 text-center mt-20">
        <h1 className="text-3xl text-slate-700 tracking-tight">What should we create today?</h1>
        <div className="relative group mt-12">
          <textarea
            className="w-full px-6 py-6 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 transition resize-none h-40"
            placeholder="Share your idea... (e.g. A post about the launch of our new eco-friendly coffee beans)"
            value={prompt}
            maxLength={2000}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="absolute bottom-4 right-2.5 flex items-center gap-2.5 text-sm">
            {/* Segmented pill: With Image / Text Only */}
            <div className="inline-flex bg-slate-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setGenerateImage(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${generateImage
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                <ImageIcon className="size-3.5" />
                With image
              </button>
              <button
                type="button"
                onClick={() => setGenerateImage(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!generateImage
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                <TypeIcon className="size-3.5" />
                Text only
              </button>
            </div>

            {/* Generate button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  Generate
                  <ArrowRightIcon className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(t)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all border ${tone === t
                ? "bg-gradient-to-r from-orange-500 to-pink-500 border-transparent text-white"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* AI generations */}
      <div className="space-y-6 pt-12 border-t border-slate-100">
        <div className="flex items-center justify-between text-slate-600">
          <div className="flex items-center gap-2">
            <HistoryIcon className="size-5" />
            <h4 className="text-xl">Recent generations</h4>
          </div>
          <span className="text-sm text-slate-500 bg-slate-50 px-2">
            {generations.length} total
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {generations.map((gen) => (
            <div
              key={gen._id}
              className="group bg-white rounded-2xl border border-slate-100 p-5 hover:border-red-200 transition-all relative overflow-hidden"
            >
              <div className="flex flex-col h-full space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(gen.createdAt).toLocaleString()}
                  </span>
                  {gen.tone && (
                    <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                      {gen.tone}
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                  {gen.content}
                </p>

                {gen.mediaUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-50 bg-slate-50">
                    <img
                      src={gen.mediaUrl}
                      alt="Generated media"
                      className="w-full h-full aspect-video object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openScheduler(gen)}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-full text-sm font-medium transition-all"
                  >
                    Schedule Post
                  </button>
                </div>
              </div>
            </div>
          ))}

          {generationsLoaded && generations.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-2">
              <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
                <Wand2Icon className="size-6" />
              </div>
              <p className="text-slate-400 text-sm">
                No generations yet. Start by entering a prompt above and clicking "Generate".
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Schedule modal */}
      {activeScheduler && (
        <div className="fixed inset-0 min-h-screen z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/30">
              <h3 className="text-lg font-semibold text-slate-800">Schedule Generation</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setActiveScheduler(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {activeScheduler.prompt}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {activeScheduler.content}
                </p>
                {activeScheduler.mediaUrl && (
                  <img
                    src={activeScheduler.mediaUrl}
                    alt="Generated content"
                    className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-sm"
                  />
                )}
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-50 space-y-8">
                {/* options */}
                <div className="space-y-6">
                  <label className="block text-[11px] text-slate-500 uppercase tracking-wide mb-3">
                    Select Platforms
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => {
                      const active = selectedPlatforms.includes(p.id);
                      const notConnected = connected !== null && !connected.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-label={p.name}
                          aria-pressed={active}
                          title={notConnected ? `${p.name} (not connected)` : p.name}
                          onClick={() =>
                            setSelectedPlatforms((prev) =>
                              prev.includes(p.id)
                                ? prev.filter((x) => x !== p.id)
                                : [...prev, p.id]
                            )
                          }
                          className={`p-2.5 rounded-md border text-xs transition-colors ${active
                            ? "bg-red-400 border-transparent text-white"
                            : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                            } ${notConnected ? "opacity-40" : ""}`}
                        >
                          <p.icon className="size-4.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <DateTimeFields value={schedule} onChange={setSchedule} />
              </div>

              <button
                type="button"
                onClick={handleSchedule}
                disabled={scheduling}
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 font-medium text-white transition-all hover:from-orange-600 hover:to-pink-600 disabled:opacity-50"
              >
                {scheduling ? <Loader2Icon className="size-4 animate-spin" /> : <TimerIcon className="size-4" />}
                Schedule Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIComposer;
