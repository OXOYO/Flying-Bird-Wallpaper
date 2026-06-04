import { ref } from 'vue'
import { fireRecordPreviewView } from '@common/favoriteResourceUtils.js'

/** H5 preview 打开/切图时记录 views，同一会话内同一张去重 */
export function usePreviewViewStat({ list, resolveListIndexFromPreviewIndex, recordViewApi }) {
  const lastRecordedListIdx = ref(-1)

  const resetPreviewViewStat = () => {
    lastRecordedListIdx.value = -1
  }

  const recordViewForPreviewIndex = async (previewIndex) => {
    const listIdx = resolveListIndexFromPreviewIndex(previewIndex)
    if (listIdx < 0) return
    if (listIdx === lastRecordedListIdx.value) return
    lastRecordedListIdx.value = listIdx
    const item = list.value[listIdx]
    if (!item) return
    await fireRecordPreviewView(recordViewApi, item)
  }

  return { resetPreviewViewStat, recordViewForPreviewIndex }
}
