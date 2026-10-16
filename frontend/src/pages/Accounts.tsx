import { useEffect, useState } from "react";
import { PLATFORMS } from "../assets/assets";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import AccountList from "../components/AccountList";
import PlatformPickerModel from "../components/PlatformPickerModel";
import toast from "react-hot-toast";
import { isAxiosError } from "axios";
import api, { getErrorMessage } from "../api/axios";
import type { Account } from "../types";
 
const loadAccounts = async () => (await api.get<Account[]>("/api/accounts")).data;
 
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
 
const ZERNIO_BILLING_URL = "https://zernio.com/dashboard/billing?add_payment_method=1";
 
// Zernio needs a card on file for a 3rd account or the first X account. Explain it and link to billing.
const showBillingToast = (message: string, billingUrl: string) =>
  toast(
    (t) => (
      <div className="flex flex-col gap-2 text-sm">
        <span>{message}</span>
        <a
          href={billingUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => toast.dismiss(t.id)}
          className="font-medium text-orange-600 underline"
        >
          Open Zernio billing
        </a>
      </div>
    ),
    { duration: 15000, icon: "💳" }
  );
 
const Accounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
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
      if (shouldSync) {
        try {
          const label = connectedPlatform ? capitalize(connectedPlatform) : "Social Media";
          toast.loading(`Syncing ${label} account...`, { id: "sync" });
          await api.get("/api/oauth/sync");
          const handle = connectedUsername ? ` (@${connectedUsername})` : "";
          toast.success(connectedPlatform ? `${label}${handle} connected!` : "Accounts synced!", { id: "sync" });
        } catch (error) {
          toast.error(getErrorMessage(error, "Failed to sync accounts"), { id: "sync" });
        }
      } else if (errorMsg) {
        toast.error(`Connection failed: ${errorMsg}`);
      }
 
      // always show what we have, even if the sync failed
      try {
        setAccounts(await loadAccounts());
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load accounts"));
      }
    };
 
    void run();
  }, []);
 
  // Pressing Back from the platform's login page can restore this page from the browser's
  // cache with `connecting` still set, which would leave the picker stuck on "Connecting...".
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setConnecting(null);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
 
  // Connect selected platform
  const handleConnect = async (platformId: string) => {
    setConnecting(platformId);
    try {
      const { data } = await api.get(`/api/oauth/${platformId}/url`);
      window.location.href = data.url;
    } catch (error) {
      // close the picker so the error toast (e.g. a Zernio billing message) isn't hidden behind it
      setShowPlatformPicker(false);
      if (isAxiosError(error) && error.response?.status === 402) {
        const data = error.response.data as { message?: string; dashboardUrl?: string } | undefined;
        showBillingToast(
          data?.message || "Zernio needs a payment method on file to connect this account.",
          data?.dashboardUrl || ZERNIO_BILLING_URL
        );
      } else {
        toast.error(getErrorMessage(error, `Failed to connect ${platformId}`));
      }
      setConnecting(null);
    }
  };
 
  // Pull every account Zernio holds for this user into Queue Up. Useful when a connection
  // succeeded on Zernio but the redirect back here never completed.
  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    toast.loading("Syncing accounts...", { id: "manual-sync" });
    try {
      await api.get("/api/oauth/sync");
      const fresh = await loadAccounts();
      setAccounts(fresh);
      toast.success(
        fresh.length === 0
          ? "Synced. No accounts found on Zernio yet."
          : `Synced. ${fresh.length} account${fresh.length === 1 ? "" : "s"} found.`,
        { id: "manual-sync" }
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to sync accounts"), { id: "manual-sync" });
    } finally {
      setSyncing(false);
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
 
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            title="Pull your connected accounts from Zernio"
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCwIcon className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </button>
 
          <button
            type="button"
            onClick={() => setShowPlatformPicker(true)}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 font-medium text-white transition-all hover:from-orange-600 hover:to-pink-600"
          >
            <PlusIcon className="h-4 w-4" />
            Connect Account
          </button>
        </div>
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
 