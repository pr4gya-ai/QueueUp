import { useEffect, useState } from "react";
import api from "../api/axios";
import type { Account } from "../types";

// Platform ids that have at least one connected account, or null until known
// (or if the request failed, in which case callers should not block the user).
export default function useConnectedPlatforms(): Set<string> | null {
    const [connected, setConnected] = useState<Set<string> | null>(null);

    useEffect(() => {
        api.get<Account[]>("/api/accounts")
            .then(({ data }) =>
                setConnected(new Set(data.filter((a) => a.status === "connected").map((a) => a.platform)))
            )
            .catch(() => {});
    }, []);

    return connected;
}
