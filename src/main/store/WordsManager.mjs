import { Jieba } from '@node-rs/jieba'
import { dict } from '@node-rs/jieba/dict.js'

import { t } from '../../i18n/server.js'
import { expandChineseKeywordTags, isValidAutoCollectionTag } from './collectionConstants.mjs'

const jieba = Jieba.withDict(dict)

export default class WordsManager {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger, dbManager, settingManager) {
    if (!WordsManager._instance) {
      WordsManager._instance = new WordsManager(logger, dbManager, settingManager)
    }
    return WordsManager._instance
  }

  constructor(logger, dbManager, settingManager) {
    // 防止直接实例化
    if (WordsManager._instance) {
      return WordsManager._instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this.db = dbManager.db
    this.settingManager = settingManager

    // 重置参数
    this.resetParams()

    // 保存实例
    WordsManager._instance = this
  }

  // 使用 settingManager 获取设置
  get settingData() {
    return this.settingManager.settingData
  }

  resetParams() {
    this.params = {
      handleWords: {
        startPage: 1,
        pageSize: 20
      }
    }
  }

  /**
   * 定时处理词库
   * @param {Object} locks - 锁对象
   */
  intervalHandleWords(locks) {
    if (locks.handleWords) {
      return
    }

    locks.handleWords = true

    const { startPage, pageSize } = this.params.handleWords

    // 查询未处理分词的图片
    const query_stmt = this.db.prepare(
      `SELECT r.id, r.title, r.desc, r.fileName
      FROM fbw_resources r
      WHERE
      NOT EXISTS (SELECT 1 FROM fbw_resource_words rw WHERE rw.resourceId = r.id)
      LIMIT ? OFFSET ?`
    )
    const query_result = query_stmt.all(pageSize, (startPage - 1) * pageSize)

    if (Array.isArray(query_result) && query_result.length) {
      // 如果没有更多数据，重置处理词库逻辑参数
      if (query_result.length < pageSize) {
        this.resetParams()
      } else {
        this.params.handleWords.startPage += 1
      }

      // 处理分词
      this.handleWords(query_result)
      locks.handleWords = false
    } else {
      locks.handleWords = false
      this.resetParams()
    }
  }

  /**
   * 处理分词
   * @param {Array} list - 资源列表
   */
  handleWords(list) {
    if (!Array.isArray(list) || !list.length) {
      return
    }

    try {
      // 插入分词
      const insert_stmt = this.db.prepare(
        `INSERT OR IGNORE INTO fbw_words (word, count, type) VALUES (?, ?, ?)`
      )

      // 更新分词计数
      const update_word_stmt = this.db.prepare(
        `UPDATE fbw_words SET count = count + 1, updated_at = datetime('now', 'localtime') WHERE word = ?`
      )

      // 获取分词ID
      const get_word_id_stmt = this.db.prepare(`SELECT id FROM fbw_words WHERE word = ?`)

      // 插入资源与分词的关联
      const insert_resource_word_stmt = this.db.prepare(
        `INSERT OR IGNORE INTO fbw_resource_words (resourceId, wordId) VALUES (?, ?)`
      )

      const transaction = this.db.transaction(() => {
        for (let i = 0; i < list.length; i++) {
          const item = list[i]

          // 处理标题和描述
          const content = item.title ? `${item.title} ${item.desc}`.trim() : item.fileName
          if (!content) continue

          // 简单分词处理
          const words = this.cutWords(content)

          // 插入分词
          for (const word of words) {
            if (!word.trim()) continue

            // 匹配中文、英文
            let chinesePattern = /[\u4e00-\u9fa5]/
            let englishPattern = /[a-zA-Z]/
            // 类型 1：中文 2：英文
            let type = 0
            if (chinesePattern.test(word)) {
              type = 1
            } else if (englishPattern.test(word)) {
              type = 2
            }

            // 先尝试插入
            const insert_result = insert_stmt.run(word, 1, type)

            // 如果插入失败，说明已存在，更新计数
            if (!insert_result.changes) {
              update_word_stmt.run(word)
            }

            // 获取分词ID
            const wordRecord = get_word_id_stmt.get(word)
            if (wordRecord && wordRecord.id) {
              // 插入资源与分词的关联
              insert_resource_word_stmt.run(item.id, wordRecord.id)
            }
          }
        }
      })

      // 执行事务
      transaction()
      this.logger.info(`处理分词成功: count => ${list.length}`)
    } catch (err) {
      this.logger.error(`处理分词失败: error => ${err}`)
    }
  }

  /**
   * 应用 AI 标签到词库
   */
  applyTagsFromAnalysis(item, tags = []) {
    if (!item?.id || !Array.isArray(tags) || !tags.length) return
    try {
      const insert_stmt = this.db.prepare(
        `INSERT OR IGNORE INTO fbw_words (word, count, type) VALUES (?, ?, ?)`
      )
      const update_word_stmt = this.db.prepare(
        `UPDATE fbw_words SET count = count + 1, updated_at = datetime('now', 'localtime') WHERE word = ?`
      )
      const get_word_id_stmt = this.db.prepare(`SELECT id FROM fbw_words WHERE word = ?`)
      const insert_resource_word_stmt = this.db.prepare(
        `INSERT OR IGNORE INTO fbw_resource_words (resourceId, wordId) VALUES (?, ?)`
      )
      const delete_old = this.db.prepare(`DELETE FROM fbw_resource_words WHERE resourceId = ?`)
      delete_old.run(item.id)

      const transaction = this.db.transaction(() => {
        for (const word of tags) {
          if (!word?.trim()) continue
          let type = 0
          if (/[\u4e00-\u9fa5]/.test(word)) type = 1
          else if (/[a-zA-Z]/.test(word)) type = 2
          const insert_result = insert_stmt.run(word, 1, type)
          if (!insert_result.changes) update_word_stmt.run(word)
          const wordRecord = get_word_id_stmt.get(word)
          if (wordRecord?.id) insert_resource_word_stmt.run(item.id, wordRecord.id)
        }
      })
      transaction()
    } catch (err) {
      this.logger.error(`应用 AI 标签失败: ${err}`)
    }
  }

  /**
   * 分词处理
   * @param {string} content - 内容
   * @returns {Array} 分词结果
   */
  cutWords(content) {
    if (!content) return []

    // 方式一：简单分词：按空格、标点符号分割
    // return content
    //   .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ') // 替换非字母、数字、中文、空格为空格
    //   .split(/\s+/) // 按空格分割
    //   .filter((word) => word.length > 1) // 过滤掉长度为1的词

    // 方式二：结巴分词
    return jieba.cut(content, true)
  }

  /**
   * 合集/探索中文关键词结构拆词：jieba 精确模式 + 标签校验；仅整词时回退规则对半切
   * @param {string} keyword
   * @returns {string[]}
   */
  cutSearchTokens(keyword) {
    const w = String(keyword || '').trim()
    if (!w) return []

    const set = new Set()
    if (isValidAutoCollectionTag(w)) set.add(w)

    try {
      for (const part of jieba.cut(w, true)) {
        const t = String(part || '').trim()
        if (isValidAutoCollectionTag(t)) set.add(t)
      }
    } catch (err) {
      this.logger?.warn?.(`[WordsManager] cutSearchTokens: ${err.message}`)
    }

    const onlyWhole =
      set.size === 1 && set.has(w) && /[\u4e00-\u9fff]/.test(w) && w.length >= 3
    if (onlyWhole) {
      for (const t of expandChineseKeywordTags(w)) set.add(t)
    }

    return [...set].filter((t) => isValidAutoCollectionTag(t))
  }

  /**
   * 获取词库
   * @param {Object} params - 查询参数
   * @returns {Object} 查询结果
   */
  getWords(params = {}) {
    const { types = [], size = 100 } = params

    let ret = {
      success: false,
      message: t('messages.operationFail'),
      data: null
    }

    try {
      if (types.length) {
        const data = {}
        for (let i = 0; i < types.length; i++) {
          const type = types[i]
          const query_stmt = this.db.prepare(
            `SELECT word, count, type FROM fbw_words WHERE type = ? ORDER BY count DESC LIMIT ?`
          )
          const query_result = query_stmt.all(type, size)
          if (query_result && query_result.length) {
            data[type] = query_result
          } else {
            data[type] = []
          }
        }
        ret = {
          success: true,
          message: t(Object.keys(data).length ? 'messages.querySuccess' : 'messages.queryEmpty'),
          data
        }
      } else {
        const query_stmt = this.db.prepare(
          `SELECT word, count, type FROM fbw_words ORDER BY count DESC LIMIT ?`
        )
        const query_result = query_stmt.all(size)
        if (Array.isArray(query_result)) {
          ret = {
            success: true,
            message: t(query_result.length ? 'messages.querySuccess' : 'messages.queryEmpty'),
            data: query_result
          }
        }
      }
    } catch (err) {
      this.logger.error(`获取词库失败: error => ${err}`)
    }

    return ret
  }

  /** 某资源的 AI 标签词（按字母序） */
  getResourceTags(resourceId) {
    const id = Number(resourceId)
    if (!Number.isFinite(id) || id <= 0) {
      return { success: false, message: t('messages.operationFail'), data: [] }
    }
    try {
      const rows = this.db
        .prepare(
          `SELECT DISTINCT w.word AS tag
           FROM fbw_resource_words rw
           JOIN fbw_words w ON w.id = rw.wordId
           WHERE rw.resourceId = ?
           ORDER BY w.word ASC`
        )
        .all(id)
      const data = rows.map((r) => r.tag).filter(Boolean)
      return {
        success: true,
        message: t(data.length ? 'messages.querySuccess' : 'messages.queryEmpty'),
        data
      }
    } catch (err) {
      this.logger.error(`获取资源标签失败: error => ${err}`)
      return { success: false, message: t('messages.operationFail'), data: [] }
    }
  }
}
