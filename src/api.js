import { getOriginCandidates, getPreferredOrigin } from './origins'

const API_ORIGINS = getOriginCandidates(import.meta.env.VITE_API_ORIGIN, 'http://localhost:8000')
const SERVICE_UNAVAILABLE = '服务暂时不可用'

export async function getBootstrap(session) {
  return request('/api/extension/bootstrap', { session })
}

export async function estimateRun(session, payload) {
  return request('/api/extension/runs/estimate', { method: 'POST', session, body: payload })
}

export async function streamRun(session, payload, handlers = {}) {
  const response = await fetchWithFallback('/api/extension/runs/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(payload),
    signal: handlers.signal,
  })
  if (!response.ok || !response.body) {
    throw new Error((await response.json().catch(() => ({}))).detail || SERVICE_UNAVAILABLE)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() || ''
    blocks.forEach((block) => {
      block.split('\n')
        .filter((line) => line.startsWith('data:'))
        .forEach((line) => {
          try {
            handlers.onEvent?.(JSON.parse(line.slice(5).trim()))
          } catch {
            // Wait for the next chunk when the server-side event is incomplete.
          }
        })
    })
  }
}

export async function getApiBase() {
  return getPreferredOrigin(import.meta.env.VITE_API_ORIGIN, 'http://localhost:8000')
}

export async function exchangeExtensionCode(code) {
  return request('/api/extension/auth/exchange', { method: 'POST', body: { code } })
}

export async function getAutofillData(session, resumeId) {
  return request(`/api/extension/resumes/${encodeURIComponent(resumeId)}/autofill`, { session })
}

export async function analyzeJob(session, { resumeId, jdText }) {
  return request('/api/ai/match', {
    method: 'POST',
    session,
    body: { resume_id: resumeId, jd_text: jdText },
  })
}

export async function saveJob(session, payload) {
  return request('/api/extension/jobs', { method: 'POST', session, body: payload })
}

export async function getSavedJobs(session) {
  return request('/api/extension/jobs', { session })
}

export async function deleteSavedJob(session, jobId) {
  return request(`/api/extension/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE', session })
}

async function request(path, { method = 'GET', session, body } = {}) {
  const response = await fetchWithFallback(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || SERVICE_UNAVAILABLE)
  return data.data || data
}

async function fetchWithFallback(path, options) {
  let lastError = null
  for (const origin of API_ORIGINS) {
    try {
      return await fetch(`${origin}${path}`, options)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Failed to fetch')
}
