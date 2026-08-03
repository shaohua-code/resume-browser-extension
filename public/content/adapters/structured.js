(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  /**
   * 标准 JobPosting 适配器。
   * JSON-LD 中的标题、公司、地点、薪资和描述属于同一个岗位对象，
   * 因此它是避免“左侧卡片 A + 右侧详情 B”串数据的首选来源。
   */
  api.registerAdapter({
    id: 'structured-job-posting',
    priority: 1000,
    matches: () => true,
    extract() {
      const item = api.chooseStructuredJob(api.collectJobPostings())
      return item ? api.structuredCandidate(item) : null
    },
  })
})()
