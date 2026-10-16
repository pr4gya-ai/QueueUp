import { Zernio } from "@zernio/node";

let client: Zernio | null = null;

// The Zernio SDK throws as soon as it is constructed without an API key. Creating
// the client lazily means the rest of the app (auth, AI composer) still boots when
// ZERNIO_API_KEY is missing, and only Zernio-backed features report a clear error.
const getClient = (): Zernio => {
    if (!client) {
        const apiKey = process.env.ZERNIO_API_KEY;
        if (!apiKey) {
            throw new Error("ZERNIO_API_KEY is not configured on the server");
        }
        // Only override the base URL when explicitly configured. The SDK's own default
        // (https://zernio.com/api) already matches the documented API root (.../api/v1),
        // whereas the previous hard-coded https://api.zernio.com fallback did not.
        const baseURL = process.env.ZERNIO_BASE_URL?.trim();
        client = new Zernio(baseURL ? { apiKey, baseURL } : { apiKey });
    }
    return client;
};

const zernio = new Proxy({} as Zernio, {
    get: (_target, prop) => Reflect.get(getClient(), prop),
});

export default zernio;
