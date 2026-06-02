export const COLLECTION_PICKER_TAB_ALL = 'all'
export const COLLECTION_PICKER_TAB_AUTO = 'auto'
export const COLLECTION_PICKER_TAB_USER = 'user'

export function normalizeCollectionPickerQuery(query) {
  return String(query ?? '').trim().toLowerCase()
}

export function collectionMatchesPickerQuery(item, query) {
  const q = normalizeCollectionPickerQuery(query)
  if (!q) return true
  return String(item?.name ?? '').toLowerCase().includes(q)
}

export function collectionMatchesPickerTab(item, tab, { isAutoCollection }) {
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
 * @param {{ query?: string, tab?: string, isAutoCollection: (item: any) => boolean, sectionAutoLabel: string, sectionUserLabel: string }} options
 */
export function buildCollectionPickerGroups(collections, options) {
  const {
    query = '',
    tab = COLLECTION_PICKER_TAB_ALL,
    isAutoCollection,
    sectionAutoLabel,
    sectionUserLabel
  } = options

  const filtered = filterCollectionsForPicker(collections, { query, tab, isAutoCollection })
  const groups = []

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
