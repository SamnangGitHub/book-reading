import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Use the repository subpath only for production GitHub Pages builds.
  // Vite's dev server is opened at /, so a subpath here makes the app entry 404.
  base: process.env.RENDER || process.env.NODE_ENV !== "production" ? "/" : "/book-reading/",
  plugins: [react(), tailwindcss()],
});
