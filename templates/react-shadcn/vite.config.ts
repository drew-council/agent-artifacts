import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
	plugins: [react(), viteSingleFile()],
	resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
	build: { assetsInlineLimit: Number.MAX_SAFE_INTEGER, sourcemap: false },
});
