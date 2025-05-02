import * as jieba from '@node-rs/jieba'
import { t } from '../../i18n/server.js'

// 添加单例实例变量
let instance = null

export default class WordsManager {
  constructor(logger, dbManager, settingManager) {
    // 如果实例已存在且参数相同，直接返回该实例
    if (
      instance &&
      instance.dbManager === dbManager &&
      instance.settingManager === settingManager
    ) {
      return instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this.db = dbManager.db
    this.settingManager = settingManager

    // 重置参数
    this.resetParams()

    // 保存实例
    instance = this
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
      `SELECT id, title, desc FROM fbw_resources WHERE isCut = 0 LIMIT ? OFFSET ?`
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
      // 更新资源为已处理分词
      const update_stmt = this.db.prepare(`UPDATE fbw_resources SET isCut = 1 WHERE id = ?`)

      // 插入分词
      const insert_stmt = this.db.prepare(
        `INSERT OR IGNORE INTO fbw_words (word, count, type) VALUES (?, ?, ?)`
      )

      // 更新分词计数
      const update_word_stmt = this.db.prepare(
        `UPDATE fbw_words SET count = count + 1 WHERE word = ?`
      )

      const transaction = this.db.transaction(() => {
        for (let i = 0; i < list.length; i++) {
          const item = list[i]

          // 更新资源为已处理分词
          update_stmt.run(item.id)

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
    return jieba.cutForSearch(content, true)
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
