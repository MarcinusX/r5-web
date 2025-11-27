// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Odkomentuj poniższe linie przed deploy na GitHub Pages:
  // site: 'https://yourusername.github.io',
  // base: '/retkinska-piatka',
  vite: {
    plugins: [tailwindcss()]
  }
});
