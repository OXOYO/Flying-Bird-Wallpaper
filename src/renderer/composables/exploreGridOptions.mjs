/** 与 ExploreCommon 一致的网格尺寸 / 宽高比选项 */
export function buildGridSizeList(t) {
  return [
    { label: t('gridSizeList.label.auto'), alt: t('gridSizeList.alt.auto'), value: 'auto', icon: '' },
    {
      label: t('gridSizeList.label.size', { size: 1 }),
      alt: t('gridSizeList.alt.size', { size: 1 }),
      value: 1,
      icon: ''
    },
    {
      label: t('gridSizeList.label.size', { size: 2 }),
      alt: t('gridSizeList.alt.size', { size: 2 }),
      value: 2,
      icon: ''
    },
    {
      label: t('gridSizeList.label.size', { size: 4 }),
      alt: t('gridSizeList.alt.size', { size: 4 }),
      value: 4,
      icon: ''
    },
    {
      label: t('gridSizeList.label.size', { size: 6 }),
      alt: t('gridSizeList.alt.size', { size: 6 }),
      value: 6,
      icon: ''
    },
    {
      label: t('gridSizeList.label.size', { size: 8 }),
      alt: t('gridSizeList.alt.size', { size: 8 }),
      value: 8,
      icon: ''
    }
  ]
}

export function buildGridRatioList(t) {
  return [
    { label: t('gridRatioList.square'), value: 1, icon: 'custom:square' },
    {
      label: t('gridRatioList.rectangle'),
      value: 0.618,
      icon: 'custom:rectangle'
    },
    {
      label: t('gridRatioList.verticalRectangle'),
      value: 1.618,
      icon: 'custom:rectangle-one'
    }
  ]
}
