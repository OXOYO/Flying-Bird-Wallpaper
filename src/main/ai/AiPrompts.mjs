export const buildImageAnalysisPrompt = () => `你是壁纸图像分析助手。请仅输出一个 JSON 对象，不要 markdown 代码块，不要额外说明。
字段要求：
- score: 1-100 整数，美学综合分
- tags: 字符串数组，3-8 个简体中文标签
- title: 简短中文标题，不超过 30 字
- desc: 中文描述，不超过 80 字
- summary: 一句话中文摘要，不超过 50 字
- nsfwLevel: 0-3 整数，0 安全
- safeForWork: 布尔值

示例：{"score":82,"tags":["夜景","城市"],"title":"雨夜都市","desc":"蓝调城市夜景","summary":"适合深色桌面的雨夜城市","nsfwLevel":0,"safeForWork":true}`

export const buildSearchParsePrompt = (query) => `将用户的壁纸搜索描述解析为 JSON，不要 markdown。
用户描述：${query}
输出字段：
- filterKeywords: 字符串，核心关键词
- tags: 字符串数组，可选标签
- orientation: 数组，可选 landscape 或 portrait
- quality: 数组，可选 4k,2k,1080p,720p
- scoreMin: 0-100 整数或 null
- scoreMax: 0-100 整数或 null
- fileType: image 或 video 或空字符串

示例：{"filterKeywords":"海洋","tags":["海洋","蓝色"],"orientation":["landscape"],"quality":["4k"],"scoreMin":70,"scoreMax":null,"fileType":"image"}`

export const buildCollectionQueryPrompt = (prompt) => `用户想创建壁纸智能合集。将描述解析为 queryJson，仅输出 JSON。
用户描述：${prompt}
字段：
- filterKeywords: string
- tags: string[]
- tagsMode: any|all
- orientation: string[]
- quality: string[]
- scoreMin: number|null
- scoreMax: number|null
- resourceName: resources|favorites|local
- isRandom: boolean
- sortField: score|created_at|views
- sortType: -1|1
- semanticQuery: string
- useSemantic: boolean
- limitCount: 5-50 整数`

export const buildKeywordExpandPrompt = (keywords) => `为壁纸自动下载扩展搜索关键词。输入：${JSON.stringify(keywords)}
输出 JSON：{"keywords":["词1","词2"]}，10 个以内，中英可混，不要解释。`

export const buildCollectionMergePrompt = (candidates, targetCount) => {
  const payload = candidates.map((item) => ({
    id: item.id,
    type: item.type,
    count: item.resourceIds.length,
    tags: item.hints?.tags?.slice(0, 8) || [],
    samples: item.hints?.samples?.slice(0, 4) || []
  }))
  return `你是壁纸库策展助手。下面是一批「候选分组」（标签分组 + 向量氛围分组），请合并语义相近的分组，并为每个最终合集起名。

要求：
1. 仅输出 JSON，不要 markdown
2. 最终合集数量不超过 ${targetCount} 个
3. 允许一张壁纸出现在多个合集中（通过合并多个候选 id 实现）
4. 合并相近主题（如「夜景」「城市」「霓虹」→「赛博雨夜都市」）
5. 名称 2-12 个汉字，有氛围感，不要直接用单个泛词
6. mergeIds 必须是输入候选里存在的 id

输入候选：
${JSON.stringify(payload)}

输出格式：
{
  "collections": [
    {
      "name": "合集名称",
      "prompt": "一句话描述氛围",
      "semanticQuery": "用于语义搜索的短语",
      "mergeIds": ["tag:夜景", "vec:0"]
    }
  ]
}`
}
