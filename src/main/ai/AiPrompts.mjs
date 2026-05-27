import { t } from '../../i18n/server.js'

export const buildImageAnalysisPrompt = () => t('ai.prompts.imageAnalysis')

export const buildSearchParsePrompt = (query) => t('ai.prompts.searchParse', { query })

export const buildCollectionQueryPrompt = (prompt) => t('ai.prompts.collectionQuery', { prompt })

export const buildKeywordExpandPrompt = (keywords) =>
  t('ai.prompts.keywordExpand', { keywords: JSON.stringify(keywords) })

export const buildCollectionMergePrompt = (candidates, targetCount) => {
  const payload = candidates.map((item) => ({
    id: item.id,
    type: item.type,
    count: item.resourceIds.length,
    tags: item.hints?.tags?.slice(0, 8) || [],
    samples: item.hints?.samples?.slice(0, 4) || []
  }))
  return t('ai.prompts.collectionMerge', {
    targetCount,
    candidates: JSON.stringify(payload)
  })
}
