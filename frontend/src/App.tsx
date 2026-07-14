import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftOutlined,
  HomeOutlined,
  InboxOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  PixelIcon,
  SearchOutlined,
} from './components/PixelIcons'
import {
  App as AntdApp,
  Badge,
  Button,
  ConfigProvider,
  Drawer,
  Input,
  Layout,
  Modal,
  Spin,
  Steps,
  Typography,
  theme,
} from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import jaJP from 'antd/locale/ja_JP'
import type { ThemeConfig } from 'antd'
import { LocalWorkspaceProvider } from './localWorkspace/context'
import { ImageStashProvider, useImageStash } from './stash/context'
import { useLanguage } from './i18n/context'
import type { Lang } from './i18n/locales'
import { getBackendHealth, type JobParams } from './api'
import type { ImageSubMode } from './components/ImageResizeStroke/ImageModuleEntry'
import ModeSelector from './components/ModeSelector'
import ImageStashPanel from './components/ImageStashPanel'
import {
  localize,
  RECENTS_STORAGE_KEY,
  saveToolIds,
  loadToolIds,
  TOOL_CATALOG,
  TOOL_CATEGORIES,
  type AppMode,
  type ToolCategory,
} from './config/toolCatalog'
import './App.css'
import './modern-pixel.css'

const GifFrameConverter = lazy(() => import('./components/GifFrameConverter'))
const ImageExpandShrink = lazy(() => import('./components/ImageExpandShrink'))
const ImagePixelate = lazy(() => import('./components/ImagePixelate'))
const ImageResizeStroke = lazy(() => import('./components/ImageResizeStroke'))
const ImageModuleEntry = lazy(() => import('./components/ImageResizeStroke/ImageModuleEntry'))
const ImageFineProcess = lazy(() => import('./components/ImageResizeStroke/ImageFineProcess'))
const SpriteSheetTool = lazy(() => import('./components/SpriteSheetTool'))
const SpriteSheetAdjust = lazy(() => import('./components/SpriteSheetAdjust'))
const ImageGeminiWatermark = lazy(() => import('./components/ImageGeminiWatermark'))
const NanobananaFullChar = lazy(() => import('./components/NanobananaFullChar'))
const SeedanceWatermarkRemover = lazy(() => import('./components/SeedanceWatermarkRemover'))
const AssetsAndSourceShare = lazy(() => import('./components/AssetsAndSourceShare'))
const ControlTest = lazy(() => import('./components/ControlTest'))
const XiyueWorkshop = lazy(() => import('./components/XiyueWorkshop'))
const AiPixelAnimalsHub = lazy(() => import('./components/AiPixelAnimalsHub'))
const GemPixelPotpourriHub = lazy(() => import('./components/GemPixelPotpourriHub'))
const InfiniteMapPlaceholder = lazy(() => import('./components/InfiniteMapPlaceholder'))
const MapStitch = lazy(() => import('./components/MapStitch'))
const ApiImageGenerator = lazy(() => import('./components/ApiImageGenerator'))
const ImageMatte = lazy(() => import('./components/ImageMatte'))
const ParamsStep = lazy(() => import('./components/ParamsStep'))
const UploadStep = lazy(() => import('./components/UploadStep'))

const { Header, Sider, Content, Footer } = Layout
const { Text } = Typography
const antdLocales: Record<Lang, typeof zhCN> = { zh: zhCN, en: enUS, ja: jaJP }

/** 现代像素主题统一由 Ant Design 变量与本地 CSS 协作，避免工具页各自维护颜色。 */
const xiyueTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  cssVar: { prefix: 'xiyue', key: 'modern-pixel' },
  token: {
    colorPrimary: '#A94332',
    colorInfo: '#263746',
    colorSuccess: '#586B50',
    colorWarning: '#C89332',
    colorError: '#7E302B',
    colorBgBase: '#F2E8D5',
    colorBgLayout: '#F2E8D5',
    colorBgContainer: '#FFF8E8',
    colorBgElevated: '#FFF8E8',
    colorBorder: '#2D2926',
    colorBorderSecondary: '#D8CBB5',
    colorText: '#2D2926',
    colorTextSecondary: '#6E6258',
    borderRadius: 0,
    borderRadiusLG: 2,
    borderRadiusSM: 0,
    lineWidth: 2,
    controlHeight: 40,
    controlHeightLG: 44,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: { controlHeight: 40 },
    Card: { headerBg: 'transparent' },
    Layout: { headerBg: '#263746', siderBg: '#263746', footerBg: '#F2E8D5' },
  },
}

