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
        client = new Zernio({
            apiKey,
            baseURL: process.env.ZERNIO_BASE_URL || "https://api.zernio.com",
        });
    }
    return client;
};

const zernio = new Proxy({} as Zernio, {
    get: (_target, prop) => Reflect.get(getClient(), prop),
});

export default zernio;
