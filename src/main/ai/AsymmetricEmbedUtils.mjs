/** @deprecated 请使用 EmbedRequestBuilder.mjs；保留 re-export 以兼容现有 import */
export {
  EMBED_INPUT_TYPE,
  TEST_EMBED_IMAGE_B64,
  TEST_EMBED_IMAGE_MIME,
  extractEmbeddingVector,
  isAsymmetricEmbedModel,
  isMultimodalEmbedModel,
  nvidiaEmbedUsesModality,
  resolveImageEmbedInputType,
  supportsImageAsQuery,
  usesNvidiaEmbeddingsApi,
  usesOpenRouterApi
} from './EmbedRequestBuilder.mjs'
