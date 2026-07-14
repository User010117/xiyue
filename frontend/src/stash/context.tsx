import {
  createContext,
  useCallback,
  useContext,
  useId,
  useState,
} from 'react'

export interface StashItem {
  id: string
  url: string
  name?: string
}

const STORAGE_KEY = 'xiyue_stash'

async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  if (!url.startsWith('blob:')) return url
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

function loadFromSession(): StashItem[] {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY)
    if (!s) return []
    const parsed = JSON.parse(s) as StashItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveToSession(items: StashItem[]): string | null {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    return null
  } catch {
    return '暂存区空间不足，本次图片仍可使用，但刷新页面后可能丢失。请下载或删除部分图片。'
  }
}

interface ImageStashContextValue {
  items: StashItem[]
  addImage: (url: string, name?: string) => void
  removeImage: (id: string) => void
  clearAll: () => void
  /** sessionStorage 写入失败必须暴露给界面，避免用户误以为素材已保存。 */
  storageError: string | null
  /** 用户处理完容量问题后可关闭提示。 */
  clearStorageError: () => void
}

const ImageStashContext = createContext<ImageStashContextValue | null>(null)

export function ImageStashProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<StashItem[]>(() => loadFromSession())
  const [storageError, setStorageError] = useState<string | null>(null)
  const idSeed = useId()

  const addImage = useCallback(
    async (url: string, name?: string) => {
      const id = `${idSeed}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      let persistUrl: string
      if (url.startsWith('blob:')) {
        persistUrl = await urlToDataUrl(url).catch(() => url)
        if (persistUrl !== url) URL.revokeObjectURL(url)
      } else {
        persistUrl = url
      }
      setItems((prev) => {
        const next = [...prev, { id, url: persistUrl, name }]
        const error = saveToSession(next)
        queueMicrotask(() => setStorageError(error))
        return next
      })
    },
    [idSeed]
  )

  const removeImage = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item?.url.startsWith('blob:')) URL.revokeObjectURL(item.url)
      const next = prev.filter((i) => i.id !== id)
      const error = saveToSession(next)
      queueMicrotask(() => setStorageError(error))
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((i) => {
        if (i.url.startsWith('blob:')) URL.revokeObjectURL(i.url)
      })
      const error = saveToSession([])
      queueMicrotask(() => setStorageError(error))
      return []
    })
  }, [])

  return (
    <ImageStashContext.Provider value={{ items, addImage, removeImage, clearAll, storageError, clearStorageError: () => setStorageError(null) }}>
      {children}
    </ImageStashContext.Provider>
  )
}

export function useImageStash() {
  const ctx = useContext(ImageStashContext)
  if (!ctx) throw new Error('useImageStash must be used within ImageStashProvider')
  return ctx
}
