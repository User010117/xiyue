import type { SVGProps } from 'react'
import type { AppMode, ToolCategory } from '../config/toolCatalog'

/** 全站允许使用的动作图标名称，避免组件重新混入普通线性图标。 */
export type PixelActionIcon =
  | 'home' | 'search' | 'stash' | 'back' | 'menu'
  | 'collapse' | 'expand' | 'favorite' | 'favorite-filled' | 'settings'
  | 'upload' | 'download' | 'delete' | 'add' | 'remove'
  | 'play' | 'pause' | 'stop' | 'retry' | 'save'
  | 'edit' | 'visibility' | 'visibility-off' | 'locked' | 'unlocked'
  | 'success' | 'warning' | 'error' | 'info'
  | 'external' | 'folder' | 'code' | 'clock' | 'image'
  | 'left' | 'right' | 'up' | 'down' | 'drag' | 'copy'
  | 'scissors' | 'sound' | 'layout' | 'border' | 'merge'
  | 'experiment' | 'rocket' | 'target' | 'list' | 'moon'

/** 工具、分类和常用动作共用一个像素图标命名空间。 */
export type PixelIconName = Exclude<AppMode, null> | ToolCategory | PixelActionIcon

/** 像素图标只暴露三档设计尺寸，同时兼容原 SVG 的 className 与 style。 */
export interface PixelIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  /** 语义名称决定 16×16 网格中的图形。 */
  name: PixelIconName
  /** 设计系统只使用 16、24、32 三档图标。 */
  size?: 16 | 24 | 32
  /** 仅独立表达信息时提供标题；按钮内图标由按钮文字或 aria-label 命名。 */
  title?: string
}

