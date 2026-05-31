import { menuList } from '@common/publicData.js'

/** @typedef {'search' | 'collections' | 'favorites' | 'history'} BrowsePageKey */

export const BROWSE_PAGE_KEYS = ['search', 'collections', 'favorites', 'history']

const nameToKey = {
  Search: 'search',
  Collections: 'collections',
  Favorites: 'favorites',
  History: 'history'
}

const browseMenuMap = Object.fromEntries(
  menuList
    .filter((item) => nameToKey[item.name])
    .map((item) => [nameToKey[item.name], item])
)

/** @param {BrowsePageKey} page */
export const getBrowsePageMeta = (page) => {
  return (
    browseMenuMap[page] || {
      name: page,
      locale: 'menuList.Search',
      icon: 'custom:search'
    }
  )
}
