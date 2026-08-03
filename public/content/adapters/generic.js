(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  const DETAIL_SELECTORS = [
    '[itemprop="description"]',
    '[data-testid="job-description"]',
    '.job-description',
    '.job_description',
    '.position-description',
    '.position_detail',
  ]

  /**
   * 严格兜底适配器：仅接受语义明确的详情元素或标题分节。
   * 找不到时直接失败，绝不退化为读取整个 body，因为“少识别一次”比保存错岗位更可靠。
   */
  api.registerAdapter({
    id: 'strict-semantic-fallback',
    priority: 100,
    matches: () => true,
    extract() {
      const description = api.readBlock(document, DETAIL_SELECTORS) || readHeadingSection()
      if (!description) return null
      return api.normalizeCandidate({
        title: api.readText(document, [
          '[itemprop="title"]',
          '[data-testid="job-title"]',
          '.job-title h1',
          '.position-title h1',
          'main h1',
          'article h1',
        ]),
        company: api.readText(document, [
          '[itemprop="hiringOrganization"] [itemprop="name"]',
          '[data-testid="company-name"]',
          '.company-name',
        ]),
        location: api.readText(document, [
          '[itemprop="jobLocation"]',
          '[data-testid="job-location"]',
          '.job-location',
        ]),
        address: api.readText(document, ['[itemprop="streetAddress"]', '.work-address', '.job-address-detail']),
        salary: api.readText(document, ['[itemprop="baseSalary"]', '[data-testid="job-salary"]', '.job-salary']),
        skills: api.readList(document, ['[itemprop="skills"]', '.job-skills span', '.job-tags span']),
        description,
        sourceUrl: document.querySelector('link[rel="canonical"]')?.href || location.href,
        platform: api.currentPlatform(),
        sourcePlatform: api.platformName(),
        confidence: 0.72,
        provenance: 'strict-semantic-dom',
      })
    },
  })

  function readHeadingSection() {
    const heading = [...document.querySelectorAll('h1, h2, h3, h4, [role="heading"]')]
      .find((node) => /^(?:职位描述|岗位描述|职位介绍|岗位职责|工作内容)\s*[:：]?$/.test(api.normalizeInline(node.innerText)))
    if (!heading) return ''

    const chunks = [api.normalizeInline(heading.innerText)]
    let node = heading.nextElementSibling
    while (node && chunks.join('\n').length < 24000) {
      const text = api.normalizeBlock(node.innerText)
      if (/^(?:公司信息|公司介绍|工作地址|职位招聘官|招聘官|相似职位)\s*[:：]?$/.test(text)) break
      if (text) chunks.push(text)
      node = node.nextElementSibling
    }
    return chunks.length > 1 ? chunks.join('\n') : ''
  }
})()
