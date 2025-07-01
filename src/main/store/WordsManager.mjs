import { Jieba } from '@node-rs/jieba'
import { dict } from '@node-rs/jieba/dict.js'

import { t } from '../../i18n/server.js'

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
        `UPDATE fbw_words SET count = count + 1 WHERE word = ?`
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
   * 处理删除资源时的分词计数更新
   * @param {Object} resource - 被删除的资源
   */
  handleDeletedResource(resource) {
    if (!resource) {
      return
    }

    try {
      // 处理标题和描述
      const content = resource.title
        ? `${resource.title} ${resource.desc}`.trim()
        : resource.fileName
      if (!content) return

      // 获取分词
      const words = this.cutWords(content)

      // 更新分词计数
      const update_word_stmt = this.db.prepare(
        `UPDATE fbw_words SET count = count - 1 WHERE word = ?`
      )

      // 删除计数为0的分词
      const delete_word_stmt = this.db.prepare(
        `DELETE FROM fbw_words WHERE word = ? AND count <= 0`
      )

      // 删除资源与分词的关联
      const delete_resource_word_stmt = this.db.prepare(
        `DELETE FROM fbw_resource_words WHERE resourceId = ?`
      )

      const transaction = this.db.transaction(() => {
        // 删除资源与分词的关联
        delete_resource_word_stmt.run(resource.id)

        for (const word of words) {
          if (!word.trim()) continue

          // 减少计数
          update_word_stmt.run(word)

          // 删除计数为0的分词
          delete_word_stmt.run(word)
        }
      })

      // 执行事务
      transaction()
      this.logger.info(
        `更新删除资源的分词计数成功: 资源ID => ${resource.id}，分词 => ${words.join(',')}`
      )
    } catch (err) {
      this.logger.error(`更新删除资源的分词计数失败: error => ${err}`)
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
   * 获取词库
   * @param {Object} params - 查询参数
   * @returns {Object} 查询结果
   */
  getWords(params = {}) {
    const { types = [], size = 100 } = params

    let ret = {
      success: false,
      msg: t('messages.operationFail'),
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
          msg: t(Object.keys(data).length ? 'messages.querySuccess' : 'messages.queryEmpty'),
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
            msg: t(query_result.length ? 'messages.querySuccess' : 'messages.queryEmpty'),
            data: query_result
          }
        }
      }
    } catch (err) {
      this.logger.error(`获取词库失败: error => ${err}`)
    }

    return ret
  }
}
