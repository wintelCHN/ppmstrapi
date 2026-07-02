/**
 * SSRF-safe URL validation for server-side image fetching.
 *
 * Only allows public HTTP(S) URLs and blocks private/reserved networks,
 * localhost, and link-local/metadata endpoints.
 */

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length === 4) {
    const [a, b, c, d] = parts.map(Number)
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) {
      return true
    }
    // 127.0.0.0/8
    if (a === 127) return true
    // 10.0.0.0/8
    if (a === 10) return true
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true
    // 0.0.0.0/8
    if (a === 0) return true
    // Broadcast/multicast/reserved
    if (a >= 224) return true
    return false
  }

  // IPv6 rough checks
  const lower = ip.toLowerCase()
  if (lower.startsWith('::') || lower.startsWith('fc') || lower.startsWith('fd')) {
    return true
  }
  if (lower.startsWith('fe80')) return true
  if (lower === '::1') return true

  return false
}

export function isSafeImageUrl(url: string): boolean {
  if (typeof url !== 'string') return false
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  const hostname = parsed.hostname.toLowerCase()
  if (!hostname || BLOCKED_HOSTS.has(hostname)) return false

  // Block IPv4 literals
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) && isPrivateIp(hostname)) return false

  // Block IPv6 literals
  if (/^\[?[\da-fA-F:]+\]?$/.test(hostname)) {
    const raw = hostname.replace(/^\[|\]$/g, '')
    if (isPrivateIp(raw)) return false
  }

  // Block cloud metadata endpoints
  if (hostname === '169.254.169.254') return false
  if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false

  return true
}
