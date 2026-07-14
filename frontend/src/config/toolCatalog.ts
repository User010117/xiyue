import type { Lang } from '../i18n/locales'

/** 应用现有的全部一级模式；null 仅表示工作台首页。 */
export type AppMode =
  | 'video'
  | 'image'
  | 'gif'
  | 'spritesheet'
  | 'spriteadjust'
  | 'pixelate'
  | 'expandshrink'
  | 'matte'
  | 'geminiwatermark'
  | 'nanobananaFullChar'
  | 'seedanceWatermark'
  | 'assetsAndSource'
  | 'controlTest'
  | 'controlTestArcade'
  | 'xiyueWorkshop'
  | 'mapStitch'
  | 'infiniteMap'
  | 'aiPixelAnimals'
  | 'gemPixelPotpourri'
  | 'apiImage'
  | null

/** 工具分类稳定 ID 同时供导航、搜索和用户偏好使用。 */
export type ToolCategory = 'ai' | 'media' | 'animation' | 'map' | 'workshop' | 'lab'

/** 三语短文本不依赖组件上下文，确保所有入口显示一致。 */
type LocalizedText = Record<Lang, string>

/** 单一工具目录中的最小产品元数据。 */
export interface ToolDefinition {
  /** 稳定 ID 与既有 AppMode 保持一致，避免用户偏好迁移丢失。 */
  id: Exclude<AppMode, null>
  /** 侧栏所属分类。 */
  category: ToolCategory
  /** 三语标题。 */
  title: LocalizedText
  /** 首页与搜索结果使用的简短说明。 */
  description: LocalizedText
  /** 搜索同义词，包含旧品牌名以保持可发现性。 */
  keywords: string[]
  /** 仅实验性或低频能力进入实验室，不占首页。 */
  experimental?: boolean
  /** 需要本地 FastAPI 时用于入口状态提示。 */
  requiresBackend?: boolean
  /** 异步视频任务还要求 Redis/RQ，单次图片抠图则只需要 API。 */
  requiresQueue?: boolean
}

/** 分类名称集中维护，避免多个导航面板产生不同叫法。 */
export const TOOL_CATEGORIES: Array<{ id: ToolCategory; label: LocalizedText }> = [
  { id: 'ai', label: { zh: 'AI 创作', en: 'AI Creation', ja: 'AI 制作' } },
  { id: 'media', label: { zh: '素材处理', en: 'Asset Tools', ja: '素材処理' } },
  { id: 'animation', label: { zh: '动画与精灵表', en: 'Animation & Sheets', ja: 'アニメとスプライト' } },
  { id: 'map', label: { zh: '地图与游戏', en: 'Maps & Games', ja: 'マップとゲーム' } },
  { id: 'workshop', label: { zh: '曦月工坊', en: 'Xiyue Workshop', ja: '曦月工房' } },
  { id: 'lab', label: { zh: '实验室与资源', en: 'Lab & Resources', ja: 'ラボと資料' } },
]

