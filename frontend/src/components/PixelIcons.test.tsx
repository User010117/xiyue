import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TOOL_CATALOG, TOOL_CATEGORIES } from '../config/toolCatalog'
import { PixelIcon } from './PixelIcons'

/** 递归收集源码文件，用于阻止后续工具重新引入另一套普通图标语言。 */
function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const filePath = join(directory, name)
    return statSync(filePath).isDirectory() ? collectSourceFiles(filePath) : /\.(ts|tsx)$/.test(name) ? [filePath] : []
  })
}

/** 像素图标是目录与交互共用契约，测试同时约束网格、映射和无障碍行为。 */
describe('PixelIcon', () => {
  it('20 个工具和 6 个分类均可在 16×16 整数网格中渲染', () => {
    const names = [...TOOL_CATALOG.map((tool) => tool.id), ...TOOL_CATEGORIES.map((category) => category.id)]
    expect(names).toHaveLength(26)

    names.forEach((name) => {
      const markup = renderToStaticMarkup(<PixelIcon name={name} size={16} />)
      expect(markup).toContain('viewBox="0 0 16 16"')
      expect(markup).toContain('shape-rendering="crispEdges"')
      const path = markup.match(/<path d="([^"]+)"/u)?.[1] ?? ''
      const coordinates = path.match(/-?\d+(?:\.\d+)?/gu)?.map(Number) ?? []
      expect(path.length).toBeGreaterThan(0)
      expect(coordinates.every(Number.isInteger)).toBe(true)
    })
  })

  it('缺省标题时隐藏于读屏，独立信息图标提供可读标题', () => {
    expect(renderToStaticMarkup(<PixelIcon name="home" />)).toContain('aria-hidden="true"')
    const titled = renderToStaticMarkup(<PixelIcon name="success" title="服务已连接" />)
    expect(titled).toContain('role="img"')
    expect(titled).toContain('<title>服务已连接</title>')
    expect(titled).not.toContain('aria-hidden')
  })

  it('前端源码不再直接导入 Ant Design 图标包', () => {
    const sourceRoot = join(process.cwd(), 'src')
    const forbiddenPackage = ['@ant-design', 'icons'].join('/')
    const directImport = new RegExp(`from\\s+['"]${forbiddenPackage.replace('/', '\\/')}['"]`, 'u')
    const offenders = collectSourceFiles(sourceRoot)
      .filter((filePath) => directImport.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(sourceRoot, filePath))
    expect(offenders).toEqual([])
  })
})