/** 所有路径只使用整数坐标，放大时保持明确的像素轮廓。 */
const GLYPHS = {
  grid: 'M1 1h6v6H1V1Zm8 0h6v6H9V1ZM1 9h6v6H1V9Zm8 0h6v6H9V9ZM3 3v2h2V3H3Zm8 0v2h2V3h-2ZM3 11v2h2v-2H3Zm8 0v2h2v-2h-2Z',
  home: 'M1 7h2v8h4v-5h2v5h4V7h2L8 1 1 7Zm4 0 3-3 3 3v6H9V8H7v5H5V7Z',
  search: 'M2 1h8v2H4v6h6V7h2V3h-2V1Zm8 8h2v2h2v2h2v2h-3v-2h-2v-2H9V9h1Z',
  inbox: 'M2 1h12v3h1v11H1V4h1V1Zm2 2v6h2v2h4V9h2V3H4Zm-1 8v2h10v-2h-1v2H4v-2H3Z',
  menu: 'M1 2h14v3H1V2Zm0 5h14v3H1V7Zm0 5h14v3H1v-3Z',
  left: 'M7 2h4v2H7v2H5v2H3v2h2v2h2v2h4v-2H9v-2h5V8H9V6H7V2Z',
  right: 'M5 2h4v2h2v2h2v2h2v2h-2v2h-2v2H7v-2h2v-2H2V8h7V6H7V4H5V2Z',
  up: 'M7 1h2v2h2v2h2v4h-2V7H9v8H7V7H5v2H3V5h2V3h2V1Z',
  down: 'M7 1h2v8h2V7h2v4h-2v2H9v2H7v-2H5v-2H3V7h2v2h2V1Z',
  heart: 'M2 3h4v2h4V3h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V5h2V3Zm2 2H2v4h2v2h2v2h4v-2h2V9h2V5h-2v2h-2v2H6V7H4V5Z',
  heartFill: 'M2 3h4v2h4V3h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V5h2V3Z',
  plus: 'M6 1h4v5h5v4h-5v5H6v-5H1V6h5V1Z',
  minus: 'M1 6h14v4H1V6Z',
  close: 'M1 1h4v2h2v2h2V3h2V1h4v4h-2v2h-2v2h2v2h2v4h-4v-2H9v-2H7v2H5v2H1v-4h2V9h2V7H3V5H1V1Z',
  download: 'M6 1h4v7h3v2h-2v2H9v2H7v-2H5v-2H3V8h3V1ZM1 13h4v2h6v-2h4v3H1v-3Z',
  upload: 'M7 1h2v2h2v2h2v2h-3v5H6V7H3V5h2V3h2V1ZM1 12h4v2h6v-2h4v4H1v-4Z',
  trash: 'M5 1h6v2h4v3H1V3h4V1ZM3 7h10v8H3V7Zm3 2v4h1V9H6Zm3 0v4h1V9H9Z',
  edit: 'M11 1h3v1h1v3L6 14H2v-4l9-9Zm1 3L5 11v1h1l7-7-1-1Z',
  save: 'M1 1h12l2 2v12H1V1Zm3 2v4h7V3H4Zm1 7v3h6v-3H5Z',
  play: 'M3 1h4v2h3v2h3v2h2v2h-2v2h-3v2H7v2H3V1Zm4 4v6h2V9h3V7H9V5H7Z',
  pause: 'M2 1h5v14H2V1Zm7 0h5v14H9V1Z',
  stop: 'M2 2h12v12H2V2Z',
  reload: 'M3 2h8V0l4 4-4 4V6H5v2H2v4h2v2h8v-2h2v3H4v-2H1V5h2V2Z',
  eye: 'M1 6h2V4h3V2h4v2h3v2h2v4h-2v2h-3v2H6v-2H3v-2H1V6Zm5 0v4h4V6H6Zm1 1h2v2H7V7Z',
  eyeOff: 'M1 1h2v2h2v2h2v2h2v2h2v2h2v2h-2v-2h-2v1H6v-2H3v-2H1V6h2v2h2V6L3 4V3H1V1Zm9 3h3v2h2v4h-2V8h-2V6h-1V4Z',
  lock: 'M4 1h8v2h2v5h1v7H1V8h1V3h2V1Zm2 2H4v5h8V3H6Zm1 8v2h2v-2H7Z',
  unlock: 'M6 1h6v2H8v5h7v7H1V8h5V1Zm1 10v2h2v-2H7Z',
  settings: 'M6 1h4v2h3v3h2v4h-2v3h-3v2H6v-2H3v-3H1V6h2V3h3V1Zm0 5v4h4V6H6Zm1 1h2v2H7V7Z',
  image: 'M1 2h14v12H1V2Zm2 2v8h10V4H3Zm1 6 3-3 2 2 1-1 2 2v1H4v-1Zm6-5h2v2h-2V5Z',
  folder: 'M1 3h6l2 2h6v10H1V3Zm2 4v6h10V7H3Z',
  code: 'M5 2h3L4 8l4 6H5L1 8l4-6Zm6 0h-3l4 6-4 6h3l4-6-4-6Z',
  clock: 'M6 1h4v2h3v3h2v4h-2v3h-3v2H6v-2H3v-3H1V6h2V3h3V1Zm1 3v5h4V7H9V4H7Z',
  info: 'M6 1h4v3H6V1Zm-2 5h6v7h3v2H3v-2h3V8H4V6Z',
  warning: 'M7 1h2v2h2v4h2v4h2v4H1v-4h2V7h2V3h2V1Zm0 5v4h2V6H7Zm0 6v2h2v-2H7Z',
  check: 'M1 7h3v2h2v2h2V9h2V7h2V5h3v4h-2v2h-2v2H9v2H5v-2H3v-2H1V7Z',
  drag: 'M6 0h4v3h3v3h3v4h-3v3h-3v3H6v-3H3v-3H0V6h3V3h3V0Zm1 5v2H5v2h2v2h2V9h2V7H9V5H7Z',
  scissors: 'M2 1h4v4h2v2h2V5h4V1h2v5h-4v2h-2v2h2v2h4v3h-2v-1h-4v-2H8v-2H6v2H2v2H0v-4h2v-1h4V7H2V6H0V2h2V1Zm1 2H2v1h1V3Zm0 9H2v1h1v-1Z',
  sound: 'M1 6h4l4-4v12l-4-4H1V6Zm10-2h2v2h2v4h-2v2h-2v-2h2V6h-2V4Z',
  border: 'M1 1h14v14H1V1Zm2 2v10h10V3H3Zm2 2h6v6H5V5Z',
  merge: 'M2 1h4v4h2v2h4V4h-2l3-3 3 3h-2v5H8v2H6v4H2v-4h4V5H2V1Z',
  experiment: 'M5 1h6v2h-1v4l4 6v2H2v-2l4-6V3H5V1Zm3 6-3 6h6L8 7Z',
  rocket: 'M7 1h6v6l-4 4H5V7l2-2V1Zm2 2v4h2V3H9ZM2 9h2v4h4v2H2V9Z',
  target: 'M5 1h6v2h3v3h2v4h-2v3h-3v2H5v-2H2v-3H0V6h2V3h3V1Zm1 4v6h4V9h4V7h-4V5H6Zm1 1h2v2H7V6Z',
  list: 'M1 2h3v3H1V2Zm5 0h9v3H6V2ZM1 7h3v3H1V7Zm5 0h9v3H6V7ZM1 12h3v3H1v-3Zm5 0h9v3H6v-3Z',
  layout: 'M1 1h14v14H1V1Zm2 2v3h10V3H3Zm0 5v5h4V8H3Zm6 0v5h4V8H9Z',
  moon: 'M5 1h6v2h2v3h2v5h-2v2h-3v2H5v-2H3v-2H1V5h2V3h2V1Zm2 2H5v2H3v6h2v2h5v-2H8V9H6V5h1V3Z',
  copy: 'M5 1h10v10h-4v4H1V5h4V1Zm2 2v2h4v4h2V3H7ZM3 7v6h6V7H3Z',
  zip: 'M5 1h6v2H9v2h2v2H9v2h2v6H5V9h2V7H5V5h2V3H5V1Zm2 10v2h2v-2H7Z',
  person: 'M6 1h4v2h2v4h-2v2h3v2h2v4H1v-4h2V9h3V7H4V3h2V1Zm0 2v4h4V3H6Zm-1 8v2h6v-2H5Z',
  paw: 'M2 2h3v4H2V2Zm9 0h3v4h-3V2ZM6 1h4v4H6V1ZM4 8h2V6h4v2h2v2h2v4H2v-4h2V8Zm2 1v2H4v1h8v-1h-2V9H6Z',
  map: 'M1 3l4-2 6 2 4-2v12l-4 2-6-2-4 2V3Zm2 1v8l2-1V3L3 4Zm4 0v8l3 1V5L7 4Zm5 1v8l1-1V4l-1 1Z',
  gamepad: 'M3 5h10l3 4v5h-4l-2-2H6l-2 2H0V9l3-4Zm1 2v2H2v2h2v-2h2V7H4Zm7 0v2h2V7h-2Zm2 3v2h2v-2h-2Z',
} as const

