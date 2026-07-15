import { useEffect, useMemo, useRef, useState } from 'react'
import { DownloadOutlined, ReloadOutlined, SettingOutlined, UploadOutlined } from './PixelIcons'
import { Alert, Button, Card, Collapse, Divider, Empty, Input, Modal, Select, Space, Switch, Tag, Typography } from 'antd'
import { fileToBase64, GeminiImageError, generateGeminiImage } from '../lib/geminiImage'
import {
  createDefaultReferenceStorageSource,
  deleteDefaultReferenceBlob,
  loadDefaultReferenceBlob,
  MAX_DEFAULT_REFERENCE_BYTES,
  parseDefaultReferenceStorageSource,
  saveDefaultReferenceBlob,
} from '../lib/defaultReferenceStorage'
import { useImageStash } from '../stash/context'

const { Text } = Typography

/** 单个官方模型在页面中显示的能力与费用提示。 */
interface ModelOption {
  /** Google 模型 ID。 */
  id: string
  /** 用户可读的模型名称。 */
  label: string
  /** 首版允许用户选择的输出尺寸。 */
  resolutions: Array<'1K' | '2K' | '4K'>
  /** 仅用于生成前费用预估，不执行收费。 */
  unitPrice: string
}

/** 随预设发送的默认视觉参考；内置图与用户新增图使用同一结构。 */
interface DefaultReference {
  /** 供删除和队列快照使用的稳定 ID。 */
  id: string
  /** 页面显示的名称。 */
  name: string
  /** 项目内静态路径、旧版 Data URL、本次会话对象 URL 或 IndexedDB 引用。 */
  source: string
  /** 自定义大图在 IndexedDB 中的稳定键；内置图与旧版 Data URL 没有此字段。 */
  storageKey?: string
}

/** 队列中的单张生成卡；快照确保抽卡过程不受表单后续修改影响。 */
interface GenerationCard {
  /** 卡片唯一标识。 */
  id: string
  /** 生成时固定的输入参数。 */
  request: GenerationRequest
  /** 页面展示的执行状态。 */
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'unknown'
  /** 创建时间用于区分本次会话中的多轮生成记录。 */
  createdAt: number
  /** 成功图片的 Data URL，便于复用现有暂存区持久化方式。 */
  imageUrl?: string
  /** 最后一次失败原因。 */
  error?: string
}

/** 从表单冻结的单张生成输入。 */
interface GenerationRequest {
  /** 队列创建时冻结的 Key，避免后续修改设置影响正在执行的任务。 */
  apiKey: string
  /** 选中的图片模型。 */
  model: ModelOption
  /** 用户的角色描述。 */
  description: string
  /** 仅作为模型提示的背景偏好。 */
  background: 'white' | 'green'
  /** 模型支持的输出尺寸。 */
  resolution: '1K' | '2K' | '4K'
  /** 创建队列时冻结的默认参考图组。 */
  defaultReferences: DefaultReference[]
  /** 创建队列时冻结的可编辑布局规则。 */
  layoutRules: string
  /** 队列创建时只编码一次，重试与多张抽卡复用同一不可变输入。 */
  referenceImages: Array<{ mimeType: string; data: string }>
}

