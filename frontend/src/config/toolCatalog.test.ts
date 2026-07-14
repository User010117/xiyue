import { describe, expect, it } from 'vitest'
import { TOOL_CATALOG } from './toolCatalog'

/** 工具目录是导航、搜索与偏好的共同契约，最小测试防止入口丢失或 ID 重复。 */
describe('TOOL_CATALOG', () => {
  it('保留 20 个唯一功能，并把实验功能收进实验室', () => {
    const ids = TOOL_CATALOG.map((tool) => tool.id)
    expect(ids).toHaveLength(20)
    expect(new Set(ids).size).toBe(ids.length)
    expect(TOOL_CATALOG.filter((tool) => tool.experimental).every((tool) => tool.category === 'lab')).toBe(true)
    expect(TOOL_CATALOG.filter((tool) => tool.requiresBackend).map((tool) => tool.id).sort()).toEqual(['matte', 'seedanceWatermark'])
  })
})
