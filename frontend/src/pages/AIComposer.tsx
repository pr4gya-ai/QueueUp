import { useEffect, useState } from "react";
import { dummyGenerationData } from "../assets/assets";
import { ArrowRightIcon, Loader2Icon, ImageIcon, TypeIcon, HistoryIcon } from "lucide-react";

const AIComposer = () => {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("Professional");
  const [generateImage, setGenerateImage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [generations, setGenerations] = useState<any[]>([]);

  // Scheduling state
  const [activeScheduler, setActiveScheduler] = useState<any>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const fetchGenerations = async () => {
    setGenerations(dummyGenerationData);
  };

  useEffect(() => {
    fetchGenerations();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      fetchGenerations();
    }, 2000);
  };

  const tones = [
    "Professional",
    "Creative",
    "Funny",
    "Minimalist",
    "Excited"
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
      {/* Input Section */}
      <div className="space-y-6 text-center mt-20">
        <h1 className="text-3xl text-slate-700 tracking-tight">What should we create today?</h1>
        <div className="relative group mt-12">
          <textarea
            className="w-full px-6 py-6 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 transition resize-none h-40"
            placeholder="Share your idea... (e.g. A post about the launch of our new eco-friendly coffee beans)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="absolute bottom-4 right-2.5 flex items-center gap-2.5 text-sm">
            {/* Segmented pill: With Image / Text Only */}
            <div className="inline-flex bg-slate-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setGenerateImage(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  generateImage
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  !generateImage
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
          {tones.map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all border ${
                tone === t
                  ? "bg-gradient-to-r from-red-500 to-orange-500 border-transparent text-white"
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
                  <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                    {gen.tone}
                  </span>
                </div>

                <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                  {gen.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule modal */}
    </div>
  );
};

export default AIComposer;