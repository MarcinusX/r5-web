// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

const isProduction = process.env.NODE_ENV === 'production';

// https://astro.build/config
export default defineConfig({
  site: 'https://MarcinusX.github.io',
  base: isProduction ? '/r5-web/' : '/',
  vite: {
    plugins: [tailwindcss()]
  }
});
