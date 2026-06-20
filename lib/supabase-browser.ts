import { createBrowserClient } from "@supabase/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let cachedClient: BrowserClient | null = null;

function getRealClient(): BrowserClient {
  if (cachedClient) return cachedClient;
  cachedClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return cachedClient;
}

/**
 * Returns a Supabase browser client.
 *
 * The underlying client is created lazily via a Proxy so that simply calling
 * `createClient()` during render (including server-side prerendering at build
 * time) does not instantiate `createBrowserClient`. The real client is only
 * created the first time a property/method is accessed, which in practice
 * happens inside event handlers running in the browser where the
 * `NEXT_PUBLIC_SUPABASE_*` environment variables are available.
 */
export function createClient(): BrowserClient {
  return new Proxy({} as BrowserClient, {
    get(_target, prop, receiver) {
      const client = getRealClient();
      return Reflect.get(client as object, prop, receiver);
    },
  });
}
