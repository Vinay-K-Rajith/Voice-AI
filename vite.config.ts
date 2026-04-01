import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { setupServer } from "./server/plugin.ts"; // Custom Vite Plugin for WebSocket backend

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  const plugins = [react()];

  // Only include WebSocket plugin during development
  if (command === 'serve') {
    plugins.push({
      name: 'gemini-websocket-server',
      configureServer(server) {
        if (!server.httpServer) return;
        setupServer(server.httpServer as import("http").Server); 
      }
    });
  }

  return {
    plugins,
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
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      host: "localhost",
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
      middlewareMode: false,
      cors: {
        origin: [
          "localhost",
          "127.0.0.1",
          "https://genie-voice.duckdns.org",
          "https://genie-voice.duckdns.org/",
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      },
      hmr: {
        host: "genie-voice.duckdns.org",
        protocol: "wss",
        port: 443,
      },
    },
    preview: {
      port: 5173,
      host: "localhost",
    },
  };
});
