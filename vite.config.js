import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // GitHub Pages serves this project from /book-reading/. Render serves it at /.
  base: process.env.RENDER ? "/" : "/book-reading/",
  plugins: [react(), tailwindcss()],
});

