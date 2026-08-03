(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  /** 拉勾详情以 `job_detail`/`job_bt` 为内容边界，右栏公司信息单独取值。 */
  api.registerAdapter({
    id: 'lagou-detail',
    priority: 860,
    matches: () => api.currentPlatform() === 'lagou',
    extract() {
      const root = document.querySelector('#job_detail, .job-detail, .job_bt, .position-content-l') || document
      return api.normalizeCandidate({
        title: api.readText(document, [
          '.position-head-wrap-name',
          '.position-name h1',
          '.job-name h1',
          'main h1',
        ]),
        company: api.readText(document, [
          '.job_company .company-name',
          '.company .company-name',
          '.company-name',
        ]),
        location: api.readText(document, [
          '.position-head-wrap-address',
          '.position-content .location',
          '.job-address',
        ]),
        address: api.readText(document, [
          '.work_addr',
          '.work-address',
          '.position-address',
        ]),
        salary: api.readText(document, [
          '.position-head-wrap-name .salary',
          '.position-name .salary',
          '.job-salary',
        ]),
        skills: api.readList(root, ['.position-label li', '.job-labels span', '.labels li']),
        description: api.readBlock(root, ['.job_bt', '.job-detail__description', '.job-description', '#job_detail']),
        sourceUrl: document.querySelector('link[rel="canonical"]')?.href || location.href,
        sourceId: location.pathname.match(/jobs\/(\d+)/)?.[1] || '',
        platform: 'lagou',
        sourcePlatform: api.platformName('lagou'),
        confidence: 0.93,
        provenance: 'lagou-dom',
      })
    },
  })
})()
