(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  /** 智联招聘详情页只读取职位主体，不读取右侧公司与推荐职位列表。 */
  api.registerAdapter({
    id: 'zhaopin-detail',
    priority: 880,
    matches: () => api.currentPlatform() === 'zhaopin',
    extract() {
      const root = document.querySelector('.job-detail, .job-detail-content, .position-detail, main') || document
      return api.normalizeCandidate({
        title: api.readText(document, [
          '.job-summary__title',
          '.summary-plane__title',
          '.job-header__title',
          'h1.job-name',
          'main h1',
        ]),
        company: api.readText(document, [
          '.company__title',
          '.company-info__name',
          '.company-name',
          '[class*="company"] h2',
        ]),
        location: api.readText(document, [
          '.job-summary__address',
          '.summary-plane__info li:first-child',
          '.job-address__content',
        ]),
        address: api.readText(document, [
          '.job-address__content',
          '.job-address',
          '[class*="work-address"]',
        ]),
        salary: api.readText(document, [
          '.job-summary__salary',
          '.summary-plane__salary',
          '.job-banner__title__salary',
          '.job-salary',
        ]),
        skills: api.readList(root, [
          '.job-keyword__list li',
          '.job-tags span',
          '.summary-plane__info-tag',
        ]),
        description: api.readBlock(root, [
          '.describtion__detail-content',
          '.job-detail__content',
          '.job-description',
          '.pos-ul',
        ]),
        sourceUrl: document.querySelector('link[rel="canonical"]')?.href || location.href,
        sourceId: location.pathname.match(/[A-Z0-9]{8,}/i)?.[0] || '',
        platform: 'zhaopin',
        sourcePlatform: api.platformName('zhaopin'),
        confidence: 0.94,
        provenance: 'zhaopin-dom',
      })
    },
  })
})()
