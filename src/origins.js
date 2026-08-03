function normalizeOrigin(value, fallback = '') {
  const raw = String(value || fallback || '').trim()
  if (!raw) return ''
  try {
    return new URL(raw).origin
  } catch {
    return String(fallback || '').trim().replace(/\/$/, '')
  }
}

function swapWww(origin) {
  try {
    const url = new URL(origin)
    if (url.hostname === 'aijianli.tech') {
      url.hostname = 'www.aijianli.tech'
      return url.origin
    }
    if (url.hostname === 'www.aijianli.tech') {
      url.hostname = 'aijianli.tech'
      return url.origin
    }
  } catch {
    return ''
  }
  return ''
}

export function getOriginCandidates(primary, fallback = '') {
  const base = normalizeOrigin(primary, fallback)
  const alternate = swapWww(base)
  return [...new Set([base, alternate].filter(Boolean))]
}

export function getPreferredOrigin(primary, fallback = '') {
  return getOriginCandidates(primary, fallback)[0] || normalizeOrigin(fallback)
}
