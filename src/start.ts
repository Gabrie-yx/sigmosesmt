import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  serverFns: {
    fetch: async (url, init) => {
      if (typeof window !== "undefined") {
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            const headers = new Headers(init?.headers);
            if (!headers.has("authorization")) {
              headers.set("authorization", `Bearer ${token}`);
            }
            return fetch(url, { ...init, headers });
          }
        } catch (e) {
          console.error("[serverFns.fetch] failed to attach Supabase token", e);
        }
      }
      return fetch(url, init);
    },
  },
}));
