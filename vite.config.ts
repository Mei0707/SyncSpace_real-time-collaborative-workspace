import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiPort = process.env.API_PORT ?? "8787";
const apiHttpTarget = `http://localhost:${apiPort}`;
const apiWsTarget = `ws://localhost:${apiPort}`;

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    proxy: {
      "/api": apiHttpTarget,
      "/collaboration": {
        target: apiWsTarget,
        ws: true,
      },
    },
  },
});