/** 代码内 SVG 月牙标志避免额外图片请求，并能跟随主题清晰缩放。 */
function MoonLogo() {
  return (
    <svg className="xiyue-logo" viewBox="0 0 40 40" role="img" aria-label="曦月像素月牙标志">
      <path fill="#C89332" d="M9 5h12v4h4v4h4v14h-4v4h-4v4H9v-4H5V9h4V5Zm8 4h-6v4H9v14h2v4h6v-4h-2V13h2V9Zm4 4h4v14h-4v4h-4v-4h-2V13h6Z" />
      <path fill="#FFF8E8" d="M29 5h4v4h-4zM33 9h3v3h-3zM30 15h3v3h-3z" />
    </svg>
  )
}

/** 通用工具页壳统一返回入口、标题和移动端复杂画布提示。 */
function ToolPage({ mode, onBack, children }: { mode: Exclude<AppMode, null>; onBack: () => void; children: React.ReactNode }) {
  const { lang } = useLanguage()
  const tool = TOOL_CATALOG.find((item) => item.id === mode)
  return (
    <section className="tool-page" aria-labelledby={`tool-title-${mode}`}>
      <header className="tool-page-heading">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>返回工作台</Button>
        {tool && <div><Typography.Title id={`tool-title-${mode}`} level={3}>{localize(tool.title, lang)}</Typography.Title><Text type="secondary">{localize(tool.description, lang)}</Text></div>}
      </header>
      <div className="tool-page-content">{children}</div>
    </section>
  )
}

