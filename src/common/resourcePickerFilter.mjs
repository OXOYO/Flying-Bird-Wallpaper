export const RESOURCE_PICKER_TAB_ALL = 'all'
export const RESOURCE_PICKER_TAB_LOCAL = 'localResource'
export const RESOURCE_PICKER_TAB_REMOTE = 'remoteResource'

export function normalizeResourcePickerQuery(query) {
  return String(query ?? '').trim().toLowerCase()
}

export function resourceItemMatchesPickerQuery(item, query, getLabel) {
  const q = normalizeResourcePickerQuery(query)
  if (!q) return true
  const label = String(getLabel(item) ?? '').toLowerCase()
  const value = String(item?.value ?? '').toLowerCase()
  return label.includes(q) || value.includes(q)
}

export function resourceGroupMatchesPickerTab(group, tab) {
  if (tab === RESOURCE_PICKER_TAB_ALL) return true
  return group?.value === tab
}

/**
 * @param {Array} resourceGroupList ExploreCommon 的 resourceGroupList
 * @param {{ query?: string, tab?: string, getLabel: (item: any) => string, getGroupTitle: (group: any) => string }} options
 */
export function buildResourcePickerGroups(resourceGroupList, options) {
  const { query = '', tab = RESOURCE_PICKER_TAB_ALL, getLabel, getGroupTitle } = options
  const groups = []

  for (const group of resourceGroupList || []) {
    if (!resourceGroupMatchesPickerTab(group, tab)) continue
    const items = (group.children || []).filter((item) =>
      resourceItemMatchesPickerQuery(item, query, getLabel)
    )
    if (!items.length) continue
    groups.push({
      key: group.value,
      title: getGroupTitle(group),
      icon: group.icon,
      items,
      hideTitle: tab !== RESOURCE_PICKER_TAB_ALL
    })
  }

  return groups
}
