import { useEffect, useState } from "react";
import { PLATFORMS } from "../assets/assets";
import { PlusIcon } from "lucide-react";
import AccountList from "../components/AccountList";
import PlatformPickerModel from "../components/PlatformPickerModel";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/axios";
import type { Account } from "../types";

const loadAccounts = async () => (await api.get<Account[]>("/api/accounts")).data;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const Accounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);

  useEffect(() => {
    // Zernio sends the user back here after OAuth with these query params
    const params = new URLSearchParams(window.location.search);
    const connectedPlatform = params.get("connected");
    const connectedUsername = params.get("username");
    const syncNeeded = params.get("sync") === "true";
    const errorMsg = params.get("error");

    window.history.replaceState({}, document.title, window.location.pathname);

    const shouldSync = !!connectedPlatform || syncNeeded;

    const run = async () => {
      try {
        if (shouldSync) {
          const label = connectedPlatform ? capitalize(connectedPlatform) : "Social Media";
          toast.loading(`Syncing ${label} account...`, { id: "sync" });
          await api.get("/api/oauth/sync");
          const handle = connectedUsername ? ` (@${connectedUsername})` : "";
          toast.success(connectedPlatform ? `${label}${handle} connected!` : "Accounts synced!", { id: "sync" });
        } else if (errorMsg) {
          // params.get() already decodes the value, so no decodeURIComponent here
          toast.error(`Connection failed: ${errorMsg}`);
        }
        setAccounts(await loadAccounts());
      } catch (error) {
        // reuse the "sync" id when syncing so the loading toast is replaced, not left spinning
        toast.error(getErrorMessage(error, "Failed to load accounts"), { id: shouldSync ? "sync" : undefined });
      }
    };

    void run();
  }, []);

  // Connect selected platform
  const handleConnect = async (platformId: string) => {
    setConnecting(platformId);
    try {
      const { data } = await api.get(`/api/oauth/${platformId}/url`);
      window.location.href = data.url;
    } catch (error) {
      toast.error(getErrorMessage(error, `Failed to connect ${platformId}`));
      setConnecting(null);
    }
  };

  // Disconnect ONLY the selected account
  const handleDisconnect = async (accountId: string) => {
    try {
      await api.delete(`/api/accounts/${accountId}`);
      toast.success("Account disconnected");
      setAccounts(await loadAccounts());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to disconnect account"));
    }
  };

  // Platforms that already have a connected account
  const connectedIds = accounts.filter((a) => a.status === "connected").map((a) => a.platform);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 text-sm">
        <div>
          <h2 className="text-xl text-slate-900">Connected Accounts</h2>

          <p className="mt-0.5 text-sm text-slate-500">
            {new Set(connectedIds).size} of {PLATFORMS.length} platforms connected
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPlatformPicker(true)}
          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 font-medium text-white transition-all hover:from-orange-600 hover:to-pink-600"
        >
          <PlusIcon className="h-4 w-4" />
          Connect Account
        </button>
      </div>

      {/* Platform Picker */}
      {showPlatformPicker && (
        <PlatformPickerModel
          connectedIds={connectedIds}
          connecting={connecting}
          onClose={() => setShowPlatformPicker(false)}
          onConnect={handleConnect}
        />
      )}

      {/* Accounts */}
      <AccountList accounts={accounts} onDisconnect={handleDisconnect} />
    </div>
  );
};

export default Accounts;