export const COLLECTION_PICKER_TAB_ALL = 'all'
export const COLLECTION_PICKER_TAB_AUTO = 'auto'
export const COLLECTION_PICKER_TAB_USER = 'user'
export const COLLECTION_PICKER_TAB_FOR_YOU = 'for_you'

export const FOR_YOU_VIRTUAL_ID = '__for_you__'

export function isForYouVirtualItem(item) {
  return item?.id === FOR_YOU_VIRTUAL_ID || item?.source === 'for_you'
}

export function buildForYouPickerItem({ title, count = 0 }) {
  return {
    id: FOR_YOU_VIRTUAL_ID,
    name: title,
    itemCount: Math.max(0, Number(count) || 0),
    source: 'for_you',
    isVirtual: true
  }
}

export function normalizeCollectionPickerQuery(query) {
  return String(query ?? '').trim().toLowerCase()
}

export function collectionMatchesPickerQuery(item, query) {
  if (isForYouVirtualItem(item)) return true
  const q = normalizeCollectionPickerQuery(query)
  if (!q) return true
  return String(item?.name ?? '').toLowerCase().includes(q)
}

export function collectionMatchesPickerTab(item, tab, { isAutoCollection }) {
  if (tab === COLLECTION_PICKER_TAB_FOR_YOU) return isForYouVirtualItem(item)
  if (isForYouVirtualItem(item)) return false
  if (tab === COLLECTION_PICKER_TAB_AUTO) return isAutoCollection(item)
  if (tab === COLLECTION_PICKER_TAB_USER) return item && !isAutoCollection(item)
  return true
}

export function filterCollectionsForPicker(collections, { query = '', tab = COLLECTION_PICKER_TAB_ALL, isAutoCollection }) {
  return (collections || []).filter(
    (item) =>
      collectionMatchesPickerQuery(item, query) &&
      collectionMatchesPickerTab(item, tab, { isAutoCollection })
  )
}

/**
 * @param {Array} collections
 * @param {{
 *   query?: string,
 *   tab?: string,
 *   isAutoCollection: (item: any) => boolean,
 *   sectionAutoLabel: string,
 *   sectionUserLabel: string,
 *   forYouItem?: object|null,
 *   forYouSectionLabel?: string
 * }} options
 */
export function buildCollectionPickerGroups(collections, options) {
  const {
    query = '',
    tab = COLLECTION_PICKER_TAB_ALL,
    isAutoCollection,
    sectionAutoLabel,
    sectionUserLabel,
    forYouItem = null,
    forYouSectionLabel = ''
  } = options

  if (tab === COLLECTION_PICKER_TAB_FOR_YOU) {
    if (!forYouItem) return []
    return [{ key: 'for_you', title: '', items: [forYouItem], hideTitle: true }]
  }

  const filtered = filterCollectionsForPicker(collections, { query, tab, isAutoCollection })
  const groups = []

  const showForYou = forYouItem && tab === COLLECTION_PICKER_TAB_ALL && collectionMatchesPickerQuery(forYouItem, query)

  if (showForYou) {
    groups.push({
      key: 'for_you',
      title: forYouSectionLabel || '',
      items: [forYouItem],
      hideTitle: !forYouSectionLabel
    })
  }

  if (tab === COLLECTION_PICKER_TAB_ALL) {
    const auto = filtered.filter(isAutoCollection)
    const user = filtered.filter((item) => !isAutoCollection(item))
    if (auto.length) {
      groups.push({ key: 'auto', title: sectionAutoLabel, items: auto })
    }
    if (user.length) {
      groups.push({ key: 'user', title: sectionUserLabel, items: user })
    }
    return groups
  }

  if (filtered.length) {
    const title = tab === COLLECTION_PICKER_TAB_AUTO ? sectionAutoLabel : sectionUserLabel
    groups.push({ key: tab, title: '', items: filtered, hideTitle: true })
  }
  return groups
}
