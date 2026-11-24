const API_BASE_URL = 'https://kicksapi.com/api/v1'
const API_KEY = import.meta.env.VITE_SNEAKER_API_KEY
const SEARCH_PATH = '/sneakers/search'
const TIMEOUT_MS = 12000

export class SneakerApiError extends Error {
  constructor(message, kind = 'error') {
    super(message)
    this.name = 'SneakerApiError'
    this.kind = kind
  }
}

function pick(source, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => (current == null ? undefined : current[key]), source)
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0]
      if (typeof first === 'string' && first.trim()) return first.trim()
      if (first && typeof first === 'object') {
        const nested = pick(first, ['url', 'src', 'imageUrl', 'image_url', 'original', 'large'])
        if (nested) return nested
      }
    }
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function stripHtml(text) {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function listFrom(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  const candidates = ['data', 'results', 'products', 'items', 'sneakers', 'hits']
  for (const key of candidates) {
    const value = payload[key]
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object') {
      const nested = listFrom(value)
      if (nested.length) return nested
    }
  }
  return []
}

export function normalizeProduct(raw, index = 0) {
  const brand = pick(raw, ['brand', 'brand_name', 'brandName', 'brand.name', 'make'])
  const fullName = pick(raw, ['name', 'title', 'shoeName', 'shoe_name', 'model', 'product_name', 'productName'])
  let model = pick(raw, ['model', 'silhouette', 'shoe']) || fullName
  if (brand && model.toLowerCase().startsWith(`${brand.toLowerCase()} `)) {
    model = model.slice(brand.length + 1)
  }
  const product = {
    apiId: pick(raw, ['id', 'uuid', 'slug', 'product_id', 'productId', 'sku', 'styleID']) || `result-${index}`,
    brand,
    model: fullName && fullName.toLowerCase() !== brand.toLowerCase() ? model || fullName : model,
    name: fullName || [brand, model].filter(Boolean).join(' '),
    sku: pick(raw, ['sku', 'styleID', 'style_id', 'styleId', 'style_code', 'styleCode', 'mpn']),
    colorway: pick(raw, ['colorway', 'colorWay', 'color_way', 'colour', 'color', 'colors']),
    image: pick(raw, [
      'image',
      'image_url',
      'imageUrl',
      'thumbnail',
      'thumbnail_url',
      'main_picture_url',
      'media.imageUrl',
      'media.smallImageUrl',
      'images',
      'gallery',
      'imageLinks',
    ]),
    description: stripHtml(pick(raw, ['description', 'story', 'desc', 'details', 'summary'])),
    retailPrice: Number(pick(raw, ['retail_price', 'retailPrice', 'price', 'retail', 'min_price'])) || null,
    releaseDate: pick(raw, ['release_date', 'releaseDate', 'released_at']),
  }
  product.missing = ['brand', 'model', 'colorway', 'image', 'description'].filter((field) => !product[field])
  return product
}

export async function searchSneakers(query, { signal, limit = 12 } = {}) {
  const text = query.trim()
  if (text.length < 2) {
    throw new SneakerApiError('Type at least 2 characters to search.', 'validation')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), TIMEOUT_MS)
  signal?.addEventListener('abort', () => controller.abort(signal.reason))
  const params = new URLSearchParams({ query: text, q: text, limit: String(limit) })

  let response
  try {
    response = await fetch(`${API_BASE_URL}${SEARCH_PATH}?${params}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      signal: controller.signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    if (controller.signal.aborted) {
      throw new SneakerApiError('The sneaker API took too long to respond. Please try again.', 'timeout')
    }
    throw new SneakerApiError('Could not reach the sneaker API. Check your internet connection and try again.', 'network')
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 401 || response.status === 403) {
    throw new SneakerApiError('The sneaker API rejected the API key. Check VITE_SNEAKER_API_KEY in frontend/.env.local.', 'auth')
  }
  if (response.status === 429) {
    throw new SneakerApiError('Too many searches in a short time. Wait a minute and try again.', 'rate-limit')
  }
  if (!response.ok) {
    throw new SneakerApiError(`The sneaker API returned an error (${response.status}). Please try again.`, 'server')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new SneakerApiError('The sneaker API sent a response Veyra could not read.', 'parse')
  }

  return listFrom(payload)
    .map(normalizeProduct)
    .filter((product) => product.name || product.sku)
    .slice(0, limit)
}

export async function findSneakerImage(sku, { signal } = {}) {
  if (!sku) return ''
  const results = await searchSneakers(sku, { signal, limit: 5 })
  const exact = results.find((product) => product.sku && product.sku.toLowerCase() === sku.toLowerCase())
  return (exact || results[0])?.image || ''
}
