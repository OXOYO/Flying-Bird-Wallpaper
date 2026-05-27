import { computed, ref } from 'vue'

/**
 * 合集页悬浮按钮：对齐搜索页可用项（网格尺寸/比例、刷新、返回顶部），不含加载更多/排序/隐私空间等
 */
export function useCollectionFloatingButtons({
  t,
  settingData,
  gridSizeList,
  gridRatioList,
  selectedCollection,
  similarMode,
  isAutoCollection
}) {
  const showFixedBtns = ref(true)

  const fixedBtns = computed(() => {
    const getBottom = () => `${(ret.length - 1) * 60 + 100}px`
    const ret = []

    ret.push({
      action: 'toggleFixedBtns',
      actionParams: [],
      title: t('exploreCommon.toggleFixedBtns'),
      icon: showFixedBtns.value ? 'custom:collapse-all-rounded' : 'custom:expand-all-rounded',
      iconStyle: {},
      style: { bottom: getBottom() }
    })

    if (!showFixedBtns.value) {
      return ret
    }

    if (similarMode.value) {
      ret.push({
        action: 'exitSimilar',
        actionParams: [],
        title: t('pages.Collections.similarBack'),
        icon: 'custom:arrow-back',
        iconStyle: {},
        style: { bottom: getBottom() }
      })
    }

    if (selectedCollection.value) {
      if (!isAutoCollection(selectedCollection.value)) {
        ret.push({
          action: 'onRefresh',
          actionParams: [],
          title: t('pages.Collections.refresh'),
          icon: 'custom:refresh-right',
          iconStyle: {},
          style: { bottom: getBottom() }
        })
      }

      ret.push({
        action: 'addAllFavorites',
        actionParams: [],
        title: t('pages.Collections.addFavorites'),
        icon: 'custom:star',
        iconStyle: {},
        style: { bottom: getBottom() }
      })
    }

    const gridHWRatio = gridRatioList.find(
      (item) => item.value === (settingData.value?.gridHWRatio ?? 0.618)
    )
    ret.unshift({
      action: 'onSwitchGridRatio',
      actionParams: [],
      title: gridHWRatio?.label ?? '',
      icon: gridHWRatio?.icon ?? 'custom:rectangle',
      iconStyle: {},
      style: { bottom: getBottom() },
      children: gridRatioList
    })

    const gridSize = gridSizeList.find((item) => item.value === (settingData.value?.gridSize ?? 'auto'))
    ret.unshift({
      action: 'onSwitchGridSize',
      actionParams: [],
      title: gridSize?.label ?? '',
      alt: gridSize?.alt ?? '',
      icon: gridSize?.icon ?? '',
      iconStyle: {},
      style: { bottom: getBottom() },
      children: gridSizeList
    })

    return ret
  })

  const backtopBtnBottom = computed(() => (fixedBtns.value.length - 1) * 60 + 100)

  const toggleFixedBtns = () => {
    showFixedBtns.value = !showFixedBtns.value
  }

  return {
    showFixedBtns,
    fixedBtns,
    backtopBtnBottom,
    toggleFixedBtns
  }
}
