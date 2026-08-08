import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query", "@tanstack/react-table"],
          "ui-vendor": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-avatar",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "framer-motion",
            "lucide-react",
          ],
          charts: ["chart.js", "react-chartjs-2"],
        },
      },
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5174
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
