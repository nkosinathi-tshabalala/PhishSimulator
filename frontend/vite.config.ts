import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // In development the page calls /api on its own address and Vite passes it to Flask, so the
      // login cookies stay first-party (SameSite=Strict) exactly as behind nginx in Docker.
      proxy: {
        "/api": {
          target: env.VITE_DEV_API_TARGET || "http://127.0.0.1:5000",
          changeOrigin: false,
        },
      },
    },
  };
});
