import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/config/site';

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/overlay/') && !page.includes('/redaktion'),
    }),
  ],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  build: {
    format: 'directory',
  },
  redirects: {
    '/kontakt/': '/informant-werden/',
    '/themen/': '/videos/',
    '/themen/gesellschaft/': '/videos/',
    '/themen/wirtschaft/': '/videos/',
    '/themen/medien/': '/videos/',
    '/themen/politik/': '/videos/',
  },
});
