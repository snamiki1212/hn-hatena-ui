import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://snamiki1212.github.io",
  base: "/hn-hatena-ui",
  output: "static",
  integrations: [react()],
});
