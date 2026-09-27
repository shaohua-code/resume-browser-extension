(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  // 热更新重新注入脚本时先卸载旧监听，避免一次点击触发多次识别与收藏。
  globalThis.__aiResumePageAssistant?.dispose?.()

  async function extractCurrentJob() {
    const matching = api.adapters.filter((adapter) => adapter.matches?.())
    const structuredAdapter = matching.find((adapter) => adapter.id === 'structured-job-posting')
    const genericAdapter = matching.find((adapter) => adapter.id === 'strict-semantic-fallback')
    const siteAdapters = matching.filter((adapter) => !['structured-job-posting', 'strict-semantic-fallback'].includes(adapter.id))

    const structured = await safelyExtract(structuredAdapter)
    let site = null
    for (const adapter of siteAdapters) {
      try {
        const candidate = await adapter.extract()
        if (candidate?.title || candidate?.description) {
          site = candidate
          break
        }
      } catch (error) {
        if (error?.blocking) return { ok: false, error: error.message }
      }
    }

    let candidate = api.mergeCandidates(site, structured)
    if (!api.isUsableCandidate(candidate)) {
      const generic = await safelyExtract(genericAdapter)
      candidate = api.mergeCandidates(generic, structured)
    }
    return api.toResponse(candidate)
  }

  async function safelyExtract(adapter) {
    if (!adapter) return null
    try {
      return await adapter.extract()
    } catch {
      return null
    }
  }

  let observer = null
  let autoCaptureTimer = null
  let locationTimer = null
  let pollingTimer = null
  let lastUrl = location.href
  let lastFingerprint = ''

  function jobFingerprint(job) {
    const text = String(job?.jdText || '').replace(/\s+/g, ' ').slice(0, 800)
    return [job?.sourceUrl, job?.sourceTitle, job?.company, text].join('|')
  }

  function scheduleAutomaticRecognition(delay = 1000) {
    clearTimeout(autoCaptureTimer)
    autoCaptureTimer = setTimeout(async () => {
      const response = await extractCurrentJob().catch(() => null)
      if (!response?.ok) return
      const fingerprint = jobFingerprint(response.job)
      if (!fingerprint || fingerprint === lastFingerprint) return
      lastFingerprint = fingerprint
      chrome.runtime.sendMessage({
        type: 'AUTO_DETECTED_JOB',
        job: response.job,
        visible: document.visibilityState === 'visible',
      }).catch(() => {})
    }, delay)
  }

  function observeJobChanges() {
    // The initial delay gives asynchronous job-detail components time to render.
    scheduleAutomaticRecognition(1400)
    observer = new MutationObserver(() => scheduleAutomaticRecognition())
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
    locationTimer = window.setInterval(() => {
      if (location.href === lastUrl) return
      lastUrl = location.href
      lastFingerprint = ''
      scheduleAutomaticRecognition(500)
    }, 700)
    // Some recruitment sites replace detail content without a route transition
    // and without a reliable mutation on the main container. This is a quiet
    // fallback; fingerprints prevent duplicate side-panel updates.
    pollingTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') scheduleAutomaticRecognition(350)
    }, 3500)
  }

  const messageListener = (message, sender, sendResponse) => {
    if (message?.type === 'EXTRACT_JOB') {
      extractCurrentJob().then(sendResponse).catch((error) => sendResponse({
        ok: false,
        error: error?.message || '暂时无法读取当前岗位',
      }))
      return true
    }
    if (message?.type === 'AUTOFILL_FORM') {
      sendResponse(api.actions?.fillForm(message.profile || {}) || { ok: false, error: '页面动作模块未加载' })
    }
    if (message?.type === 'DELIVER_JOB') {
      sendResponse(api.actions?.deliverJob(message.profile || {}) || { ok: false, error: '页面动作模块未加载' })
    }
    return false
  }

  chrome.runtime.onMessage.addListener(messageListener)
  observeJobChanges()
  globalThis.__aiResumePageAssistant = {
    dispose() {
      chrome.runtime.onMessage.removeListener(messageListener)
      observer?.disconnect()
      clearTimeout(autoCaptureTimer)
      clearInterval(locationTimer)
      clearInterval(pollingTimer)
    },
  }
})()
