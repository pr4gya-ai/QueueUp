import {
  XIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
} from "lucide-react";

import { PLATFORMS } from "../assets/assets";

interface PlatformPickerModelProps {
  connectedIds: string[];
  connecting: string | null;
  onClose: () => void;
  onConnect: (platformId: string) => void;
}

const PlatformPickerModel = ({
  connectedIds,
  connecting,
  onClose,
  onConnect,
}: PlatformPickerModelProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      {/* Modal */}
      <div className="w-full max-w-[460px] overflow-hidden rounded-[18px] bg-white shadow-2xl">
        
        {/* Header */}
        <div className="flex h-[62px] items-center justify-between border-b border-slate-200 px-6">
          <h3 className="text-[16px] font-medium text-slate-700">
            Choose a Platform
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <XIcon className="size-[18px]" />
          </button>
        </div>

        {/* Platform List */}
        <div className="space-y-2.5 p-6">
          {PLATFORMS.map((platform) => {
            const isConnected = connectedIds.includes(platform.id);
            const isConnecting = connecting === platform.id;

            return (
              <button
                key={platform.id}
                type="button"
                disabled={isConnected || isConnecting}
                onClick={() => onConnect(platform.id)}
                className={`group relative flex min-h-[68px] w-full items-center gap-4 rounded-[14px] border px-5 py-3.5 text-left transition-all duration-200 ${
                  isConnected
                    ? "border-red-200 bg-red-50/70 cursor-default"
                    : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-100 cursor-pointer"
                }`}
              >
                {/* Platform Icon */}
                <div className="flex size-8 shrink-0 items-center justify-center">
                  <platform.icon
                    className={`size-[23px] ${
                      isConnected
                        ? "text-red-600"
                        : "text-slate-500"
                    }`}
                  />
                </div>

                {/* Platform Information */}
                <div className="min-w-0 flex-1">
                  <h4
                    className={`text-[14px] font-medium leading-5 ${
                      isConnected
                        ? "text-red-700"
                        : "text-slate-700"
                    }`}
                  >
                    {platform.name}
                  </h4>

                  <p
                    className={`mt-0.5 text-[12px] leading-4 ${
                      isConnected
                        ? "text-slate-500"
                        : "text-slate-500"
                    }`}
                  >
                    {isConnected
                      ? "Already connected"
                      : platform.description}
                  </p>
                </div>

                {/* Connecting Spinner */}
                {isConnecting && (
                  <div className="size-[18px] shrink-0 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                )}

                {/* Connected Status */}
                {isConnected && !isConnecting && (
                  <CheckCircleIcon className="size-[18px] shrink-0 text-red-500" />
                )}

                {/* External Link */}
                {!isConnected && !isConnecting && (
                  <ExternalLinkIcon className="size-[16px] shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlatformPickerModel;