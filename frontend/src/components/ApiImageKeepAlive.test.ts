import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** API 生图必须在首次访问后常驻，否则切换工具会中止请求并清空生成记录。 */
describe('API 生图页面生命周期', () => {
  it('首次打开后只隐藏页面而不卸载组件', () => {
    const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')

    expect(appSource).toContain("if (nextMode === 'apiImage') setApiImageOpened(true)")
    expect(appSource).toContain('apiImageOpened &&')
    expect(appSource).toContain("display: mode === 'apiImage' ? 'block' : 'none'")
  })
})
