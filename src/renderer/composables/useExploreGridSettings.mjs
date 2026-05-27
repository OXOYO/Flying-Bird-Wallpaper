import { buildGridRatioList, buildGridSizeList } from './exploreGridOptions.mjs'

/** 更新设置并触发网格重算（合集 / 搜索等共用） */
export function useExploreGridSettings({ t, settingStore, settingData, cardBlockRef, measureAndApply }) {
  const gridSizeList = buildGridSizeList(t)
  const gridRatioList = buildGridRatioList(t)

  const persistGridSettings = async (patch) => {
    const res = await window.FBW.updateSettingData({
      gridSize: settingData.value?.gridSize ?? 'auto',
      gridHWRatio: settingData.value?.gridHWRatio ?? 0.618,
      ...patch
    })
    if (res?.success) {
      settingStore.updateSettingData(res.data)
    }
    await measureAndApply?.()
  }

  const onSwitchGridRatio = async (childVal) => {
    let next = childVal
    if (next === undefined) {
      const current = settingData.value?.gridHWRatio ?? 0.618
      const index = gridRatioList.findIndex((item) => item.value === current)
      next = gridRatioList[(index + 1) % gridRatioList.length].value
    }
    if (next === settingData.value?.gridHWRatio) return
    await persistGridSettings({ gridHWRatio: next })
  }

  const onSwitchGridSize = async (childVal) => {
    let next = childVal
    if (next === undefined) {
      const current = settingData.value?.gridSize ?? 'auto'
      const index = gridSizeList.findIndex((item) => item.value === current)
      next = gridSizeList[(index + 1) % gridSizeList.length].value
    }
    if (next === settingData.value?.gridSize) return
    await persistGridSettings({ gridSize: next })
  }

  return {
    gridSizeList,
    gridRatioList,
    onSwitchGridSize,
    onSwitchGridRatio
  }
}
