(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  /**
   * 应届生求职网会转载企业或其他招聘平台职位，`sourceOriginal` 单独记录，
   * 页面网址仍保留为可返回的实际来源地址。
   */
  api.registerAdapter({
    id: 'yingjiesheng-detail',
    priority: 850,
    matches: () => api.currentPlatform() === 'yingjiesheng',
    extract() {
      return api.normalizeCandidate({
        title: api.readText(document, ['.job-title h1', '.job_name', '.job-header h1', 'main h1', 'article h1']),
        company: api.readText(document, ['.company-name', '.job-company', '.company_info h2', '.job-info-company']),
        location: api.readText(document, ['.jobarea', '.job-area', '.job-info .location', '.work-place']),
        address: api.readText(document, ['.work-address', '.job-address', '.address-detail']),
        salary: api.readText(document, ['.job-salary', '.salary', '.job-info .money']),
        skills: api.readList(document, ['.job-tags span', '.keyword-list span', '.job-keywords a']),
        description: api.readBlock(document, ['.jobintro', '.job-detail', '.job_description', '.job-content']),
        sourceUrl: document.querySelector('link[rel="canonical"]')?.href || location.href,
        sourceId: location.pathname.match(/job[-/](?:00)?(\d[\d-]+)/)?.[1] || '',
        sourceOriginal: readOriginalSource(),
        platform: 'yingjiesheng',
        sourcePlatform: api.platformName('yingjiesheng'),
        confidence: 0.92,
        provenance: 'yingjiesheng-dom',
      })
    },
  })

  function readOriginalSource() {
    const explicit = api.readText(document, ['.job-source', '.source-name', '[class*="job-source"]'])
    if (explicit) return explicit.replace(/^来源\s*[:：]?\s*/, '')
    const infoText = api.readText(document, ['.job-info', '.job-meta'])
    return infoText.match(/来源\s*[:：]\s*([^|｜\n]{2,30})/)?.[1]?.trim() || ''
  }
})()
