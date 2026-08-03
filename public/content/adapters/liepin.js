(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  /** 猎聘详情以“职位介绍”内容块为边界，避免把猎头信息和相似职位写进 JD。 */
  api.registerAdapter({
    id: 'liepin-detail',
    priority: 870,
    matches: () => api.currentPlatform() === 'liepin',
    extract() {
      const root = document.querySelector('[data-selector="job-intro-content"], .job-intro-content, .job-apply-content, main') || document
      return api.normalizeCandidate({
        title: api.readText(document, [
          '[data-selector="job-title"]',
          '.job-apply-content .name',
          '.job-title-box h1',
          'main h1',
        ]),
        company: api.readText(document, [
          '[data-selector="company-name"]',
          '.company-card .company-name',
          '.company-name',
        ]),
        location: api.readText(document, [
          '[data-selector="job-address"]',
          '.job-properties .address',
          '.job-apply-content .address',
        ]),
        address: api.readText(document, [
          '.job-address-box .address',
          '.work-address',
          '[data-selector="work-address"]',
        ]),
        salary: api.readText(document, [
          '[data-selector="job-salary"]',
          '.job-apply-content .salary',
          '.job-title-box .salary',
        ]),
        skills: api.readList(root, [
          '.job-labels span',
          '.job-tags span',
          '.labels span',
        ]),
        description: api.readBlock(root, [
          '[data-selector="job-intro-content"]',
          '.job-intro-content',
          '.content-word',
          '.job-description',
        ]),
        sourceUrl: document.querySelector('link[rel="canonical"]')?.href || location.href,
        sourceId: location.pathname.match(/job\/(\d+)/)?.[1] || location.pathname.match(/(\d{8,})/)?.[1] || '',
        platform: 'liepin',
        sourcePlatform: api.platformName('liepin'),
        confidence: 0.94,
        provenance: 'liepin-dom',
      })
    },
  })
})()
