import { useEffect, useMemo, useState } from 'react'
import {
  ApiOutlined,
  ClockCircleOutlined,
  HeartFilled,
  HeartOutlined,
  MoonOutlined,
  PixelIcon,
} from './PixelIcons'
import { Alert, Button, Card, Col, Empty, Row, Space, Tag, Typography } from 'antd'
import { useLanguage } from '../i18n/context'
import { getBackendHealth, type BackendHealth } from '../api'
import {
  FAVORITES_STORAGE_KEY,
  loadToolIds,
  localize,
  RECENTS_STORAGE_KEY,
  saveToolIds,
  TOOL_CATALOG,
  type AppMode,
  type ToolDefinition,
} from '../config/toolCatalog'

export type { AppMode } from '../config/toolCatalog'

const { Paragraph, Text, Title } = Typography

/** 首页只保留六个高频入口，完整目录仍可从侧栏和搜索两步内到达。 */
const FEATURED_TOOL_IDS: Array<Exclude<AppMode, null>> = [
  'apiImage',
  'image',
  'gif',
  'spriteadjust',
  'mapStitch',
  'xiyueWorkshop',
]

interface Props {
  /** 统一入口回调由 App 记录最近使用。 */
  onSelect: (mode: AppMode) => void
  /** 当前分类来自侧栏；首页默认仅展示高频工具。 */
  category?: ToolDefinition['category'] | null
  /** 全局搜索词由顶栏命令面板传入。 */
  query?: string
}

/** 单个工具卡：整卡可点击，收藏是唯一独立次级动作。 */
function ToolCard({
  tool,
  favorite,
  backendHealth,
  onOpen,
  onFavorite,
}: {
  tool: ToolDefinition
  favorite: boolean
  backendHealth: BackendHealth | false | null
  onOpen: () => void
  onFavorite: () => void
}) {
  const { lang } = useLanguage()
  const queueUnavailable = tool.requiresQueue && backendHealth !== null && (backendHealth === false || (!backendHealth.redis && !backendHealth.local_fallback))
  const unavailable = tool.requiresBackend && (backendHealth === false || queueUnavailable)
  return (
    <Card
      hoverable
      className="workbench-tool-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="workbench-tool-card-top">
        <span className="workbench-tool-icon" aria-hidden="true"><PixelIcon name={tool.id} size={24} /></span>
        <Button
          type="text"
          className="workbench-favorite-button"
          icon={favorite ? <HeartFilled /> : <HeartOutlined />}
          aria-label={favorite ? '取消收藏' : '收藏工具'}
          onClick={(event) => {
            event.stopPropagation()
            onFavorite()
          }}
        />
      </div>
      <Title level={4}>{localize(tool.title, lang)}</Title>
      <Paragraph>{localize(tool.description, lang)}</Paragraph>
      <Space size={6} wrap>
        {tool.experimental && <Tag className="status-tag status-tag-warning">实验室</Tag>}
        {tool.requiresBackend && <Tag className={`status-tag ${unavailable ? 'status-tag-warning' : 'status-tag-success'}`}>{unavailable ? '需要后端' : '本地服务'}</Tag>}
      </Space>
    </Card>
  )
}

