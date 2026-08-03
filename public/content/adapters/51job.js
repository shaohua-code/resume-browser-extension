(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  /**
   * 前程无忧详情页适配器。
   * `.job-detail .job_msg` 只包含工作内容和任职要求，不读取外围容器，
   * 从源头排除竞争力分析、招聘官、公司卡片和投递按钮。
   */
  api.registerAdapter({
    id: '51job-detail',
    priority: 900,
    matches: () => api.currentPlatform() === '51job',
    extract() {
      const title = api.readText(document, ['.jTitle h1', '.job-header h1', 'main h1'])
      const description = api.readBlock(document, [
        '.job-detail .bmsg.job_msg.inbox',
        '.job-detail .job_msg',
        '.job_msg.inbox',
      ])
      const sourceUrl = document.querySelector('link[rel="canonical"]')?.href || location.href
      return api.normalizeCandidate({
        title,
        company: api.readText(document, [
          '.corp-card .com_name p',
          '.corp-card .com_name',
          '.company-info .company-name',
        ]),
        location: api.readText(document, ['.msg.ltype .type_2', '.jtag .at', '.job-header .location']),
        address: api.readText(document, ['.job-address .fp', '.job-address', '.work-address']),
        salary: api.readText(document, ['.jTitle strong', '.job-header .salary']),
        description,
        sourceUrl,
        sourceId: new URL(sourceUrl, location.href).pathname.match(/\d+/)?.[0] || '',
        platform: '51job',
        sourcePlatform: api.platformName('51job'),
        confidence: 0.96,
        provenance: '51job-dom',
      })
    },
  })
})()
