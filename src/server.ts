// TanStack Start's executeMiddleware calls getStartOptions() to resolve
// functionMiddleware, but for server-fn RPCs the ALS context isn't set up
// until serverFnHandler runs inside executeMiddleware. We pre-populate
// the global ALS store so getStartContext() returns a usable stub rather
// than throwing. The real context is established per-request by
// runWithStartContext inside createStartHandler.
import { AsyncLocalStorage } from "node:async_hooks";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

const GLOBAL_STORAGE_KEY = Symbol.for("tanstack-start:start-storage-context");
const globalObj = globalThis as typeof globalThis & {
  [GLOBAL_STORAGE_KEY]?: AsyncLocalStorage<any>;
};

if (!globalObj[GLOBAL_STORAGE_KEY]) {
  globalObj[GLOBAL_STORAGE_KEY] = new AsyncLocalStorage();
}

const handler = createStartHandler(defaultStreamHandler);

// Load startInstance options so we can provide them as the ALS fallback.
// This ensures executeMiddleware sees the real functionMiddleware list
// even when called outside a request-scoped ALS context.
async function getStartInstanceOptions() {
  try {
    const entries = await import("#tanstack-start-entry");
    return (await entries.startInstance?.getOptions()) ?? {};
  } catch {
    return {};
  }
}

let startOptionsPromise: Promise<any> | undefined;
function ensureStartOptions() {
  if (!startOptionsPromise) startOptionsPromise = getStartInstanceOptions();
  return startOptionsPromise;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Ensure the ALS store has a fallback context before the handler runs.
    const storage = globalObj[GLOBAL_STORAGE_KEY]!;
    if (!storage.getStore()) {
      const opts = await ensureStartOptions();
      storage.enterWith({
        getRouter: () => undefined,
        startOptions: opts,
        contextAfterGlobalMiddlewares: {},
        executedRequestMiddlewares: new Set(),
        handlerType: "serverFn" as const,
        request,
      });
    }

    try {
      const response = await handler.fetch(request, env, ctx);
      return response;
    } catch (error) {
      console.error(error);
      return new Response(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Error</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:15px/1.5 system-ui,sans-serif;background:#fafafa;color:#111;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem}.card{max-width:28rem;width:100%;text-align:center;padding:2rem}h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#4b5563;margin:0 0 1.5rem}.actions{display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap}a,button{padding:.5rem 1rem;border-radius:.375rem;font:inherit;cursor:pointer;text-decoration:none;border:1px solid transparent}.primary{background:#111;color:#fff}.secondary{background:#fff;color:#111;border-color:#d1d5db}</style></head><body><div class="card"><h1>This page didn't load</h1><p>Something went wrong on our end. You can try refreshing or head back home.</p><div class="actions"><button class="primary" onclick="location.reload()">Try again</button><a class="secondary" href="/">Go home</a></div></div></body></html>`,
        { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
  },
};
