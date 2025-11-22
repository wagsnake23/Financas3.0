import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: (url, options) => {
        const method = options?.method?.toUpperCase() ?? "GET";
        const isSelect =
          method === "GET" ||
          (method === "POST" && url.includes("select=")); // Supabase usa POST para SELECTs também

        // 🔥 Forçar que todas as consultas SELECT leiam da primária e não da réplica
        if (isSelect) {
          url += (url.includes("?") ? "&" : "?") + "read=primary";
        }

        return fetch(url, options);
      },
    },
  }
);