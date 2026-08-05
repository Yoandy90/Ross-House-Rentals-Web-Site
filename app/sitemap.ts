import { MetadataRoute } from 'next'

const BASE = 'https://www.rosshouserentals.com'

interface PublicProperty {
  id: string
  status?: string
  city?: string
  state?: string
}

async function fetchProperties(): Promise<PublicProperty[]> {
  try {
    // ISR-friendly: revalidate daily
    const res = await fetch(`${BASE}/api/public/properties`, { next: { revalidate: 86400 } })
    if (!res.ok) return []
    const data = await res.json()
    return (data.properties || []) as PublicProperty[]
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Public marketing pages
  const marketing: MetadataRoute.Sitemap = [
    { url: `${BASE}`,                 changeFrequency: 'weekly',  priority: 1.0, lastModified: now },
    { url: `${BASE}/propiedades`,     changeFrequency: 'daily',   priority: 0.95, lastModified: now },
    { url: `${BASE}/invest`,          changeFrequency: 'weekly',  priority: 0.9, lastModified: now },
    { url: `${BASE}/proveedores`,     changeFrequency: 'weekly',  priority: 0.8, lastModified: now },
    { url: `${BASE}/proveedores/en`,  changeFrequency: 'weekly',  priority: 0.7, lastModified: now },
    { url: `${BASE}/interesados`,     changeFrequency: 'weekly',  priority: 0.8, lastModified: now },
    { url: `${BASE}/interesados/en`,  changeFrequency: 'weekly',  priority: 0.7, lastModified: now },
  ]

  // Dynamic property detail pages
  const props = await fetchProperties()
  const propertyEntries: MetadataRoute.Sitemap = props.map((p) => ({
    url: `${BASE}/propiedades/${p.id}`,
    changeFrequency: 'weekly' as const,
    priority: p.status === 'available' ? 0.85 : 0.4,
    lastModified: now,
  }))

  // Tenant portal entry (login)
  const tenantEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/tenant`,         changeFrequency: 'monthly', priority: 0.6, lastModified: now },
  ]

  // Legal pages (ES + EN)
  const legal: MetadataRoute.Sitemap = [
    { url: `${BASE}/privacy-policy`,    changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: `${BASE}/privacy-policy/es`, changeFrequency: 'monthly', priority: 0.4, lastModified: now },
    { url: `${BASE}/terms`,             changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: `${BASE}/cookies`,           changeFrequency: 'monthly', priority: 0.4, lastModified: now },
    { url: `${BASE}/faq`,               changeFrequency: 'monthly', priority: 0.5, lastModified: now },
  ]

  return [...marketing, ...propertyEntries, ...tenantEntries, ...legal]
}
