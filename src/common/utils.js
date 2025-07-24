export const formatFileSize = (bytes = 0) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const handleInfoVal = (info, key) => {
  const val = info[key]
  if (key === 'fileSize') {
    return formatFileSize(val || 0)
  } else if (key === 'dimensions') {
    const width = info.width
    const height = info.height
    return width && height ? `${width} x ${height}` : '-'
  } else if (['ctimeMs', 'mtimeMs', 'created_at', 'updated_at'].includes(key)) {
    const val = info[key]
    return val ? new Date(val).toLocaleString() : '-'
  }
  return val || '-'
}
