// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://retkinskapiatka.pl',
  base: '/',
  redirects: {
    '/wolontariat': 'https://forms.gle/bxSCr4jwEUPeNzv38'
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
