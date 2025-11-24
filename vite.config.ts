import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: { // NOVO: Adicionado para otimização de dependências
    include: ['date-fns-tz'], // Força o Vite a pré-empacotar date-fns-tz
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          charts: ["recharts"],
          // Adicionando chunks separados para lucide-react e sonner
          icons: ["lucide-react"],
          notifications: ["sonner"],
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Ajustado o limite de tamanho do chunk
  }
}));