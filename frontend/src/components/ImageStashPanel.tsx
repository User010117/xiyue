import { useRef, useState } from 'react'
import {
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  UploadOutlined,
} from './PixelIcons'
import { Alert, Button, Drawer, Empty, Image, Popconfirm, Segmented, Space, Typography, message } from 'antd'
import { canUseLocalWorkspace, useLocalWorkspace } from '../localWorkspace/context'
import { useImageStash } from '../stash/context'

const { Text } = Typography
const STASH_DRAG_TYPE = 'application/x-xiyue-stash-url'

interface Props {
  /** 抽屉由顶栏统一控制，默认关闭，避免遮挡工作页面。 */
  open: boolean
  /** 关闭后不销毁素材状态。 */
  onClose: () => void
}

/** 使用浏览器原生下载能力，保持静态部署可用。 */
function downloadImage(url: string, name?: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name?.replace(/[^\w.-]+/g, '_') || `xiyue_${Date.now()}.png`
  anchor.click()
}

/** 右侧素材抽屉：保留会话暂存与可选本地文件夹两种既有能力。 */
export default function ImageStashPanel({ open, onClose }: Props) {
  const { items, addImage, removeImage, clearAll, storageError, clearStorageError } = useImageStash()
  const {
    folderName,
    selectFolder,
    useLocalFolderMode,
    setUseLocalFolderMode,
    localFolderItems,
    loadLocalFolderImages,
    saveFileToFolder,
    removeFileFromFolder,
  } = useLocalWorkspace()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const displayItems = useLocalFolderMode ? localFolderItems : items

  /** 文件输入和拖放共用同一接收路径，避免两套校验逻辑漂移。 */
  const acceptFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      if (useLocalFolderMode) await saveFileToFolder(file)
      else await addImage(URL.createObjectURL(file), file.name)
    }
    if (useLocalFolderMode) await loadLocalFolderImages()
  }

  return (
    <Drawer
      title={<Space><InboxOutlined />素材暂存 <Text type="secondary">{displayItems.length}</Text></Space>}
      placement="right"
      size={380}
      open={open}
      mask={false}
      onClose={onClose}
      className="image-stash-drawer"
      extra={
        !useLocalFolderMode && items.length > 0 ? (
          <Popconfirm title="清空所有暂存图片？" onConfirm={clearAll}>
            <Button type="text" danger icon={<DeleteOutlined />}>清空</Button>
          </Popconfirm>
        ) : null
      }
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {storageError && <Alert type="warning" showIcon closable title={storageError} afterClose={clearStorageError} />}

        {canUseLocalWorkspace && (
          <Segmented
            block
            value={useLocalFolderMode ? 'folder' : 'stash'}
            onChange={(value) => setUseLocalFolderMode(value === 'folder')}
            options={[{ value: 'stash', label: '本次暂存' }, { value: 'folder', label: '本地文件夹' }]}
          />
        )}

        {useLocalFolderMode && (
          <Button
            block
            icon={<FolderOpenOutlined />}
            onClick={async () => {
              if (await selectFolder()) await loadLocalFolderImages()
            }}
          >
            {folderName || '选择本地素材文件夹'}
          </Button>
        )}

        <button
          type="button"
          className="stash-upload-zone"
          data-dragging={dragging}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void acceptFiles(event.dataTransfer.files)
          }}
        >
          <UploadOutlined />
          <span>{useLocalFolderMode ? '拖入图片保存到文件夹' : '拖入图片，或点击选择'}</span>
        </button>
        <input
          ref={inputRef}
          hidden
          multiple
          type="file"
          accept="image/*"
          onChange={(event) => event.target.files && void acceptFiles(event.target.files)}
        />

        {displayItems.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂存区还是空的" /> : (
          <div className="stash-grid">
            {displayItems.map((item) => (
              <div
                className="stash-grid-item"
                key={item.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(STASH_DRAG_TYPE, item.url)
                  event.dataTransfer.setData('application/x-xiyue-stash-name', item.name || '')
                }}
              >
                <Image src={item.url} alt={item.name || '暂存图片'} preview={{ mask: '预览' }} />
                <Text ellipsis={{ tooltip: item.name }} className="stash-grid-name">{item.name || '未命名图片'}</Text>
                <Space size={4}>
                  <Button type="text" icon={<DownloadOutlined />} aria-label="下载" onClick={() => downloadImage(item.url, item.name)} />
                  {!useLocalFolderMode && canUseLocalWorkspace && (
                    <Button
                      type="text"
                      icon={<FolderAddOutlined />}
                      aria-label="保存到本地文件夹"
                      onClick={async () => {
                        if (!folderName && !(await selectFolder())) return
                        const response = await fetch(item.url)
                        const blob = await response.blob()
                        const file = new File([blob], item.name || `xiyue_${Date.now()}.png`, { type: blob.type || 'image/png' })
                        if (await saveFileToFolder(file)) message.success('已保存到本地文件夹')
                      }}
                    />
                  )}
                  <Button
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    aria-label="移除"
                    onClick={() => useLocalFolderMode ? void removeFileFromFolder(item.name || '') : removeImage(item.id)}
                  />
                </Space>
              </div>
            ))}
          </div>
        )}
      </Space>
    </Drawer>
  )
}