/** 内部路径名称只在此模块出现，业务组件只关心语义图标名。 */
type GlyphName = keyof typeof GLYPHS

/** 稳定工具 ID 与分类 ID直接映射到可识别图形，避免重复目录字段。 */
const ICON_MAP: Record<PixelIconName, GlyphName> = {
  video: 'play', image: 'image', gif: 'play', spritesheet: 'grid', spriteadjust: 'layout', pixelate: 'grid', expandshrink: 'drag', matte: 'scissors', geminiwatermark: 'edit', nanobananaFullChar: 'person', seedanceWatermark: 'play', assetsAndSource: 'folder', controlTest: 'gamepad', controlTestArcade: 'gamepad', xiyueWorkshop: 'settings', mapStitch: 'map', infiniteMap: 'map', aiPixelAnimals: 'paw', gemPixelPotpourri: 'grid', apiImage: 'image',
  ai: 'experiment', media: 'image', animation: 'play', map: 'map', workshop: 'settings', lab: 'experiment',
  home: 'home', search: 'search', stash: 'inbox', back: 'left', menu: 'menu', collapse: 'left', expand: 'right', favorite: 'heart', 'favorite-filled': 'heartFill', settings: 'settings', upload: 'upload', download: 'download', delete: 'trash', add: 'plus', remove: 'minus', play: 'play', pause: 'pause', stop: 'stop', retry: 'reload', save: 'save', edit: 'edit', visibility: 'eye', 'visibility-off': 'eyeOff', locked: 'lock', unlocked: 'unlock', success: 'check', warning: 'warning', error: 'close', info: 'info', external: 'right', folder: 'folder', code: 'code', clock: 'clock', left: 'left', right: 'right', up: 'up', down: 'down', drag: 'drag', copy: 'copy', scissors: 'scissors', sound: 'sound', layout: 'layout', border: 'border', merge: 'merge', experiment: 'experiment', rocket: 'rocket', target: 'target', list: 'list', moon: 'moon',
}

/** 渲染统一的 16×16 像素 SVG；颜色始终继承当前文字色。 */
export function PixelIcon({ name, size, title, ...props }: PixelIconProps) {
  const glyph = ICON_MAP[name]
  return (
    <svg
      {...props}
      width={size ?? '1em'}
      height={size ?? '1em'}
      viewBox="0 0 16 16"
      fill="currentColor"
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d={GLYPHS[glyph]} />
    </svg>
  )
}

