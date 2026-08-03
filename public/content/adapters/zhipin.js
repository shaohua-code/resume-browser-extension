(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  /**
   * BOSS 直聘使用单页应用切换岗位。点击左侧卡片后，卡片先变为 active，
   * 右侧详情稍后才更新；只有两侧标题一致时才允许读取，防止保存成混合岗位。
   */
  api.registerAdapter({
    id: 'zhipin-current-job',
    priority: 950,
    matches: () => api.currentPlatform() === 'zhipin',
    async extract() {
      let snapshot = null
      for (let attempt = 0; attempt < 10; attempt += 1) {
        snapshot = readSnapshot()
        if (snapshot.title && !snapshot.mismatch && snapshot.description.length >= 40) return snapshot
        if (attempt < 9) await api.wait(140)
      }

      const error = new Error(snapshot?.mismatch
        ? '岗位详情正在切换，请等待右侧详情更新后再识别'
        : '未读取到 BOSS 当前岗位详情，请先点击一个岗位并等待详情加载完成')
      error.blocking = true
      throw error
    },
  })

  function readSnapshot() {
    const detailRoot = document.querySelector('.job-detail-container .job-detail-box, .job-detail-box, .job-detail-container, .job-detail-wrapper')
    const activeCard = document.querySelector('.job-card-wrap.active, .job-card-wrapper.active, .job-list-box [class*="job-card"][class*="active"]')
    const detailTitle = api.readText(detailRoot || document, [
      '.job-detail-info .job-name',
      '.job-detail-header .job-name',
      '.job-banner .name h1',
      '.job-primary .info-primary .name h1',
      'h1.job-name',
    ])
    const cardTitle = api.readText(activeCard, ['.job-title .job-name', 'a.job-name', '.job-name'])
    const title = detailTitle || cardTitle
    const mismatch = Boolean(detailTitle && cardTitle && !api.sameJobTitle(detailTitle, cardTitle))
    const company = readCompany(activeCard, detailRoot)
    const sourceLink = activeCard?.querySelector('a.job-name[href], a[href*="job_detail"], a[href*="job/"]')?.href
    const headerTags = api.readList(detailRoot || document, [
      '.job-detail-header .tag-list li',
      '.job-detail-info .tag-list li',
      '.job-primary .tag-list li',
    ])

    const candidate = api.normalizeCandidate({
      title,
      company,
      location: cleanLocation(api.readText(detailRoot || document, [
        '.job-detail-info .job-location',
        '.job-detail-header .job-location',
        '.job-primary .location-address',
      ]) || headerTags[0] || api.readText(activeCard, ['.job-area', '.company-location'])),
      address: api.readText(detailRoot || document, ['.job-address .job-address-desc', '.job-address-desc']),
      salary: api.readText(detailRoot || document, [
        '.job-detail-info .job-salary',
        '.job-detail-header .job-salary',
        '.job-primary .salary',
      ]) || api.readText(activeCard, ['.salary', '.job-salary']),
      skills: api.readList(detailRoot || document, [
        '.job-detail-body .job-label-list li',
        '.job-detail-box .job-label-list li',
        '.job-label-list li',
      ]),
      description: api.readBlock(detailRoot || document, [
        '.job-detail-body .desc',
        '.job-detail-body .job-sec-text',
        '.job-detail-section .job-sec-text',
        '.job-sec-text',
      ]),
      sourceUrl: sourceLink || location.href,
      sourceId: sourceLink?.match(/job_detail\/([^/?]+)/)?.[1] || '',
      platform: 'zhipin',
      sourcePlatform: api.platformName('zhipin'),
      confidence: mismatch ? 0 : 0.97,
      provenance: 'zhipin-active-detail',
    })
    return { ...candidate, mismatch }
  }

  function readCompany(card, detailRoot) {
    const fromCard = api.readText(card, [
      '.job-card-footer .company-name',
      '.job-card-footer .boss-name',
      '.company-name',
      '.boss-name',
    ])
    if (fromCard) return fromCard

    const fromDetail = api.readText(detailRoot || document, [
      '.job-detail-company .company-name',
      '.job-company-info .company-name',
      '.sider-company .company-name',
      '.company-info-box .company-name',
      '.company-card .company-name',
    ])
    if (fromDetail) return fromDetail

    // 新版详情只显示“公司 · 招聘官职位”时，明确按分隔符取公司部分。
    const recruiterAffiliation = api.readText(detailRoot || document, ['.job-boss-info .boss-info-attr'])
    return api.normalizeInline(recruiterAffiliation.split(/[·・]/)[0])
  }

  function cleanLocation(value) {
    return api.normalizeInline(value).split(/[·・]/)[0]
  }
})()
