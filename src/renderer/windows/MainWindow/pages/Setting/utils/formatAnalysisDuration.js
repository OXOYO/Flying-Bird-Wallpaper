/** 毫秒 → 秒（分析速度：当前/平均统一用秒，至少 1） */

export function msToAnalysisSeconds(ms) {

  return Math.max(1, Math.ceil((Number(ms) || 0) / 1000))

}



/** 剩余时间：取最合适单一单位（小时 > 分钟 > 秒） */

export function formatAnalysisRemaining(t, ms) {

  const totalSec = msToAnalysisSeconds(ms)

  const hour = Math.floor(totalSec / 3600)

  if (hour >= 1) {

    return t('pages.Setting.aiSetting.analysisDurationHour', { hour })

  }

  const min = Math.floor(totalSec / 60)

  if (min >= 1) {

    return t('pages.Setting.aiSetting.analysisDurationMin', { min })

  }

  return t('pages.Setting.aiSetting.analysisDurationSec', { sec: totalSec })

}


