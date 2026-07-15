/** 单张默认参考图的持久化上限；IndexedDB 可安全保存该体积，避免 localStorage 配额失败。 */
export const MAX_DEFAULT_REFERENCE_BYTES = 5 * 1024 * 1024

/** localStorage 中只保存此引用，真实图片 Blob 由 IndexedDB 管理。 */
const STORAGE_SOURCE_PREFIX = 'indexeddb:'
/** 默认参考图库使用独立数据库，避免与其他浏览器数据相互影响。 */
const DATABASE_NAME = 'xiyue-api-image'
/** 数据结构版本；以后修改对象仓库时必须递增。 */
const DATABASE_VERSION = 1
/** Blob 对象仓库名称。 */
const STORE_NAME = 'default-references'

/** 复用同一个数据库连接，减少连续读取多张默认图时的重复打开开销。 */
let databasePromise: Promise<IDBDatabase> | undefined

/** 将稳定 ID 转成可安全写入设置 JSON 的本地图片引用。 */
export function createDefaultReferenceStorageSource(storageKey: string): string {
  return `${STORAGE_SOURCE_PREFIX}${encodeURIComponent(storageKey)}`
}

/** 从设置中的本地图片引用恢复稳定 ID；普通 URL 与损坏值返回 undefined。 */
export function parseDefaultReferenceStorageSource(source: string): string | undefined {
  if (!source.startsWith(STORAGE_SOURCE_PREFIX)) return undefined
  try {
    return decodeURIComponent(source.slice(STORAGE_SOURCE_PREFIX.length)) || undefined
  } catch {
    return undefined
  }
}

/** 打开默认参考图库；浏览器禁用 IndexedDB 时向页面返回可读错误。 */
function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('当前浏览器不支持本地大图存储。'))
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = undefined
      }
      resolve(database)
    }
    request.onerror = () => {
      databasePromise = undefined
      reject(request.error ?? new Error('无法打开本地默认参考图库。'))
    }
    request.onblocked = () => {
      databasePromise = undefined
      reject(new Error('默认参考图库正在被其他页面占用，请关闭旧页面后重试。'))
    }
  })
  return databasePromise
}

/** 在事务完成后再返回，确保页面状态不会早于图片实际落盘。 */
async function runTransaction<T>(
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = createRequest(transaction.objectStore(STORE_NAME))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('默认参考图存储失败。'))
    transaction.onabort = () => reject(transaction.error ?? new Error('默认参考图存储已取消。'))
  })
}

/** 保存图片 Blob；再次使用相同稳定 ID 时覆盖旧文件。 */
export async function saveDefaultReferenceBlob(storageKey: string, blob: Blob): Promise<void> {
  if (blob.size > MAX_DEFAULT_REFERENCE_BYTES) throw new Error('默认参考图单张不能超过 5MB。')
  await runTransaction('readwrite', (store) => store.put(blob, storageKey))
}

/** 读取已保存图片；记录不存在时返回 undefined，让页面清理失效元数据。 */
export async function loadDefaultReferenceBlob(storageKey: string): Promise<Blob | undefined> {
  const value = await runTransaction('readonly', (store) => store.get(storageKey))
  return value instanceof Blob ? value : undefined
}

/** 删除图片 Blob；页面仅在事务成功后移除对应卡片。 */
export async function deleteDefaultReferenceBlob(storageKey: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(storageKey))
}
