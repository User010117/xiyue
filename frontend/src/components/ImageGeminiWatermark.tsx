/**
 * 去除 Gemini 可见水印
 * 算法参考: https://github.com/allenk/GeminiWatermarkTool (MIT)
 * 仅去除可见水印，不涉及 SynthID 隐形水印
 */
import { useEffect, useRef, useState } from 'react'
import { InputNumber, Radio, Space, Typography, Upload } from 'antd'
import { DownloadOutlined } from './PixelIcons'
import type { UploadFile } from 'antd'
import { useLanguage } from '../i18n/context'
import StashDropZone from './StashDropZone'
import StashableImage from './StashableImage'
import {
  getWatermarkSize,
  locateGeminiWatermark,
  removeWatermarkReverseAlpha,
  getEmbeddedAlphaMask,
  createApproxAlphaMap,
  repairWatermarkFromEdges,
  type WatermarkRepairRect,
  type WatermarkSize,
} from '../lib/geminiWatermark'

const { Dragger } = Upload
const { Text } = Typography

const IMAGE_ACCEPT = ['.png', '.jpg', '.jpeg', '.webp']
const IMAGE_MAX_MB = 20

/** 将任意拖动方向统一成左上角起点的原图像素矩形。 */
function normalizeSelection(start: { x: number; y: number }, end: { x: number; y: number }): WatermarkRepairRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export default function ImageGeminiWatermark() {
  const { t } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [sizeMode, setSizeMode] = useState<'auto' | '48' | '96'>('auto')
  const [repairMode, setRepairMode] = useState<'automatic' | 'manual'>('automatic')
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [selection, setSelection] = useState<WatermarkRepairRect | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setImageUrl(url)
      setResultUrl(null)
      return () => URL.revokeObjectURL(url)
    }
    setImageUrl(null)
    setResultUrl(null)
  }, [file])

  /** 单独缓存已解码原图，手动框选重绘时不重复解码文件。 */
  useEffect(() => {
    if (!imageUrl) {
      setSourceImage(null)
      return
    }
    let active = true
    const image = new Image()
    image.onload = () => {
      if (active) setSourceImage(image)
    }
    image.src = imageUrl
    return () => {
      active = false
    }
  }, [imageUrl])

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [resultUrl])

  /** 手动模式始终从原图重绘，红框只用于预览，不写入导出图片。 */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !sourceImage || repairMode !== 'manual') return
    canvas.width = sourceImage.naturalWidth
    canvas.height = sourceImage.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(sourceImage, 0, 0)
    if (!selection || selection.width < 1 || selection.height < 1) return
    context.fillStyle = 'rgba(169, 67, 50, 0.16)'
    context.strokeStyle = '#A94332'
    context.lineWidth = Math.max(2, sourceImage.naturalWidth / 512)
    context.fillRect(selection.x, selection.y, selection.width, selection.height)
    context.strokeRect(selection.x, selection.y, selection.width, selection.height)
  }, [repairMode, selection, sourceImage])

  /** 将屏幕坐标换算为原图像素坐标，保证缩放预览下框选仍准确。 */
  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const bounds = canvas.getBoundingClientRect()
    return {
      x: Math.round((event.clientX - bounds.left) * canvas.width / bounds.width),
      y: Math.round((event.clientY - bounds.top) * canvas.height / bounds.height),
    }
  }

  const processImage = async () => {
    if (!sourceImage || !file) return
    setProcessing(true)
    setResultUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    try {
      const w = sourceImage.naturalWidth
      const h = sourceImage.naturalHeight

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(sourceImage, 0, 0)
      const imageData = ctx.getImageData(0, 0, w, h)

      if (repairMode === 'manual' && selection) {
        repairWatermarkFromEdges(imageData, selection)
      } else {
        const baseSize: WatermarkSize = sizeMode === 'auto' ? getWatermarkSize(w, h) : sizeMode === '48' ? 48 : 96
        let alphaMap: Float32Array
        let mapW: number
        let mapH: number
        try {
          const loaded = await getEmbeddedAlphaMask(baseSize)
          alphaMap = loaded.alpha
          mapW = loaded.width
          mapH = loaded.height
        } catch {
          alphaMap = createApproxAlphaMap(baseSize)
          mapW = mapH = baseSize
        }
        const position = locateGeminiWatermark(imageData, alphaMap, mapW, mapH, baseSize)
        removeWatermarkReverseAlpha(
          imageData,
          alphaMap,
          mapW,
          mapH,
          position.x,
          position.y,
          255,
          position.alphaScale,
        )
      }
      ctx.putImageData(imageData, 0, 0)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png')
      })
      if (blob) {
        setResultUrl(URL.createObjectURL(blob))
      }
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 720 }}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Text type="secondary">{t('geminiWatermarkHint')}</Text>
        <StashDropZone onStashDrop={(f) => { setFile(f); setSourceImage(null); setSelection(null) }} maxSizeMB={IMAGE_MAX_MB}>
          <Dragger
            accept={IMAGE_ACCEPT.join(',')}
            maxCount={1}
            fileList={file ? [{ uid: '1', name: file.name } as UploadFile] : []}
            beforeUpload={(f) => {
              setFile(f)
              setSourceImage(null)
              setSelection(null)
              return false
            }}
            onRemove={() => { setFile(null); setSourceImage(null); setSelection(null) }}
          >
            <p className="ant-upload-text">{t('imageUploadHint')}</p>
            <p className="ant-upload-hint">{t('imageFormats')}</p>
          </Dragger>
        </StashDropZone>

        {file && imageUrl && (
          <>
            <Space wrap align="center">
              <Text type="secondary">{t('geminiWatermarkMode')}:</Text>
              <Radio.Group value={repairMode} onChange={(event) => setRepairMode(event.target.value)} optionType="button" size="small">
                <Radio.Button value="automatic">{t('geminiWatermarkModeAuto')}</Radio.Button>
                <Radio.Button value="manual">{t('geminiWatermarkModeManual')}</Radio.Button>
              </Radio.Group>
            </Space>
            {repairMode === 'automatic' && <Space wrap align="center">
              <Text type="secondary">{t('geminiWatermarkSize')}:</Text>
              <Radio.Group
                value={sizeMode}
                onChange={(e) => setSizeMode(e.target.value)}
                optionType="button"
                size="small"
              >
                <Radio.Button value="auto">{t('geminiWatermarkSizeAuto')}</Radio.Button>
                <Radio.Button value="48">48×48</Radio.Button>
                <Radio.Button value="96">96×96</Radio.Button>
              </Radio.Group>
            </Space>}
            {repairMode === 'manual' && sourceImage && (
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <Text type="secondary">{t('geminiWatermarkManualHint')}</Text>
                <canvas
                  ref={canvasRef}
                  role="img"
                  aria-label={t('geminiWatermarkManualCanvas')}
                  tabIndex={0}
                  onPointerDown={(event) => {
                    const point = getCanvasPoint(event)
                    dragStartRef.current = point
                    event.currentTarget.setPointerCapture(event.pointerId)
                    setSelection({ ...point, width: 0, height: 0 })
                  }}
                  onPointerMove={(event) => {
                    if (dragStartRef.current) setSelection(normalizeSelection(dragStartRef.current, getCanvasPoint(event)))
                  }}
                  onPointerUp={(event) => {
                    if (dragStartRef.current) setSelection(normalizeSelection(dragStartRef.current, getCanvasPoint(event)))
                    dragStartRef.current = null
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
                  }}
                  style={{ display: 'block', width: 'min(100%, 640px)', height: 'auto', border: '2px solid #2D2926', cursor: 'crosshair', touchAction: 'none', imageRendering: 'pixelated' }}
                />
                <Space wrap>
                  {(['x', 'y', 'width', 'height'] as const).map((field) => (
                    <label key={field} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Text>{field}</Text>
                      <InputNumber
                        size="small"
                        min={field === 'x' || field === 'y' ? 0 : 1}
                        max={field === 'x' || field === 'width' ? sourceImage.naturalWidth : sourceImage.naturalHeight}
                        value={selection?.[field]}
                        onChange={(value) => setSelection((current) => ({
                          x: current?.x ?? 0,
                          y: current?.y ?? 0,
                          width: current?.width ?? 1,
                          height: current?.height ?? 1,
                          [field]: value ?? 0,
                        }))}
                      />
                    </label>
                  ))}
                </Space>
              </Space>
            )}
            <Space wrap>
              <button
                type="button"
                onClick={processImage}
                disabled={processing || !sourceImage || (repairMode === 'manual' && (!selection || selection.width < 1 || selection.height < 1))}
                style={{
                  padding: '10px 24px',
                  border: '1px solid #2D2926',
                  borderRadius: 4,
                  background: '#A94332',
                  color: '#fff',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  opacity: processing ? 0.7 : 1,
                }}
              >
                {processing ? t('geminiWatermarkProcessing') : t('geminiWatermarkRemove')}
              </button>
              {resultUrl && (
                <a
                  href={resultUrl}
                  download={`${file.name.replace(/\.[^.]+$/, '')}-no-watermark.png`}
                  style={{
                    padding: '10px 24px',
                    border: '1px solid #2D2926',
                    borderRadius: 4,
                    background: '#D8CBB5',
                    color: '#3d3428',
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <DownloadOutlined /> {t('geminiWatermarkDownload')}
                </a>
              )}
            </Space>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('geminiWatermarkOriginal')}</Text>
                {repairMode === 'manual'
                  ? <Text type="secondary">{t('geminiWatermarkSelectionShownAbove')}</Text>
                  : <StashableImage src={imageUrl} alt="" style={{ maxWidth: 360, maxHeight: 360, borderRadius: 0, border: '1px solid #2D2926' }} />}
              </div>
              {resultUrl && (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('geminiWatermarkResult')}</Text>
                  <StashableImage src={resultUrl} alt="" style={{ maxWidth: 360, maxHeight: 360, borderRadius: 0, border: '1px solid #2D2926' }} />
                </div>
              )}
            </div>

            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {t('geminiWatermarkDisclaimer')}
            </Text>
          </>
        )}
      </Space>
    </div>
  )
}