/** 创建兼容原有 Ant 图标 JSX 名称的轻量包装，迁移不触碰业务事件代码。 */
function createPixelIcon(name: PixelIconName) {
  return function CompatiblePixelIcon(props: Omit<PixelIconProps, 'name'>) {
    return <PixelIcon {...props} name={name} />
  }
}

/** 方向、导航与基础操作图标。 */
export const AimOutlined = createPixelIcon('target')
export const ApiOutlined = createPixelIcon('apiImage')
export const AppstoreOutlined = createPixelIcon('layout')
export const ArrowDownOutlined = createPixelIcon('down')
export const ArrowLeftOutlined = createPixelIcon('left')
export const ArrowRightOutlined = createPixelIcon('right')
export const ArrowUpOutlined = createPixelIcon('up')
export const CaretLeftOutlined = createPixelIcon('left')
export const CaretRightOutlined = createPixelIcon('right')
export const HomeOutlined = createPixelIcon('home')
export const MenuFoldOutlined = createPixelIcon('collapse')
export const MenuOutlined = createPixelIcon('menu')
export const MenuUnfoldOutlined = createPixelIcon('expand')
export const SearchOutlined = createPixelIcon('search')

/** 文件、素材和编辑操作图标。 */
export const CloseOutlined = createPixelIcon('error')
export const CloudDownloadOutlined = createPixelIcon('download')
export const CopyOutlined = createPixelIcon('copy')
export const DeleteOutlined = createPixelIcon('delete')
export const DownloadOutlined = createPixelIcon('download')
export const DragOutlined = createPixelIcon('drag')
export const EditOutlined = createPixelIcon('edit')
export const ExportOutlined = createPixelIcon('external')
export const FileImageOutlined = createPixelIcon('image')
export const FileZipOutlined = createPixelIcon('folder')
export const FolderAddOutlined = createPixelIcon('folder')
export const FolderOpenOutlined = createPixelIcon('folder')
export const InboxOutlined = createPixelIcon('stash')
export const PictureOutlined = createPixelIcon('image')
export const SaveOutlined = createPixelIcon('save')
export const ScissorOutlined = createPixelIcon('scissors')
export const UploadOutlined = createPixelIcon('upload')

/** 状态、播放和显示控制图标。 */
export const AudioOutlined = createPixelIcon('sound')
export const ClockCircleOutlined = createPixelIcon('clock')
export const EyeInvisibleOutlined = createPixelIcon('visibility-off')
export const EyeOutlined = createPixelIcon('visibility')
export const HeartFilled = createPixelIcon('favorite-filled')
export const HeartOutlined = createPixelIcon('favorite')
export const LockOutlined = createPixelIcon('locked')
export const MinusOutlined = createPixelIcon('remove')
export const PauseOutlined = createPixelIcon('pause')
export const PlayCircleOutlined = createPixelIcon('play')
export const PlusOutlined = createPixelIcon('add')
export const ReloadOutlined = createPixelIcon('retry')
export const RetweetOutlined = createPixelIcon('retry')
export const SoundOutlined = createPixelIcon('sound')
export const StepBackwardOutlined = createPixelIcon('left')
export const StepForwardOutlined = createPixelIcon('right')
export const UndoOutlined = createPixelIcon('back')
export const UnlockOutlined = createPixelIcon('unlocked')

/** 工具、布局与外部资源图标。 */
export const BorderOuterOutlined = createPixelIcon('border')
export const BorderOutlined = createPixelIcon('border')
export const ClusterOutlined = createPixelIcon('merge')
export const CodeOutlined = createPixelIcon('code')
export const ExpandOutlined = createPixelIcon('expand')
export const ExperimentOutlined = createPixelIcon('experiment')
export const ForkOutlined = createPixelIcon('merge')
export const GithubOutlined = createPixelIcon('code')
export const LayoutOutlined = createPixelIcon('layout')
export const MergeCellsOutlined = createPixelIcon('merge')
export const MoonOutlined = createPixelIcon('moon')
export const OrderedListOutlined = createPixelIcon('list')
export const RocketOutlined = createPixelIcon('rocket')
export const SettingOutlined = createPixelIcon('settings')
export const ThunderboltOutlined = createPixelIcon('experiment')
