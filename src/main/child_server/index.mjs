import ChildServer from './ChildServer.mjs'
import fileServerPath from './file_server/index.mjs?modulePath'
import h5ServerPath from './h5_server/index.mjs?modulePath'

// 文件处理子进程服务
export const createFileServer = () => new ChildServer('fileServer', fileServerPath)
// h5服务子进程服务
export const createH5Server = () => new ChildServer('h5Server', h5ServerPath)
