import { useState } from "react";
import { AlertCircleIcon, CheckCircleIcon, LoaderCircleIcon, PlusIcon, UnplugIcon } from "lucide-react";
import { PLATFORMS } from "../assets/assets";
import type { Account } from "../types";
 
interface AccountListProps {
  accounts: Account[];
  onDisconnect: (accountId: string) => Promise<void>;
}
 
const AccountList = ({ accounts, onDisconnect }: AccountListProps) => {
  // id of the account being disconnected, so a double click can't fire two requests
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  // avatar URLs that failed to load (expired or blocked), so we fall back to the platform icon
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set());
 
  const handleDisconnect = async (accountId: string) => {
    if (disconnectingId) return;
    if (!window.confirm("Are you sure you want to disconnect this account?")) return;
 
    setDisconnectingId(accountId);
    try {
      await onDisconnect(accountId);
    } finally {
      setDisconnectingId(null);
    }
  };
 
  const markAvatarBroken = (accountId: string) =>
    setBrokenAvatars((prev) => new Set(prev).add(accountId));
 
  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200
      flex flex-col items-center justify-center py-20 px-6 text-center mt-6">
        <div className="size-14 bg-slate-50 rounded-2xl flex items-center
        justify-center mb-4 border border-slate-100">
          <PlusIcon className="size-6 text-slate-500 opacity-50" />
        </div>
        <p className="text-slate-700 text-lg">
          No accounts connected.
        </p>
        <p className="text-sm text-slate-400 mt-1 max-w-xs text-center">
          Connect your first social platform to start scheduling and managing your online presence more efficiently.
        </p>
      </div>
    );
  }
 
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
      {accounts.map((account) => {
        const platform = PLATFORMS.find((p) => p.id === account.platform);
        const Icon = platform?.icon;
        const isDisconnecting = disconnectingId === account._id;
        const showAvatar = !!account.avatarUrl && !brokenAvatars.has(account._id);
 
        return (
          <div
            key={account._id}
            className={`bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3
            flex items-center justify-between gap-3 transition-opacity ${isDisconnecting ? "opacity-50" : ""}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                {showAvatar ? (
                  <img
                    src={account.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                    onError={() => markAvatarBroken(account._id)}
                  />
                ) : (
                  Icon && <Icon className="size-4 text-slate-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {account.handle}
                </p>
                <p className="text-xs text-slate-400">{platform?.name ?? account.platform}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {account.status === "connected" ? (
                <span className="flex items-center gap-1 text-xs text-emerald-500">
                  <CheckCircleIcon className="size-3.5" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-500">
                  <AlertCircleIcon className="size-3.5" />
                  Disconnected
                </span>
              )}
              <button
                type="button"
                onClick={() => handleDisconnect(account._id)}
                disabled={disconnectingId !== null}
                className="text-slate-400 hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:hover:text-slate-400"
                title="Disconnect"
                aria-label={`Disconnect ${account.handle}`}
              >
                {isDisconnecting ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                ) : (
                  <UnplugIcon className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
 
export default AccountList;
 