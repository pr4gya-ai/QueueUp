import { AlertCircleIcon, CheckCircleIcon, PlusIcon, UnplugIcon } from "lucide-react";
import { PLATFORMS } from "../assets/assets";
import type { Account } from "../types";

interface AccountListProps {
  accounts: Account[];
  onDisconnect: (accountId: string) => Promise<void>;
}

const AccountList = ({ accounts, onDisconnect }: AccountListProps) => {
  const handleDisconnect = async (accountId: string) => {
    const confirm = window.confirm("Are you sure you want to disconnect this account?");
    if (confirm) {
      await onDisconnect(accountId);
    }
  };

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

        return (
          <div
            key={account._id}
            className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 
            flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                {Icon && <Icon className="size-4 text-slate-600" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {account.handle}
                </p>
                <p className="text-xs text-slate-400">{platform?.name}</p>
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
                onClick={() => handleDisconnect(account._id)}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title="Disconnect"
                aria-label={`Disconnect ${account.handle}`}
              >
                <UnplugIcon className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AccountList;