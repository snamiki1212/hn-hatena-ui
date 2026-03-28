import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  site: "https://snamiki1212.github.io",
  base: "/hn-hatena-ui",
  output: "static",
});
