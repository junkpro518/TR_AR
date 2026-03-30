import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter (resets on server restart — fine for personal use)
// NOTE: This only works on VPS/Node.js deployments.
// On Cloudflare Workers (stateless), the Map resets per-request so rate limiting
// is a no-op. For Cloudflare protection, use Cloudflare Rate Limiting rules at the edge.
const requests = new Map<string, { count: number; reset: number }>()

// Cleanup expired entries periodically to prevent unbounded Map growth (VPS only)
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes

function cleanupExpiredEntries(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of requests.entries()) {
    if (now > entry.reset) requests.delete(key)
  }
}

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/chat':     { max: 30,  windowMs: 60 * 60 * 1000 },   // 30 chat msgs/hour
  '/api/feedback': { max: 60,  windowMs: 60 * 60 * 1000 },   // 60/hour
  '/api/lesson':   { max: 20,  windowMs: 60 * 60 * 1000 },   // 20 lessons/hour
  '/api/task':     { max: 30,  windowMs: 60 * 60 * 1000 },   // 30 task evals/hour
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const limit = LIMITS[path]

  // Only rate-limit POST requests on configured paths
  if (!limit || request.method !== 'POST') return NextResponse.next()

  // Use IP as key (X-Forwarded-For for Vercel, fallback)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'local'

  const key = `${ip}:${path}`
  const now = Date.now()

  cleanupExpiredEntries(now)

  const entry = requests.get(key)

  if (!entry || now > entry.reset) {
    // New window
    requests.set(key, { count: 1, reset: now + limit.windowMs })
    return NextResponse.next()
  }

  if (entry.count >= limit.max) {
    const retryAfterSec = Math.ceil((entry.reset - now) / 1000)
    return NextResponse.json(
      { error: 'عدد الطلبات تجاوز الحد المسموح. حاول بعد قليل.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(limit.max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(entry.reset),
        },
      }
    )
  }

  entry.count++
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/chat', '/api/feedback', '/api/lesson', '/api/task'],
}
