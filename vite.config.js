import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site at /hanzi-shooter/, so assets need that prefix.
export default defineConfig({
  base: "/hanzi-shooter/",
  plugins: [react()],
});