/** 现代像素工作台首页、分类结果和搜索结果共用同一目录。 */
export default function ModeSelector({ onSelect, category = null, query = '' }: Props) {
  const { lang } = useLanguage()
  const [favorites, setFavorites] = useState(() => loadToolIds(FAVORITES_STORAGE_KEY))
  const [recents] = useState(() => loadToolIds(RECENTS_STORAGE_KEY))
  const [backendHealth, setBackendHealth] = useState<BackendHealth | false | null>(null)

  /** 健康检查失败只标记依赖后端的入口，不影响纯前端工具。 */
  useEffect(() => {
    const controller = new AbortController()
    getBackendHealth(controller.signal)
      .then(setBackendHealth)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setBackendHealth(false)
      })
    return () => controller.abort()
  }, [])

  /** 查询同时匹配三语标题、描述和兼容关键词。 */
  const visibleTools = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (normalized) {
      return TOOL_CATALOG.filter((tool) => [
        ...Object.values(tool.title),
        ...Object.values(tool.description),
        ...tool.keywords,
      ].some((value) => value.toLocaleLowerCase().includes(normalized)))
    }
    if (category) return TOOL_CATALOG.filter((tool) => tool.category === category)
    return FEATURED_TOOL_IDS.map((id) => TOOL_CATALOG.find((tool) => tool.id === id)).filter((tool): tool is ToolDefinition => Boolean(tool))
  }, [category, query])

  const toggleFavorite = (id: Exclude<AppMode, null>) => {
    setFavorites((previous) => {
      const next = previous.includes(id) ? previous.filter((item) => item !== id) : [id, ...previous]
      saveToolIds(FAVORITES_STORAGE_KEY, next)
      return next
    })
  }

  const recentTools = recents.slice(0, 4).map((id) => TOOL_CATALOG.find((tool) => tool.id === id)).filter((tool): tool is ToolDefinition => Boolean(tool))
  const favoriteTools = favorites.slice(0, 4).map((id) => TOOL_CATALOG.find((tool) => tool.id === id)).filter((tool): tool is ToolDefinition => Boolean(tool))

  return (
    <div className="workbench-home">
      {!category && !query && (
        <>
          <section className="workbench-hero">
            <div>
              <Text className="workbench-eyebrow"><MoonOutlined /> 曦月创作工作台</Text>
              <Title>把灵感变成可用素材</Title>
              <Paragraph>AI 生成、素材处理、精灵表与地图工具，都在一个清晰、轻快的创作工作台里。</Paragraph>
              <Button type="primary" size="large" icon={<ApiOutlined />} onClick={() => onSelect('apiImage')}>
                开始 AI 生成
              </Button>
            </div>
            <div className="workbench-studio-art" aria-hidden="true">
              <img src={`${import.meta.env.BASE_URL}pixel-studio.svg`} alt="" />
            </div>
          </section>

          <Alert
            className="workbench-health"
            type={backendHealth === false ? 'warning' : 'success'}
            showIcon
            title={backendHealth === null ? '正在检查本地服务…' : backendHealth === false ? '当前为纯前端模式；视频水印与 AI 抠图需要启动后端' : backendHealth.redis || backendHealth.local_fallback ? '本地服务与任务队列已连接' : '本地 API 已连接；异步视频工具还需要 Redis 与 Worker'}
          />

          {(recentTools.length > 0 || favoriteTools.length > 0) && (
            <section className="workbench-resume">
              {recentTools.length > 0 && (
                <div>
                  <Text strong><ClockCircleOutlined /> 最近使用</Text>
                  <Space wrap>{recentTools.map((tool) => <Button key={tool.id} onClick={() => onSelect(tool.id)}>{localize(tool.title, lang)}</Button>)}</Space>
                </div>
              )}
              {favoriteTools.length > 0 && (
                <div>
                  <Text strong><HeartFilled /> 收藏</Text>
                  <Space wrap>{favoriteTools.map((tool) => <Button key={tool.id} onClick={() => onSelect(tool.id)}>{localize(tool.title, lang)}</Button>)}</Space>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <section className="workbench-tools">
        <div className="workbench-section-heading">
          <div>
            <Title level={3}>{query ? `搜索“${query}”` : category ? '分类工具' : '常用工具'}</Title>
            <Text type="secondary">{query ? `找到 ${visibleTools.length} 个工具` : category ? '选择工具即可开始' : '首页只保留六个高频入口，其他功能在左侧分类中。'}</Text>
          </div>
        </div>
        {visibleTools.length === 0 ? <Empty description="没有匹配的工具" /> : (
          <Row gutter={[16, 16]}>
            {visibleTools.map((tool) => (
              <Col key={tool.id} xs={24} sm={12} xl={8}>
                <ToolCard
                  tool={tool}
                  favorite={favorites.includes(tool.id)}
                  backendHealth={backendHealth}
                  onOpen={() => onSelect(tool.id)}
                  onFavorite={() => toggleFavorite(tool.id)}
                />
              </Col>
            ))}
          </Row>
        )}
      </section>
    </div>
  )
}