/** 实际应用壳位于 Provider 内部，才能让顶栏读取暂存数量。 */
function AppShell() {
  const { lang, setLang, t } = useLanguage()
  const { items } = useImageStash()
  const [mode, setMode] = useState<AppMode>(null)
  const [category, setCategory] = useState<ToolCategory | null>(null)
  const [siderCollapsed, setSiderCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [stashOpen, setStashOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  /** API 生图首次打开后保持挂载，避免切换工具时丢失输入、队列和生成记录。 */
  const [apiImageOpened, setApiImageOpened] = useState(false)
  const [xiyueWorkshopDeepLink, setXiyueWorkshopDeepLink] = useState<string | null>(null)
  const [imageSubMode, setImageSubMode] = useState<ImageSubMode | 'select'>('select')
  const [imageHandoffToFine, setImageHandoffToFine] = useState<File | null>(null)
  const [step, setStep] = useState<'upload' | 'params'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [params, setParams] = useState<JobParams>({
    fps: 12,
    frame_range: { start_sec: 0, end_sec: 5 },
    max_frames: 300,
    target_size: { w: 256, h: 256 },
    transparent: true,
    padding: 0,
    spacing: 0,
    layout_mode: 'fixed_columns',
    columns: 4,
    matte_strength: 0.6,
    crop_mode: 'tight_bbox',
  })

  useEffect(() => {
    document.title = '曦月 · 像素创作工作台'
  }, [])

  /** 单页模式切换后回到内容起点，避免从首页下方进入工具时保留旧滚动位置。 */
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [category, mode])

  /** 打开工具时只保存稳定 ID，并把最近记录限制为八项。 */
  const openTool = useCallback((nextMode: Exclude<AppMode, null>) => {
    const tool = TOOL_CATALOG.find((item) => item.id === nextMode)
    if (tool?.requiresBackend) {
      void getBackendHealth().then((health) => {
        if (tool.requiresQueue && !health.redis && !health.local_fallback) {
          Modal.warning({ title: '任务队列未启动', content: '请先启动 Redis 与 Worker，再使用此异步视频工具。' })
          return
        }
        openToolPage()
      }).catch(() => Modal.warning({ title: '需要本地服务', content: '当前是纯前端模式。请启动曦月后端后再使用此工具。' }))
      return
    }
    openToolPage()

    function openToolPage() {
      const recents = loadToolIds(RECENTS_STORAGE_KEY).filter((id) => id !== nextMode)
      saveToolIds(RECENTS_STORAGE_KEY, [nextMode, ...recents].slice(0, 8))
      if (nextMode === 'apiImage') setApiImageOpened(true)
      setMode(nextMode)
      setCategory(null)
      setMobileNavOpen(false)
      setSearchOpen(false)
      if (nextMode === 'image') {
        setImageSubMode('select')
        setImageHandoffToFine(null)
      }
      if (nextMode === 'xiyueWorkshop') setXiyueWorkshopDeepLink(null)
    }
  }, [])

  /** 返回工作台只切换可见页面；API 生图会在后台继续并保留本次会话记录。 */
  const backToWorkbench = useCallback(() => {
    setMode(null)
    setCategory(null)
    setStep('upload')
    setFile(null)
    setXiyueWorkshopDeepLink(null)
  }, [])

  /** 所有键盘入口集中在一个处理器，移除 C/H/J 等单键冲突。 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        return
      }
      if (event.key === 'Escape' && mode !== null && !searchOpen && !stashOpen) {
        event.preventDefault()
        void backToWorkbench()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [backToWorkbench, mode, searchOpen, stashOpen])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    if (!query) return TOOL_CATALOG.slice(0, 8)
    return TOOL_CATALOG.filter((tool) => [...Object.values(tool.title), ...Object.values(tool.description), ...tool.keywords]
      .some((value) => value.toLocaleLowerCase().includes(query))).slice(0, 12)
  }, [searchQuery])
  const complexCanvasMode = mode !== null && ['spriteadjust', 'mapStitch', 'infiniteMap', 'xiyueWorkshop'].includes(mode)

  /** 侧栏和移动抽屉共用同一分类导航内容。 */
  const navigation = (
    <nav className="workbench-nav" aria-label="工具分类">
      <button type="button" className={!category && mode === null ? 'active' : ''} onClick={() => { setMode(null); setCategory(null); setMobileNavOpen(false) }}>
        <HomeOutlined /><span>工作台首页</span>
      </button>
      {TOOL_CATEGORIES.map((item) => (
        <button key={item.id} type="button" className={category === item.id ? 'active' : ''} onClick={() => { setMode(null); setCategory(item.id); setMobileNavOpen(false) }}>
          <PixelIcon name={item.id} size={16} /><span>{localize(item.label, lang)}</span>
        </button>
      ))}
    </nav>
  )

  let page: React.ReactNode
  if (mode === null) {
    page = <ModeSelector onSelect={(next) => next && openTool(next)} category={category} />
  } else if (mode === 'image') {
    page = (
      <ToolPage mode={mode} onBack={() => imageSubMode === 'select' ? void backToWorkbench() : setImageSubMode('select')}>
        {imageSubMode === 'select' ? <ImageModuleEntry onSelect={setImageSubMode} /> : imageSubMode === 'normal' ? (
          <ImageResizeStroke onSendToFineProcess={(blob, suggestedFilename) => {
            const name = /\.(png|jpe?g|webp)$/i.test(suggestedFilename) ? suggestedFilename : `${suggestedFilename}.png`
            setImageHandoffToFine(new File([blob], name, { type: 'image/png' }))
            setImageSubMode('fine')
          }} />
        ) : <ImageFineProcess handoffFile={imageHandoffToFine} onHandoffConsumed={() => setImageHandoffToFine(null)} />}
      </ToolPage>
    )
  } else if (mode === 'video') {
    page = (
      <ToolPage mode={mode} onBack={() => void backToWorkbench()}>
        <Steps current={step === 'upload' ? 0 : 1} onChange={(index) => setStep(index === 0 ? 'upload' : 'params')} items={[{ title: t('stepUpload') }, { title: t('stepParams') }]} />
        {step === 'upload' ? <UploadStep file={file} onFileChange={setFile} onNext={() => setStep('params')} /> : <ParamsStep file={file} params={params} onParamsChange={setParams} />}
      </ToolPage>
    )
  } else if (mode === 'controlTest' || mode === 'controlTestArcade') {
    page = <ControlTest onBack={() => void backToWorkbench()} variant={mode === 'controlTest' ? 'topdown' : 'arcade'} />
  } else if (mode === 'mapStitch') {
    page = <MapStitch onBack={() => void backToWorkbench()} />
  } else if (mode === 'infiniteMap') {
    page = <InfiniteMapPlaceholder onBack={() => void backToWorkbench()} />
  } else if (mode === 'aiPixelAnimals') {
    page = <AiPixelAnimalsHub onBack={() => void backToWorkbench()} />
  } else if (mode === 'gemPixelPotpourri') {
    page = <GemPixelPotpourriHub onBack={() => void backToWorkbench()} />
  } else if (mode === 'xiyueWorkshop') {
    page = (
      <ToolPage mode={mode} onBack={() => void backToWorkbench()}>
        <XiyueWorkshop
          onBack={() => void backToWorkbench()}
          deepLinkFeature={xiyueWorkshopDeepLink}
          onDeepLinkConsumed={() => setXiyueWorkshopDeepLink(null)}
          onSendToFineProcess={(blob, suggestedFilename) => {
            const name = /\.(png|jpe?g|webp)$/i.test(suggestedFilename) ? suggestedFilename : `${suggestedFilename}.png`
            setImageHandoffToFine(new File([blob], name, { type: blob.type || 'image/png' }))
            setImageSubMode('fine')
            setMode('image')
          }}
        />
      </ToolPage>
    )
  } else if (mode === 'apiImage') {
    // API 生图由下方常驻容器渲染，这里不再创建第二个组件实例。
    page = null
  } else {
    const componentMap: Partial<Record<Exclude<AppMode, null>, React.ReactNode>> = {
      gif: <GifFrameConverter />,
      spritesheet: <SpriteSheetTool />,
      spriteadjust: <SpriteSheetAdjust />,
      pixelate: <ImagePixelate />,
      expandshrink: <ImageExpandShrink />,
      matte: <ImageMatte />,
      geminiwatermark: <ImageGeminiWatermark />,
      nanobananaFullChar: <NanobananaFullChar />,
      seedanceWatermark: <SeedanceWatermarkRemover />,
      assetsAndSource: <AssetsAndSourceShare />,
    }
    page = <ToolPage mode={mode} onBack={() => void backToWorkbench()}>{componentMap[mode]}</ToolPage>
  }

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-header-left">
          <Button className="mobile-menu-button" type="text" icon={<MenuOutlined />} aria-label="打开导航" onClick={() => setMobileNavOpen(true)} />
          <MoonLogo />
          <div><strong className="app-header-brand">曦月</strong><span className="app-header-subtitle">像素创作工作台</span></div>
        </div>
        <div className="app-header-actions">
          <Button className="header-search-button" icon={<SearchOutlined />} aria-label="搜索工具" onClick={() => setSearchOpen(true)}><span>搜索工具</span><kbd>Ctrl K</kbd></Button>
          <div className="app-header-lang" aria-label="语言选择">
            {(['zh', 'en', 'ja'] as const).map((value) => <button key={value} type="button" className={lang === value ? 'active' : ''} onClick={() => setLang(value)}>{value === 'zh' ? '中' : value === 'en' ? 'EN' : '日'}</button>)}
          </div>
          <Badge count={items.length} size="small" offset={[-4, 4]}><Button icon={<InboxOutlined />} aria-label="打开素材暂存" onClick={() => setStashOpen(true)}>暂存</Button></Badge>
        </div>
      </Header>

      <Layout>
        <Sider className="app-sider" width={240} collapsedWidth={72} collapsible collapsed={siderCollapsed} trigger={null}>
          {navigation}
          <Button className="sider-collapse-button" type="text" icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setSiderCollapsed((value) => !value)}>{!siderCollapsed && '收起侧栏'}</Button>
        </Sider>
        <Content className={`app-content mode-${mode || 'home'}`}>
          {complexCanvasMode && <div className="mobile-canvas-tip">复杂画布建议使用桌面端或横屏操作。</div>}
          <Suspense fallback={<div className="app-loading"><Spin size="large" /><Text>正在打开工具…</Text></div>}>
            {page}
            {apiImageOpened && (
              <div style={{ display: mode === 'apiImage' ? 'block' : 'none' }} aria-hidden={mode !== 'apiImage'}>
                <ToolPage mode="apiImage" onBack={backToWorkbench}><ApiImageGenerator /></ToolPage>
              </div>
            )}
          </Suspense>
        </Content>
      </Layout>

      <Footer className="app-footer">© {new Date().getFullYear()} 曦月 · <a href="https://github.com/User010117/xiyue" target="_blank" rel="noreferrer">源代码</a></Footer>

      <Drawer title="曦月工具" placement="left" open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} size={280}>{navigation}</Drawer>
      <ImageStashPanel open={stashOpen} onClose={() => setStashOpen(false)} />
      <Modal title="搜索工具" open={searchOpen} onCancel={() => setSearchOpen(false)} footer={null} destroyOnHidden>
        <Input autoFocus size="large" prefix={<SearchOutlined />} placeholder="输入工具名、用途或关键词" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        <div className="search-results" role="list">
          {searchResults.length === 0 && <Text type="secondary" className="search-empty">没有匹配的工具</Text>}
          {searchResults.map((tool) => (
            <button key={tool.id} type="button" role="listitem" className="search-result-item" onClick={() => openTool(tool.id)}>
              <PixelIcon name={tool.id} size={24} />
              <span><strong>{localize(tool.title, lang)}</strong><small>{localize(tool.description, lang)}</small></span>
            </button>
          ))}
        </div>
      </Modal>
    </Layout>
  )
}

/** Provider 组合保持既有认证、文件夹和暂存数据边界。 */
function App() {
  const { lang } = useLanguage()
  return (
    <ConfigProvider locale={antdLocales[lang]} theme={xiyueTheme}>
      <LocalWorkspaceProvider>
        <ImageStashProvider>
          <AntdApp><AppShell /></AntdApp>
        </ImageStashProvider>
      </LocalWorkspaceProvider>
    </ConfigProvider>
  )
}

export default App