/** 20 个既有功能的唯一目录；新增入口必须先在这里登记。 */
export const TOOL_CATALOG: ToolDefinition[] = [
  { id: 'apiImage', category: 'ai', title: { zh: 'AI 一键生图', en: 'AI Image Studio', ja: 'AI 画像生成' }, description: { zh: '使用自己的 Google Key 生成像素角色', en: 'Generate pixel characters with your Google key', ja: 'Google Key でピクセルキャラを生成' }, keywords: ['gemini', 'nano banana', 'api', '生图'] },
  { id: 'nanobananaFullChar', category: 'ai', title: { zh: '角色全身图', en: 'Full Character', ja: '全身キャラクター' }, description: { zh: '角色全身构图与像素风生成入口', en: 'Full-body character generation', ja: '全身キャラクター生成' }, keywords: ['角色', 'character', 'nanobanana'] },
  { id: 'gemPixelPotpourri', category: 'ai', title: { zh: 'AI 预设库', en: 'AI Preset Library', ja: 'AI プリセット集' }, description: { zh: '角色、场景、怪物等 Gemini 预设', en: 'Gemini presets for characters, scenes and monsters', ja: 'キャラ・シーン・モンスターのプリセット' }, keywords: ['gem', 'preset', '场景', '怪物', 'Xiyue'] },
  { id: 'aiPixelAnimals', category: 'ai', title: { zh: 'AI 像素动物', en: 'AI Pixel Animals', ja: 'AI ピクセル動物' }, description: { zh: '动物像素动画预设集合', en: 'Pixel animal animation presets', ja: '動物ピクセルアニメのプリセット' }, keywords: ['animal', '动物', 'gem'] },
  { id: 'image', category: 'media', title: { zh: '图片处理', en: 'Image Processing', ja: '画像処理' }, description: { zh: '缩放、描边与精细处理', en: 'Resize, outline and refine images', ja: 'リサイズ・縁取り・詳細処理' }, keywords: ['图片', 'resize', 'stroke', 'fine'] },
  { id: 'pixelate', category: 'media', title: { zh: '像素化', en: 'Pixelate', ja: 'ピクセル化' }, description: { zh: '把普通图片转换为像素风', en: 'Turn images into pixel art', ja: '画像をピクセルアートに変換' }, keywords: ['pixel', 'opencv', '像素'] },
  { id: 'expandshrink', category: 'media', title: { zh: '扩缩边', en: 'Expand / Shrink', ja: '輪郭の拡縮' }, description: { zh: '透明图边缘扩展与收缩', en: 'Expand or shrink transparent edges', ja: '透明画像の輪郭を拡張・縮小' }, keywords: ['expand', 'shrink', '边缘'] },
  { id: 'matte', category: 'media', title: { zh: 'AI 抠图', en: 'AI Background Removal', ja: 'AI 背景除去' }, description: { zh: '本地服务去除图片背景', en: 'Remove image backgrounds with the local service', ja: 'ローカルサービスで背景を除去' }, keywords: ['rembg', '抠图', 'matte'], requiresBackend: true },
  { id: 'geminiwatermark', category: 'media', title: { zh: '图片水印处理', en: 'Image Watermark Tool', ja: '画像透かし処理' }, description: { zh: '处理 Gemini 图片角标', en: 'Process Gemini image marks', ja: 'Gemini 画像マークを処理' }, keywords: ['gemini', 'watermark', '水印'] },
  { id: 'seedanceWatermark', category: 'media', title: { zh: '视频水印处理', en: 'Video Watermark Tool', ja: '動画透かし処理' }, description: { zh: '使用本地服务处理 Seedance 视频', en: 'Process Seedance videos with the local service', ja: 'ローカルで Seedance 動画を処理' }, keywords: ['seedance', 'watermark', '视频'], requiresBackend: true, requiresQueue: true },
  { id: 'gif', category: 'animation', title: { zh: 'GIF 与帧工具', en: 'GIF & Frame Tools', ja: 'GIF・フレーム工具' }, description: { zh: 'GIF 拆帧、排序、合并与预览', en: 'Split, sort, merge and preview frames', ja: 'GIF 分解・並べ替え・結合・プレビュー' }, keywords: ['gif', 'frame', '帧'] },
  { id: 'spritesheet', category: 'animation', title: { zh: 'Sprite Sheet 工具', en: 'Sprite Sheet Tools', ja: 'スプライトシート工具' }, description: { zh: '精灵表切分与重新组合', en: 'Split and rebuild sprite sheets', ja: 'スプライトシートの分割と再構成' }, keywords: ['sprite', 'sheet', '精灵表'] },
  { id: 'spriteadjust', category: 'animation', title: { zh: '精灵表调整', en: 'Sprite Sheet Editor', ja: 'スプライト調整' }, description: { zh: '网格、帧位与动画细调', en: 'Adjust grids, frames and animation', ja: 'グリッド・フレーム・アニメを調整' }, keywords: ['sprite', 'adjust', 'grid'] },
  { id: 'video', category: 'animation', title: { zh: '视频转精灵表', en: 'Video to Sprite Sheet', ja: '動画からスプライト' }, description: { zh: '浏览器内提取视频帧并生成精灵表', en: 'Extract video frames in the browser', ja: 'ブラウザで動画フレームを抽出' }, keywords: ['video', '视频', 'frames'] },
  { id: 'mapStitch', category: 'map', title: { zh: '地图拼接', en: 'Map Stitching', ja: 'マップ結合' }, description: { zh: '拼接瓦片地图与大图', en: 'Stitch tile maps and large images', ja: 'タイルマップと大画像を結合' }, keywords: ['map', '地图', 'stitch'] },
  { id: 'controlTest', category: 'lab', title: { zh: '俯视控制测试', en: 'Top-down Control Test', ja: '見下ろし操作テスト' }, description: { zh: '验证角色移动素材', en: 'Validate character movement assets', ja: 'キャラクター移動素材を確認' }, keywords: ['control', 'test', '俯视'], experimental: true },
  { id: 'controlTestArcade', category: 'lab', title: { zh: '街机控制测试', en: 'Arcade Control Test', ja: 'アーケード操作テスト' }, description: { zh: '验证横版角色素材', en: 'Validate side-scroller assets', ja: '横スクロール素材を確認' }, keywords: ['arcade', 'control', '横版'], experimental: true },
  { id: 'infiniteMap', category: 'lab', title: { zh: '无限地图', en: 'Infinite Map', ja: '無限マップ' }, description: { zh: '程序化地图实验', en: 'Procedural map experiment', ja: 'プロシージャルマップ実験' }, keywords: ['infinite', 'procedural', '无限'], experimental: true },
  { id: 'xiyueWorkshop', category: 'workshop', title: { zh: '曦月工坊', en: 'Xiyue Workshop', ja: '曦月工房' }, description: { zh: '高级切片、缩放与工作流工具', en: 'Advanced slicing, scaling and workflow tools', ja: '高度な分割・拡縮・ワークフロー工具' }, keywords: ['XiyueWorkshop', 'pro', '工坊', 'workflow'] },
  { id: 'assetsAndSource', category: 'lab', title: { zh: '资源与源码', en: 'Resources & Source', ja: '資料とソース' }, description: { zh: '项目资源、教程与源码入口', en: 'Project resources, guides and source links', ja: '資料・ガイド・ソースへの入口' }, keywords: ['source', 'assets', '资源'], experimental: true },
]

/** 读取当前语言文本，组件无需重复处理回退逻辑。 */
export function localize(text: LocalizedText, lang: Lang): string {
  return text[lang] || text.zh
}

/** 用户偏好继续使用 Xiyue 前缀，保证旧站点同源数据兼容。 */
export const FAVORITES_STORAGE_KEY = 'xiyue.workbench.favorites.v1'
export const RECENTS_STORAGE_KEY = 'xiyue.workbench.recents.v1'

/** 只接受目录中仍存在的稳定 ID，自动清理损坏或过期数据。 */
export function loadToolIds(key: string): Exclude<AppMode, null>[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]') as unknown
    if (!Array.isArray(parsed)) return []
    const validIds = new Set(TOOL_CATALOG.map((tool) => tool.id))
    return parsed.filter((id): id is Exclude<AppMode, null> => typeof id === 'string' && validIds.has(id as Exclude<AppMode, null>))
  } catch {
    return []
  }
}

/** 保存稳定工具 ID；存储异常不应阻止用户继续使用工具。 */
export function saveToolIds(key: string, ids: Exclude<AppMode, null>[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // 用户禁用存储时仅失去偏好持久化，不影响主流程。
  }
}
