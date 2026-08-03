(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  const configs = {
    '58': {
      id: '58-detail',
      title: ['.job-title h1', '.pos_title h1', '.position-title h1', 'main h1'],
      company: ['.company-name', '.comp_name', '.company-info h2'],
      location: ['.job-address', '.pos-area', '.address-info'],
      address: ['.address-detail', '.work-address', '.job-address-detail'],
      salary: ['.job-salary', '.pos_salary', '.salary'],
      skills: ['.job-tags span', '.pos_welfare span', '.job-label span'],
      description: ['.job-description', '.posDes', '.pos_description', '.job-detail-content'],
      idPattern: /job\/(\d+)/,
    },
    ganji: {
      id: 'ganji-detail',
      title: ['.new-job-title h1', '.job-title h1', '.title-name', 'main h1'],
      company: ['.company-name', '.company-info-name', '.comp-name'],
      location: ['.job-address', '.job-info .address', '.address-info'],
      address: ['.job-address-detail', '.work-address', '.address-detail'],
      salary: ['.job-salary', '.salary', '.new-job-title .price'],
      skills: ['.job-tags span', '.job-labels span', '.welfare-list span'],
      description: ['.new-job-detail', '.job-description', '.job-detail-content', '.pos-description'],
      idPattern: /(\d{8,})/,
    },
  }

  /**
   * 58 与赶集页面结构相近，但仍按平台保存独立选择器配置。
   * 这里只读取详情块，不使用 body 文本，也不会把相邻推荐岗位拼进来。
   */
  Object.entries(configs).forEach(([platform, config]) => {
    api.registerAdapter({
      id: config.id,
      priority: 840,
      matches: () => api.currentPlatform() === platform,
      extract() {
        return api.normalizeCandidate({
          title: api.readText(document, config.title),
          company: api.readText(document, config.company),
          location: api.readText(document, config.location),
          address: api.readText(document, config.address),
          salary: api.readText(document, config.salary),
          skills: api.readList(document, config.skills),
          description: api.readBlock(document, config.description),
          sourceUrl: document.querySelector('link[rel="canonical"]')?.href || location.href,
          sourceId: location.pathname.match(config.idPattern)?.[1] || '',
          platform,
          sourcePlatform: api.platformName(platform),
          confidence: 0.9,
          provenance: `${platform}-dom`,
        })
      },
    })
  })
})()
