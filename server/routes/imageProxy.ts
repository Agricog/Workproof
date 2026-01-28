/**
 * Image Proxy Route
 * Proxies images from R2 through authenticated server endpoint
 * Avoids CORS issues and keeps R2 bucket secure
 */
import { Hono } from 'hono'

const imageProxy = new Hono()

// Proxy image from R2
imageProxy.get('/proxy', async (c) => {
  try {
    // Check for authorization header
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401 as const)
    }

    // Get the image URL from query param
    const imageUrl = c.req.query('url')
    
    if (!imageUrl) {
      return c.json({ error: 'Missing url parameter' }, 400 as const)
    }

    // Validate URL is from our R2 bucket only (security check)
    const allowedDomains = [
      'evidence.workproof.co.uk',
      'r2.cloudflarestorage.com',
    ]
    
    let url: URL
    try {
      url = new URL(imageUrl)
    } catch {
      return c.json({ error: 'Invalid URL' }, 400 as const)
    }
    
    const isAllowed = allowedDomains.some(domain => 
      url.hostname.includes(domain)
    )
    
    if (!isAllowed) {
      console.error('[Image Proxy] Blocked request to unauthorized domain:', url.hostname)
      return c.json({ error: 'Unauthorized domain' }, 403 as const)
    }

    // Fetch the image from R2
    const response = await fetch(imageUrl)
    
    if (!response.ok) {
      console.error('[Image Proxy] Failed to fetch image:', response.status, imageUrl)
      return c.json({ error: 'Failed to fetch image' }, 502 as const)
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Return the image with appropriate headers
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      }
    })
  } catch (error) {
    console.error('[Image Proxy] Error:', error)
    return c.json({ error: 'Internal server error' }, 500 as const)
  }
})

export default imageProxy
