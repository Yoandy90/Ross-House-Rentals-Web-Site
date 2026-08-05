import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/admin/',
          '/api/',
          '/tenant/dashboard',
          '/tenant/proveedores',
          '/tenant/utilities',
          '/tenant/forgot-password',
          '/_next/',
          '/automation_output/',
        ],
      },
      {
        // Block aggressive AI/bot scrapers from training on our content
        userAgent: ['GPTBot', 'ClaudeBot', 'CCBot', 'anthropic-ai', 'Google-Extended', 'PerplexityBot', 'Bytespider'],
        disallow: ['/'],
      },
    ],
    sitemap: 'https://www.rosshouserentals.com/sitemap.xml',
    host: 'https://www.rosshouserentals.com',
  }
}
