import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { setupServer } from "./server/plugin.ts"; // Custom Vite Plugin for WebSocket backend

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  return {
    plugins: [
      react(),
      {
        name: 'gemini-websocket-server',
        configureServer(server) {
          if (!server.httpServer) return; // Add null check
          
          // Typecast to bypass the HTTP/2 union type mismatch
          setupServer(server.httpServer as import("http").Server); 
        }
      }
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client/src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname, "client"),
    publicDir: path.resolve(import.meta.dirname, "client/public"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      host: "localhost",
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port: 5173,
      host: "localhost",
    },
  };
});
