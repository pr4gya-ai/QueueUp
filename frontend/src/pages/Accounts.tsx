import { useEffect, useState } from "react";
import { dummyAccountsData, PLATFORMS } from "../assets/assets";
import { PlusIcon } from "lucide-react";
import AccountList from "../components/AccountList";
import PlatformPickerModel from "../components/PlatformPickerModel";

interface Account {
  _id: string;
  zernioAccountId: string;
  handle: string;
  platform: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: string;
}

const Accounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);

  const fetchAccounts = async () => {
    // Start with no connected accounts
    setAccounts([]);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Connect selected platform
  const handleConnect = (platformId: string) => {
    setConnecting(platformId);

    setTimeout(() => {
      const matchedAccount = dummyAccountsData.find(
        (account) => account.platform === platformId
      );

      if (matchedAccount) {
        setAccounts((prevAccounts) => {
          // Don't add the same platform twice
          const alreadyConnected = prevAccounts.some(
            (account) => account.platform === platformId
          );

          if (alreadyConnected) {
            return prevAccounts;
          }

          // Add ONLY selected platform
          return [...prevAccounts, matchedAccount];
        });
      }

      setConnecting(null);
      setShowPlatformPicker(false);
    }, 1000);
  };

  // Disconnect ONLY the selected account
  const handleDisconnect = async (accountId: string) => {
    setAccounts((prevAccounts) =>
      prevAccounts.filter((account) => account._id !== accountId)
    );
  };

  // Currently connected platforms
  const connectedIds = accounts.map(
    (account) => account.platform
  );

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 text-sm">
        <div>
          <h2 className="text-xl text-slate-900">
            Connected Accounts
          </h2>

          <p className="mt-0.5 text-sm text-slate-500">
            {accounts.length} of {PLATFORMS.length} platforms connected
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
      <AccountList
        accounts={accounts}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
};

export default Accounts;