/** 首版仅展示 Google 官方模型，不提供自定义 Host 或第三方协议。 */
const MODELS: ModelOption[] = [
  { id: 'gemini-2.5-flash-image', label: 'Nano Banana（快速）', resolutions: ['1K'], unitPrice: '约 $0.039/张' },
  { id: 'gemini-3.1-flash-lite-image', label: 'Nano Banana 2 Lite', resolutions: ['1K'], unitPrice: '约 $0.0336/张' },
  { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2', resolutions: ['1K'], unitPrice: '约 $0.067/张（1K）' },
  { id: 'gemini-3-pro-image', label: 'Nano Banana Pro', resolutions: ['1K'], unitPrice: '约 $0.134/张（1K）' },
]

/** 用户提供的三张样张，作为首次进入时的默认视觉参考。 */
const BUILT_IN_DEFAULT_REFERENCES: DefaultReference[] = [
  { id: 'built-in-01', name: '默认样张 1', source: `${import.meta.env.BASE_URL}default-sprite-references/sprite-reference-01.png` },
  { id: 'built-in-02', name: '默认样张 2', source: `${import.meta.env.BASE_URL}default-sprite-references/sprite-reference-02.png` },
  { id: 'built-in-03', name: '默认样张 3', source: `${import.meta.env.BASE_URL}default-sprite-references/sprite-reference-03.png` },
]

/** 用户可编辑的默认 Sprite Sheet 规则。 */
const DEFAULT_LAYOUT_RULES = [
  '严格生成 1:1 的 4 行 × 8 槽位像素角色 Sprite Sheet。',
  '第一行：向下跑动 6 帧，后 2 个槽位保持空白。',
  '第二行：向右跑动 6 帧，随后依次为向下闲置 1 帧、向上闲置 1 帧。',
  '第三行：向上跑动 6 帧，随后依次为向左闲置 1 帧、向右闲置 1 帧。',
  '第四行：准备姿态 8 帧。',
  '不要添加任何文字、数字、网格线、标签或边框。',
].join('\n')

/** 需在返回首页后恢复的本机设置；角色参考图和生成记录由常驻页面实例保留。 */
interface SavedApiImageSettings {
  /** 用户主动要求保留的 Google Key。 */
  apiKey: string
  /** 新用户默认仅保留在会话；旧版已有 Key 自动迁移为已记住。 */
  rememberKey: boolean
  /** 避免误生成的开关状态。 */
  enabled: boolean
  /** 当前模型 ID。 */
  modelId: string
  /** 当前固定为 1K，保留字段便于以后兼容。 */
  resolution: '1K' | '2K' | '4K'
  /** 已填写的角色描述草稿。 */
  description: string
  /** 固定规则中的背景偏好。 */
  background: 'white' | 'green'
  /** 抽卡数量。 */
  quantity: number
  /** 用户管理的默认参考图组。 */
  defaultReferences: DefaultReference[]
  /** 用户编辑后的 Sprite Sheet 布局规则。 */
  layoutRules: string
}

/** 本机持久化键；只在用户当前浏览器和同源页面可见。 */
const API_IMAGE_SETTINGS_STORAGE_KEY_V1 = 'xiyue.api-image.settings.v1'
const API_IMAGE_SETTINGS_STORAGE_KEY = 'xiyue.api-image.settings.v2'
const API_IMAGE_SESSION_KEY = 'xiyue.api-image.session-key.v2'

/** 读取并校验本机设置，损坏或旧版本数据回退为安全默认值。 */
function loadSavedSettings(): SavedApiImageSettings {
  const defaults: SavedApiImageSettings = { apiKey: '', rememberKey: false, enabled: false, modelId: MODELS[0].id, resolution: '1K', description: '', background: 'white', quantity: 1, defaultReferences: BUILT_IN_DEFAULT_REFERENCES, layoutRules: DEFAULT_LAYOUT_RULES }
  try {
    const rawV2 = localStorage.getItem(API_IMAGE_SETTINGS_STORAGE_KEY)
    const rawV1 = localStorage.getItem(API_IMAGE_SETTINGS_STORAGE_KEY_V1)
    const raw = rawV2 || rawV1
    if (!raw) return defaults
    const saved = JSON.parse(raw) as Partial<SavedApiImageSettings>
    const migratedRememberKey = rawV2 ? saved.rememberKey === true : typeof saved.apiKey === 'string' && Boolean(saved.apiKey)
    return {
      apiKey: migratedRememberKey && typeof saved.apiKey === 'string' ? saved.apiKey : sessionStorage.getItem(API_IMAGE_SESSION_KEY) || '',
      rememberKey: migratedRememberKey,
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : defaults.enabled,
      modelId: typeof saved.modelId === 'string' && MODELS.some((item) => item.id === saved.modelId) ? saved.modelId : defaults.modelId,
      resolution: saved.resolution === '1K' || saved.resolution === '2K' || saved.resolution === '4K' ? saved.resolution : defaults.resolution,
      description: typeof saved.description === 'string' ? saved.description : defaults.description,
      background: saved.background === 'green' ? 'green' : 'white',
      quantity: saved.quantity === 3 || saved.quantity === 5 || saved.quantity === 10 ? saved.quantity : defaults.quantity,
      defaultReferences: Array.isArray(saved.defaultReferences)
        ? saved.defaultReferences
          .filter((item): item is DefaultReference => typeof item?.id === 'string' && typeof item.name === 'string' && typeof item.source === 'string' && (BUILT_IN_DEFAULT_REFERENCES.some((builtIn) => builtIn.source === item.source) || /^data:image\/(png|jpeg|webp);base64,/.test(item.source) || Boolean(parseDefaultReferenceStorageSource(item.source))))
          .map((item) => ({ ...item, storageKey: parseDefaultReferenceStorageSource(item.source) }))
          .slice(0, 6)
        : defaults.defaultReferences,
      layoutRules: typeof saved.layoutRules === 'string' && saved.layoutRules.trim() ? saved.layoutRules : defaults.layoutRules,
    }
  } catch {
    return defaults
  }
}

/** 所有参考图合计的原始体积上限，给 Base64 与提示词保留请求空间。 */
const MAX_REFERENCE_BYTES = 14 * 1024 * 1024

/** 将 Gem 已确认的规则转换为每次请求都携带的固定提示词。 */
function buildSpritePrompt(description: string, background: 'white' | 'green', layoutRules: string): string {
  const backgroundText = background === 'white' ? '白色' : '绿色'
  return [
    '你是专业的像素动画师，负责设计像素角色动画 Sprite Sheet。',
    `角色要求：${description || '请以角色参考图为唯一角色外观依据。'}`,
    '默认参考图用于像素风格、动作排布和整体一致性；用户角色参考图仅用于角色外观、服装与配色，二者需要同时遵守。',
    layoutRules,
    `背景偏好为${backgroundText}。`,
    '保持像素风、每个槽位角色比例一致、动作清晰，并且不要生成额外角色或道具栏。',
  ].join('\n')
}

/** 判断收到明确状态码的失败是否可安全自动重试。 */
function isRetryable(error: unknown): boolean {
  return error instanceof GeminiImageError && error.status !== undefined &&
    (error.status === 408 || error.status === 429 || error.status >= 500)
}

/** 指数退避加随机抖动，避免多个失败请求同时再次触发限流。 */
function waitForRetry(attempt: number, signal: AbortSignal): Promise<void> {
  const delay = Math.min(60_000, 1_000 * (2 ** attempt)) + Math.floor(Math.random() * 500)
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, delay)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

/** 将 Google 返回的 Base64 图片验证为可显示的 Data URL。 */
function toValidatedImageUrl(mimeType: string, data: string): string {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const blob = new Blob([bytes], { type: mimeType })
  if (blob.size === 0 || !blob.type.startsWith('image/')) throw new GeminiImageError('Google 返回的图片数据无效。')
  return `data:${mimeType};base64,${data}`
}

/** 双击图片时复用 Ant Design 弹窗显示原图，避免为预览再维护一套状态组件。 */
function showImagePreview(source: string, name: string, revokeAfterClose = false) {
  Modal.info({
    title: name,
    icon: null,
    width: 'min(92vw, 1100px)',
    content: <img className="api-image-preview-full" src={source} alt={name} />,
    afterClose: revokeAfterClose ? () => URL.revokeObjectURL(source) : undefined,
  })
}

/** API 一键生图页面：承载设置、单一预设、顺序抽卡和结果回流。 */
export default function ApiImageGenerator() {
  const { addImage } = useImageStash()
  /** 设置与草稿由用户要求保存在浏览器本地，离开页面后仍可恢复。 */
  const [savedSettings, setSavedSettings] = useState(loadSavedSettings)
  const apiKey = savedSettings.apiKey
  const rememberKey = savedSettings.rememberKey
  const enabled = savedSettings.enabled
  const model = MODELS.find((item) => item.id === savedSettings.modelId) ?? MODELS[0]
  const resolution = savedSettings.resolution
  const description = savedSettings.description
  const background = savedSettings.background
  const quantity = savedSettings.quantity
  const defaultReferences = savedSettings.defaultReferences
  const layoutRules = savedSettings.layoutRules
  const setApiKey = (value: string) => setSavedSettings((previous) => ({ ...previous, apiKey: value }))
  const setRememberKey = (value: boolean) => setSavedSettings((previous) => ({ ...previous, rememberKey: value }))
  const setEnabled = (value: boolean) => setSavedSettings((previous) => ({ ...previous, enabled: value }))
  const setModel = (value: ModelOption) => setSavedSettings((previous) => ({ ...previous, modelId: value.id, resolution: value.resolutions[0] }))
  const setDescription = (value: string) => setSavedSettings((previous) => ({ ...previous, description: value }))
  const setBackground = (value: 'white' | 'green') => setSavedSettings((previous) => ({ ...previous, background: value }))
  const setQuantity = (value: number) => setSavedSettings((previous) => ({ ...previous, quantity: value }))
  const setDefaultReferences = (value: DefaultReference[]) => setSavedSettings((previous) => ({ ...previous, defaultReferences: value }))
  const setLayoutRules = (value: string) => setSavedSettings((previous) => ({ ...previous, layoutRules: value }))
  /** 参考图只用于本次页面会话。 */
  const [referenceFile, setReferenceFile] = useState<File | undefined>()
  /** 仅为当前参考图缩略图创建临时地址，文件更换后立即释放。 */
  const referencePreviewUrl = useMemo(() => referenceFile ? URL.createObjectURL(referenceFile) : undefined, [referenceFile])
  /** 设置弹窗开关。 */
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** 本次会话的生成记录；切换工具保留，刷新后不恢复大体积图片。 */
  const [cards, setCards] = useState<GenerationCard[]>([])
  /** 队列运行中禁止重复开始，避免重复计费。 */
  const [isRunning, setIsRunning] = useState(false)
  /** IndexedDB 写入期间禁止重复选择，避免并发上传覆盖同一份页面快照。 */
  const [isSavingDefaultReference, setIsSavingDefaultReference] = useState(false)
  /** 停止仅影响尚未开始的卡片。 */
  const stopRequestedRef = useRef(false)
  /** 当前控制器只属于正在执行的一张卡，停止时中止本地等待。 */
  const activeControllerRef = useRef<AbortController | null>(null)
  /** 异步返回前检查挂载状态，避免卸载后更新组件。 */
  const mountedRef = useRef(true)
  /** 配置导入与角色图上传分别使用独立 input，避免文件状态混淆。 */
  const configInputRef = useRef<HTMLInputElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const defaultReferenceInputRef = useRef<HTMLInputElement>(null)
  /** 记录自定义默认图的临时预览地址，删除或卸载时统一释放。 */
  const defaultReferenceObjectUrlsRef = useRef(new Set<string>())
  /** 只恢复首次加载的 IndexedDB 引用，避免状态更新后重复读取和创建对象 URL。 */
  const initialDefaultReferences = useRef(defaultReferences).current

  useEffect(() => () => {
    if (referencePreviewUrl) URL.revokeObjectURL(referencePreviewUrl)
  }, [referencePreviewUrl])

  /** 页面恢复时把 IndexedDB Blob 转为临时预览地址；缺失记录会从设置中清理。 */
  useEffect(() => {
    let cancelled = false
    const restoreDefaultReferences = async () => {
      const restored: DefaultReference[] = []
      let missingCount = 0
      let readError: unknown

      for (const reference of initialDefaultReferences) {
        const storageKey = reference.storageKey ?? parseDefaultReferenceStorageSource(reference.source)
        if (!storageKey) {
          restored.push(reference)
          continue
        }
        try {
          const blob = await loadDefaultReferenceBlob(storageKey)
          if (!blob) {
            missingCount += 1
            continue
          }
          const source = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(source)
            return
          }
          defaultReferenceObjectUrlsRef.current.add(source)
          restored.push({ ...reference, source, storageKey })
        } catch (error) {
          // 读取异常时保留元数据，避免临时浏览器故障造成图片记录永久丢失。
          readError ??= error
          restored.push(reference)
        }
      }

      if (cancelled) return
      if (missingCount > 0) Modal.warning({ title: '默认参考图已失效', content: `已清理 ${missingCount} 张找不到本地文件的默认参考图。` })
      if (readError) Modal.error({ title: '默认参考图读取失败', content: readError instanceof Error ? readError.message : '请刷新页面后重试。' })
      setSavedSettings((previous) => ({ ...previous, defaultReferences: restored }))
    }

    void restoreDefaultReferences()
    return () => {
      cancelled = true
      defaultReferenceObjectUrlsRef.current.forEach((source) => URL.revokeObjectURL(source))
      defaultReferenceObjectUrlsRef.current.clear()
    }
  }, [initialDefaultReferences])

  /** v2 只在用户勾选时持久化 Key；其余草稿仍沿用旧前缀保持兼容。 */
  useEffect(() => {
    try {
      const persistent = {
        ...savedSettings,
        apiKey: rememberKey ? savedSettings.apiKey : '',
        defaultReferences: savedSettings.defaultReferences.map(({ storageKey, ...reference }) => ({
          ...reference,
          source: storageKey ? createDefaultReferenceStorageSource(storageKey) : reference.source,
        })),
      }
      localStorage.setItem(API_IMAGE_SETTINGS_STORAGE_KEY, JSON.stringify(persistent))
      localStorage.removeItem(API_IMAGE_SETTINGS_STORAGE_KEY_V1)
      if (rememberKey) sessionStorage.removeItem(API_IMAGE_SESSION_KEY)
      else sessionStorage.setItem(API_IMAGE_SESSION_KEY, savedSettings.apiKey)
    } catch {
      // 本地存储空间不足时保留当前页面状态，避免因持久化失败中断生图。
    }
  }, [rememberKey, savedSettings])

  /** 浏览器刷新或关闭时提示仍有请求，普通工具切换不会卸载本页面。 */
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isRunning) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isRunning])

  /** StrictMode 会重复执行挂载检查，因此每次 effect 建立时都恢复真实挂载状态。 */
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      activeControllerRef.current?.abort()
    }
  }, [])

  /** 当前模型的费用文字用于在提交前估算抽卡总成本。 */
  const estimatedCost = useMemo(() => `${model.unitPrice}，本次约 ${quantity} 张`, [model, quantity])

  /** 设置页导出不敏感偏好，刻意排除 Key。 */
  const exportSettings = () => {
    const blob = new Blob([JSON.stringify({ version: 2, enabled, model: model.id }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'xiyue-google-image-settings.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  /** 导入配置时仅接受本功能已知字段，防止任意 JSON 改写运行状态。 */
  const importSettings = async (file?: File) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as { enabled?: unknown; model?: unknown }
      const importedModel = MODELS.find((item) => item.id === parsed.model)
      if (!importedModel || typeof parsed.enabled !== 'boolean') throw new Error('invalid')
      setModel(importedModel)
      setEnabled(parsed.enabled)
    } catch {
      Modal.error({ title: '导入失败', content: '不是有效的 Google API 生图设置文件。' })
    }
  }

  /** 校验并接收角色参考图，原始文件不得超过 Base64 安全上限。 */
  const selectReference = (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      Modal.error({ title: '参考图格式不支持', content: '只支持 PNG、JPEG 或 WEBP。' })
      return
    }
    if (file.size > MAX_REFERENCE_BYTES) {
      Modal.error({ title: '参考图过大', content: '参考图原始文件不能超过 15MB，以保证 Google inline 请求不超过 20MB。' })
      return
    }
    setReferenceFile(file)
  }

  /** 新增可长期使用的默认参考图；Blob 存入 IndexedDB，设置中只保留稳定引用。 */
  const selectDefaultReference = async (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      Modal.error({ title: '默认参考图格式不支持', content: '只支持 PNG、JPEG 或 WEBP。' })
      return
    }
    if (file.size > MAX_DEFAULT_REFERENCE_BYTES) {
      Modal.error({ title: '默认参考图过大', content: '默认参考图单张不能超过 5MB。' })
      return
    }
    if (defaultReferences.length >= 6) {
      Modal.warning({ title: '默认参考图已达上限', content: '最多保留 6 张，删除不需要的图后再添加。' })
      return
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setIsSavingDefaultReference(true)
    try {
      await saveDefaultReferenceBlob(id, file)
      const source = URL.createObjectURL(file)
      defaultReferenceObjectUrlsRef.current.add(source)
      setDefaultReferences([...defaultReferences, { id, name: file.name, source, storageKey: id }])
    } catch (error) {
      Modal.error({ title: '默认参考图保存失败', content: error instanceof Error ? error.message : '请检查浏览器存储空间后重试。' })
    } finally {
      setIsSavingDefaultReference(false)
    }
  }

  /** 删除默认参考图时同步清理 IndexedDB Blob 与临时预览地址，避免孤立数据。 */
  const removeDefaultReference = async (reference: DefaultReference) => {
    try {
      if (reference.storageKey) await deleteDefaultReferenceBlob(reference.storageKey)
      if (defaultReferenceObjectUrlsRef.current.delete(reference.source)) URL.revokeObjectURL(reference.source)
      setDefaultReferences(defaultReferences.filter((item) => item.id !== reference.id))
    } catch (error) {
      Modal.error({ title: '默认参考图删除失败', content: error instanceof Error ? error.message : '请刷新页面后重试。' })
    }
  }

  /** 将默认参考图的静态路径、旧 Data URL 或 IndexedDB Blob 转为 inline 图片输入。 */
  const toInlineReference = async (reference: DefaultReference): Promise<{ mimeType: string; data: string }> => {
    const dataUrlMatch = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(reference.source)
    if (dataUrlMatch) return { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] }
    const storageKey = reference.storageKey ?? parseDefaultReferenceStorageSource(reference.source)
    if (storageKey) {
      const blob = await loadDefaultReferenceBlob(storageKey)
      if (!blob) throw new GeminiImageError(`无法读取默认参考图：${reference.name}。`)
      const mimeType = blob.type || 'image/png'
      return { mimeType, data: await fileToBase64(new File([blob], reference.name, { type: mimeType })) }
    }
    const response = await fetch(reference.source)
    if (!response.ok) throw new GeminiImageError(`无法读取默认参考图：${reference.name}。`)
    const blob = await response.blob()
    return { mimeType: blob.type || 'image/png', data: await fileToBase64(new File([blob], reference.name, { type: blob.type || 'image/png' })) }
  }

  /** 执行一组卡片；顺序 await 是本地 BYOK 模式下的限流保护。 */
  const runCards = async (pendingCards: GenerationCard[]) => {
    setIsRunning(true)
    stopRequestedRef.current = false
    for (const card of pendingCards) {
      if (stopRequestedRef.current) {
        setCards((previous) => previous.map((item) => item.id === card.id ? { ...item, status: 'cancelled' } : item))
        continue
      }
      setCards((previous) => previous.map((item) => item.id === card.id ? { ...item, status: 'running', error: undefined } : item))
      const controller = new AbortController()
      activeControllerRef.current = controller
      let completed = false
      for (let attempt = 0; attempt < 4 && !completed; attempt += 1) {
        try {
          const result = await generateGeminiImage({
            apiKey: card.request.apiKey,
            model: card.request.model.id,
            prompt: buildSpritePrompt(card.request.description, card.request.background, card.request.layoutRules),
            referenceImages: card.request.referenceImages,
            signal: controller.signal,
          })
          const imageUrl = toValidatedImageUrl(result.mimeType, result.data)
          if (!mountedRef.current) return
          setCards((previous) => previous.map((item) => item.id === card.id ? { ...item, status: 'success', imageUrl } : item))
          addImage(imageUrl, `characterspritecreater2.3ot2-${Date.now()}.png`)
          completed = true
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            if (mountedRef.current) setCards((previous) => previous.map((item) => item.id === card.id ? { ...item, status: 'unknown', error: '本地等待已停止；请求可能已被 Google 接收并计费。' } : item))
            completed = true
            continue
          }
          if (isRetryable(error) && attempt < 3) {
            await waitForRetry(attempt, controller.signal)
            continue
          }
          const message = error instanceof Error ? error.message : '生成失败，请手动重试。'
          setCards((previous) => previous.map((item) => item.id === card.id ? { ...item, status: 'failed', error: message } : item))
          if (error instanceof GeminiImageError && [400, 401, 403].includes(error.status ?? 0)) stopRequestedRef.current = true
          completed = true
        }
      }
    }
    activeControllerRef.current = null
    if (mountedRef.current) setIsRunning(false)
  }

  /** 创建不可变抽卡快照，后续修改表单不会改变已排队的任务。 */
  const startGeneration = async () => {
    if (isRunning) return
    if (!enabled) return Modal.warning({ title: '请先启用 API', content: '请在 API 设置中启用 Google API。' })
    if (!apiKey.trim()) return Modal.warning({ title: '缺少 API Key', content: '请在 API 设置中输入你的 Google API Key。' })
    if (!description.trim() && !referenceFile) return Modal.warning({ title: '缺少角色输入', content: '请填写角色描述或上传一张角色参考图。' })
    let referenceImages: Array<{ mimeType: string; data: string }>
    try {
      referenceImages = await Promise.all([
        ...defaultReferences.map(toInlineReference),
        ...(referenceFile ? [{ mimeType: referenceFile.type, data: await fileToBase64(referenceFile) }] : []),
      ])
    } catch (error) {
      return Modal.error({ title: '参考图读取失败', content: error instanceof Error ? error.message : '请检查参考图后重试。' })
    }
    const totalReferenceBytes = referenceImages.reduce((total, image) => total + Math.ceil(image.data.length * 3 / 4), 0)
    if (totalReferenceBytes > MAX_REFERENCE_BYTES) return Modal.warning({ title: '参考图过大', content: '默认参考图与角色参考图合计不能超过 14MB。' })
    const request: GenerationRequest = { apiKey: apiKey.trim(), model, description: description.trim(), background, resolution, defaultReferences, layoutRules, referenceImages }
    const nextCards = Array.from({ length: quantity }, (_, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      request,
      status: 'pending' as const,
      createdAt: Date.now(),
    }))
    setCards((previous) => [...nextCards, ...previous])
    void runCards(nextCards)
  }

  /** 手动重试只重新提交这一张卡，避免失败时误重抽整组结果。 */
  const retryCard = (card: GenerationCard) => {
    if (isRunning) return
    const retry = { ...card, id: `${Date.now()}-retry`, status: 'pending' as const, createdAt: Date.now(), error: undefined, imageUrl: undefined }
    setCards((previous) => [retry, ...previous])
    void runCards([retry])
  }

  /** 成功结果可按原始快照再抽一张，明确提示用户这会产生一次新的 API 计费。 */
  const regenerateCard = (card: GenerationCard) => {
    if (isRunning) return
    const retry = { ...card, id: `${Date.now()}-regenerate`, status: 'pending' as const, createdAt: Date.now(), error: undefined, imageUrl: undefined }
    setCards((previous) => [retry, ...previous])
    void runCards([retry])
  }

  return (
    <div>
      <Space className="api-image-workspace" orientation="vertical" size={16} style={{ width: '100%' }}>
        <div className="api-image-toolbar">
          <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>API 设置</Button>
        </div>

        <Alert
          type="info"
          showIcon
        title={rememberKey ? 'Key 已按你的选择保存在当前浏览器本地；请求直接发送到 Google，费用由你的 Google 项目承担。' : 'Key 仅保留在当前标签页会话；请求直接发送到 Google，费用由你的 Google 项目承担。'}
        />

        <Card className="api-image-main" title="常规角色 API 生成">
          <Space orientation="vertical" size={14} style={{ width: '100%' }}>
            <div>
              <Text strong>角色描述</Text>
              <Input.TextArea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="例如：银白短发的女剑士，蓝色披风，轻甲，像素风。也可以只上传角色参考图。"
                autoSize={{ minRows: 4, maxRows: 6 }}
                disabled={isRunning}
              />
            </div>
            <div>
              <Text strong>用户角色参考图（可选）</Text>
              <div
                className="api-reference-drop-zone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  if (!isRunning) selectReference(event.dataTransfer.files[0])
                }}
              >
                <input ref={referenceInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => selectReference(event.target.files?.[0])} />
                <Space wrap>
                  <Button icon={<UploadOutlined />} onClick={() => referenceInputRef.current?.click()} disabled={isRunning}>上传角色图片</Button>
                  <Text type="secondary">{referenceFile ? referenceFile.name : '拖入图片，或点击上传'}</Text>
                  {referenceFile && <Button type="link" onClick={() => setReferenceFile(undefined)} disabled={isRunning}>移除</Button>}
                </Space>
                {referenceFile && referencePreviewUrl && (
                  <button
                    type="button"
                    className="api-preview-image-button api-reference-preview"
                    aria-label={`放大参考图：${referenceFile.name}`}
                    title="双击放大"
                    onDoubleClick={() => showImagePreview(URL.createObjectURL(referenceFile), referenceFile.name, true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') showImagePreview(URL.createObjectURL(referenceFile), referenceFile.name, true)
                    }}
                  >
                    <img src={referencePreviewUrl} alt={referenceFile.name} />
                  </button>
                )}
              </div>
            </div>
            <Space wrap>
              <label>图片比例 <Select value="1:1" disabled style={{ width: 92 }} options={[{ value: '1:1', label: '1:1' }]} /></label>
              <label>分辨率 <Tag color="cyan">1K（当前通道固定）</Tag></label>
              <label>数量 <Select value={quantity} disabled={isRunning} style={{ width: 92 }} onChange={setQuantity} options={[1, 3, 5, 10].map((value) => ({ value, label: String(value) }))} /></label>
              <label>背景 <Select value={background} disabled={isRunning} style={{ width: 110 }} onChange={setBackground} options={[{ value: 'white', label: '白色' }, { value: 'green', label: '绿色' }]} /></label>
            </Space>
            <Collapse size="small" items={[{
              key: 'advanced',
              label: '高级设置：默认参考图与布局规则',
              children: (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Text strong>默认参考图</Text>
                    <Text type="secondary">（单张不超过 5MB，最多 6 张；生成时全部参考图合计不超过 14MB）</Text>
                    <input
                      ref={defaultReferenceInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        void selectDefaultReference(file)
                      }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                      {defaultReferences.map((reference) => {
                        const previewSource = parseDefaultReferenceStorageSource(reference.source) ? undefined : reference.source
                        return (
                          <div key={reference.id} style={{ width: 112 }}>
                            <button
                              type="button"
                              className="api-preview-image-button"
                              aria-label={`放大默认参考图：${reference.name}`}
                              title={previewSource ? '双击放大' : '正在读取本地图片'}
                              disabled={!previewSource}
                              onDoubleClick={() => previewSource && showImagePreview(previewSource, reference.name)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && previewSource) showImagePreview(previewSource, reference.name)
                              }}
                            >
                              {previewSource ? <img src={previewSource} alt={reference.name} /> : <Text type="secondary">读取中</Text>}
                            </button>
                            <Text ellipsis={{ tooltip: reference.name }} style={{ display: 'block' }}>{reference.name}</Text>
                            <Button type="link" size="small" danger disabled={isRunning || isSavingDefaultReference} onClick={() => void removeDefaultReference(reference)}>删除</Button>
                          </div>
                        )
                      })}
                      <Button icon={<UploadOutlined />} loading={isSavingDefaultReference} disabled={isRunning || isSavingDefaultReference} onClick={() => defaultReferenceInputRef.current?.click()}>添加默认参考图</Button>
                    </div>
                  </div>
                  <div>
                    <Text type="warning">修改规则会直接影响生成结果，默认参考图不会替代这里的文字约束。</Text>
                    <Input.TextArea value={layoutRules} onChange={(event) => setLayoutRules(event.target.value)} autoSize={{ minRows: 7, maxRows: 16 }} disabled={isRunning} />
                    <Button type="link" style={{ alignSelf: 'flex-start' }} disabled={isRunning} onClick={() => setLayoutRules(DEFAULT_LAYOUT_RULES)}>恢复默认规则</Button>
                  </div>
                </Space>
              ),
            }]} />
            <Space wrap>
              <Text type="secondary">{estimatedCost}</Text>
              {isRunning && <Tag color="processing">正在顺序生成</Tag>}
            </Space>
            <Space>
              {isRunning && <Button onClick={() => { stopRequestedRef.current = true; activeControllerRef.current?.abort() }}>停止生成</Button>}
              <Button type="primary" onClick={() => void startGeneration()} loading={isRunning}>开始生成</Button>
            </Space>
          </Space>
        </Card>

        <Card className="api-image-history" title="生成记录" extra={<Tag>{cards.length} 条</Tag>}>
          {cards.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本次会话还没有生成记录" /> : (
            <div className="api-image-card-grid">
              {cards.map((card, index) => (
                <Card key={card.id} size="small" title={`第 ${cards.length - index} 张 · ${new Date(card.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}>
                  {card.status === 'success' && card.imageUrl ? (
                    <button
                      type="button"
                      className="api-preview-image-button api-generated-preview"
                      aria-label="放大生成图片"
                      title="双击放大"
                      onDoubleClick={() => showImagePreview(card.imageUrl!, '生成图片')}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') showImagePreview(card.imageUrl!, '生成图片')
                      }}
                    >
                      <img src={card.imageUrl} alt="生成的 Sprite Sheet" />
                    </button>
                  ) : <Text type="secondary">{card.status === 'running' ? '生成中…' : card.status === 'pending' ? '待执行' : card.status === 'cancelled' ? '已取消' : card.status === 'unknown' ? card.error : card.error || '生成失败'}</Text>}
                  <Text type="secondary" ellipsis={{ tooltip: card.request.description || '仅使用参考图' }} style={{ display: 'block', marginTop: 8 }}>{card.request.description || '仅使用参考图'} · {card.request.model.label}</Text>
                  {card.status === 'success' && <Button type="link" icon={<ReloadOutlined />} onClick={() => regenerateCard(card)} disabled={isRunning}>同参数再抽一张（将计费）</Button>}
                  {card.status === 'failed' && <Button type="link" icon={<ReloadOutlined />} onClick={() => retryCard(card)} disabled={isRunning}>使用相同参数重试</Button>}
                </Card>
              ))}
            </div>
          )}
        </Card>
      </Space>

      <Modal title="全局 API 设置" open={settingsOpen} onCancel={() => setSettingsOpen(false)} footer={null} destroyOnHidden>
        <Space orientation="vertical" size={14} style={{ width: '100%' }}>
          <div>
            <Text strong>API Key</Text>
            <Input.Password value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Google Gemini API Key" autoComplete="off" />
          </div>
          <Space><Switch checked={rememberKey} onChange={setRememberKey} /> <Text>在本机记住 Key</Text></Space>
          <Button danger onClick={() => {
            localStorage.removeItem(API_IMAGE_SETTINGS_STORAGE_KEY)
            localStorage.removeItem(API_IMAGE_SETTINGS_STORAGE_KEY_V1)
            sessionStorage.removeItem(API_IMAGE_SESSION_KEY)
            setSavedSettings((previous) => ({ ...previous, apiKey: '', rememberKey: false, enabled: false }))
          }}>清除本机 Key</Button>
          <div>
            <Text strong>模型</Text>
            <Select
              value={model.id}
              style={{ width: '100%' }}
              onChange={(modelId) => {
                const nextModel = MODELS.find((item) => item.id === modelId)!
                setModel(nextModel)
              }}
              options={MODELS.map((item) => ({ value: item.id, label: `${item.label} · ${item.unitPrice}` }))}
            />
          </div>
          <Space><Switch checked={enabled} onChange={setEnabled} /> <Text>激活 API</Text></Space>
          <Divider style={{ margin: 0 }} />
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={exportSettings}>导出 JSON</Button>
            <Button icon={<UploadOutlined />} onClick={() => configInputRef.current?.click()}>导入 JSON</Button>
            <input ref={configInputRef} type="file" accept="application/json" hidden onChange={(event) => void importSettings(event.target.files?.[0])} />
          </Space>
          <Text type="secondary">导入/导出不包含 API Key。</Text>
        </Space>
      </Modal>
    </div>
  )
}
