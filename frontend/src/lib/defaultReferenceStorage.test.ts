import { describe, expect, it } from 'vitest'
import {
  createDefaultReferenceStorageSource,
  MAX_DEFAULT_REFERENCE_BYTES,
  parseDefaultReferenceStorageSource,
  saveDefaultReferenceBlob,
} from './defaultReferenceStorage'

/** 默认参考图存储契约，防止容量与稳定 ID 序列化在重构时悄悄回退。 */
describe('默认参考图存储', () => {
  it('允许 5MB 单图并安全往返稳定 ID', () => {
    const storageKey = '参考图/01'
    const source = createDefaultReferenceStorageSource(storageKey)

    expect(MAX_DEFAULT_REFERENCE_BYTES).toBe(5 * 1024 * 1024)
    expect(parseDefaultReferenceStorageSource(source)).toBe(storageKey)
    expect(parseDefaultReferenceStorageSource('https://example.com/image.png')).toBeUndefined()
    expect(parseDefaultReferenceStorageSource('indexeddb:%E0%A4%A')).toBeUndefined()
  })

  it('在访问浏览器存储前拒绝超过 5MB 的文件', async () => {
    const oversizedBlob = new Blob([new Uint8Array(MAX_DEFAULT_REFERENCE_BYTES + 1)], { type: 'image/png' })

    await expect(saveDefaultReferenceBlob('oversized', oversizedBlob)).rejects.toThrow('不能超过 5MB')
  })
})
