import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Checkbox, Slider, Space, Typography } from 'antd'
import {
  DEFAULT_PAINT_RGBA,
  EditorCanvas,
  ERASER_RGBA,
  RsepriteLayerPanel,
  RsepritePaletteBar,
  RsepriteTimeline,
  useRsepriteState,
} from './Rseprite'
import type { Rgba, RsepriteTool } from './Rseprite'
import { useLanguage } from '../i18n/context'

const DEFAULT_W = 64
const DEFAULT_H = 64

/**
 * XiyueWorkshop — Rseprite：Aseprite 类像素动画编辑
 * 第 1 步：文档；第 2～5 步：画布与历史；第 6 步：图层；第 7～9 步：多帧、复制帧、延时、洋葱皮
 */
export default function XiyueWorkshopRseprite() {
  const { t } = useLanguage()
  const {
    doc,
    activeFrameIndex,
    activeLayerIndex,
    dispatch,
    resetDocument,
    setActiveLayer,
    setActiveFrame,
    addFrame,
    deleteFrame,
    setFrameDuration,
    setLayerVisible,
    setLayerLocked,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useRsepriteState(DEFAULT_W, DEFAULT_H)

  const [tool, setTool] = useState<RsepriteTool>('pencil')
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(false)
  const [onionSkinOpacityPct, setOnionSkinOpacityPct] = useState(35)
  const [primaryColor, setPrimaryColor] = useState<Rgba>(DEFAULT_PAINT_RGBA)
  const [secondaryColor, setSecondaryColor] = useState<Rgba>([
    255, 255, 255, 255,
  ])

  const paintRgba = useMemo((): Rgba => {
    if (tool === 'eraser') return ERASER_RGBA
    return primaryColor
  }, [tool, primaryColor])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el?.isContentEditable
      ) {
        return
      }
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'z') {
        if (e.shiftKey) {
          if (!canRedo) return
          e.preventDefault()
          redo()
        } else {
          if (!canUndo) return
          e.preventDefault()
          undo()
        }
        return
      }
      if (k === 'y') {
        if (!canRedo) return
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, canUndo, canRedo])

  const onPaintPixels = useCallback(
    (
      pixels: Array<{ x: number; y: number }>,
      rgba: readonly [number, number, number, number],
    ) => {
      dispatch({
        type: 'PAINT_PIXELS',
        frameIndex: activeFrameIndex,
        celIndex: activeLayerIndex,
        pixels,
        rgba,
      })
    },
    [dispatch, activeFrameIndex, activeLayerIndex],
  )

  useEffect(() => {
    console.info('[Rseprite Step1] document', doc)
  }, [doc])

  const activeLayerLocked = doc.layers[activeLayerIndex]?.locked ?? true

  const step1Stats = useMemo(() => {
    const cur = doc.frames[activeFrameIndex] ?? doc.frames[0]
    const cel0 = cur?.cels[0]
    const imageData = cel0?.imageData
    return {
      frameCount: doc.frames.length,
      layerCount: doc.layers.length,
      celCount: cur?.cels.length ?? 0,
      celW: imageData?.width ?? 0,
      celH: imageData?.height ?? 0,
      bufferBytes: imageData?.data?.byteLength ?? 0,
    }
  }, [doc, activeFrameIndex])

  const milestones: string[] = [
    t('xiyueWorkshopRsepriteRoadmapM1'),
    t('xiyueWorkshopRsepriteRoadmapM2'),
    t('xiyueWorkshopRsepriteRoadmapM3'),
  ]

  return (
    <div style={{ width: '100%', maxWidth: 'min(calc(100vw - 48px), 1920px)' }}>
      <Typography.Paragraph style={{ marginBottom: 16, fontSize: 15 }}>
        {t('xiyueWorkshopRsepriteLead')}
      </Typography.Paragraph>

      <Card
        size="small"
        title={t('xiyueWorkshopRsepriteStep1Title')}
        style={{ marginBottom: 16 }}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {t('xiyueWorkshopRsepriteStep1Intro')}
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          <Typography.Text strong>{t('xiyueWorkshopRsepriteStep1DocSize')}：</Typography.Text>{' '}
          {doc.width} × {doc.height}
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          <Typography.Text strong>{t('xiyueWorkshopRsepriteStep1Frames')}：</Typography.Text>{' '}
          {step1Stats.frameCount}（{t('xiyueWorkshopRsepriteStep1Expect')} ≥ 1）
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          <Typography.Text strong>{t('xiyueWorkshopRsepriteStep1Layers')}：</Typography.Text>{' '}
          {step1Stats.layerCount}（{t('xiyueWorkshopRsepriteStep1Expect')} ≥ 2）
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          <Typography.Text strong>{t('xiyueWorkshopRsepriteStep1Cels')}：</Typography.Text>{' '}
          {step1Stats.celCount}（{t('xiyueWorkshopRsepriteStep1Expect')}{' '}
          {step1Stats.layerCount}）
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          <Typography.Text strong>{t('xiyueWorkshopRsepriteStep1CelBuffer')}：</Typography.Text>{' '}
          {t('xiyueWorkshopRsepriteStep1CurrentFrame')} {activeFrameIndex + 1} — {step1Stats.celW} ×{' '}
          {step1Stats.celH} RGBA，{step1Stats.bufferBytes} {t('xiyueWorkshopRsepriteStep1Bytes')}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
          {t('xiyueWorkshopRsepriteStep1Console')}
        </Typography.Paragraph>
        <Space wrap>
          <Button size="small" onClick={() => resetDocument(32, 32)}>
            {t('xiyueWorkshopRsepriteStep1Reset32')}
          </Button>
          <Button size="small" onClick={() => resetDocument(DEFAULT_W, DEFAULT_H)}>
            {t('xiyueWorkshopRsepriteStep1Reset64')}
          </Button>
        </Space>
      </Card>

      <Card
        size="small"
        title={t('xiyueWorkshopRsepriteStep2Title')}
        styles={{ body: { padding: 0 } }}
        style={{ marginBottom: 20 }}
      >
        <RsepritePaletteBar
          tool={tool}
          onToolChange={setTool}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          onPrimaryChange={setPrimaryColor}
          onSecondaryChange={setSecondaryColor}
        />
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <Space wrap align="center">
            <Button size="small" disabled={!canUndo} onClick={undo}>
              {t('xiyueWorkshopRsepriteUndo')}
            </Button>
            <Button size="small" disabled={!canRedo} onClick={redo}>
              {t('xiyueWorkshopRsepriteRedo')}
            </Button>
            <Checkbox
              checked={onionSkinEnabled}
              onChange={(e) => setOnionSkinEnabled(e.target.checked)}
              disabled={doc.frames.length < 2}
            >
              {t('xiyueWorkshopRsepriteOnionSkin')}
            </Checkbox>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('xiyueWorkshopRsepriteOnionOpacity')}
            </Typography.Text>
            <Slider
              min={5}
              max={100}
              value={onionSkinOpacityPct}
              onChange={setOnionSkinOpacityPct}
              disabled={!onionSkinEnabled || doc.frames.length < 2}
              style={{ width: 120, margin: 0 }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {onionSkinOpacityPct}%
            </Typography.Text>
          </Space>
        </div>
        <RsepriteTimeline
          doc={doc}
          activeFrameIndex={activeFrameIndex}
          onSelectFrame={setActiveFrame}
          onDuplicateFrame={addFrame}
          onDeleteFrame={deleteFrame}
          onFrameDurationChange={setFrameDuration}
        />
        <RsepriteLayerPanel
          layers={doc.layers}
          activeLayerIndex={activeLayerIndex}
          onSelectLayer={setActiveLayer}
          onToggleVisible={setLayerVisible}
          onToggleLocked={setLayerLocked}
        />
        <EditorCanvas
          doc={doc}
          frameIndex={activeFrameIndex}
          activeLayerIndex={activeLayerIndex}
          minHeight={280}
          onPaintPixels={activeLayerLocked ? undefined : onPaintPixels}
          paintRgba={paintRgba}
          onionSkinEnabled={onionSkinEnabled}
          onionSkinOpacity={onionSkinOpacityPct / 100}
        />
        <Typography.Paragraph
          type="secondary"
          style={{ margin: '10px 12px 4px', fontSize: 12 }}
        >
          {t('xiyueWorkshopRsepriteStep2Hint')}
        </Typography.Paragraph>
        <Typography.Paragraph
          type="secondary"
          style={{ margin: '0 12px 4px', fontSize: 12 }}
        >
          {t('xiyueWorkshopRsepriteStep3Hint')}
        </Typography.Paragraph>
        <Typography.Paragraph
          type="secondary"
          style={{ margin: '0 12px 4px', fontSize: 12 }}
        >
          {t('xiyueWorkshopRsepriteStep4Hint')}
        </Typography.Paragraph>
        <Typography.Paragraph
          type="secondary"
          style={{ margin: '0 12px 4px', fontSize: 12 }}
        >
          {t('xiyueWorkshopRsepriteStep5Hint')}
        </Typography.Paragraph>
        <Typography.Paragraph
          type="secondary"
          style={{ margin: '0 12px 4px', fontSize: 12 }}
        >
          {t('xiyueWorkshopRsepriteStep6Hint')}
        </Typography.Paragraph>
        <Typography.Paragraph
          type="secondary"
          style={{ margin: '0 12px 4px', fontSize: 12 }}
        >
          {t('xiyueWorkshopRsepriteStep7Hint')}
        </Typography.Paragraph>
        <Typography.Paragraph
          type="secondary"
          style={{ margin: '0 12px 4px', fontSize: 12 }}
        >
          {t('xiyueWorkshopRsepriteStep8Hint')}
        </Typography.Paragraph>
        <Typography.Paragraph
          type="secondary"
          style={{ margin: '0 12px 12px', fontSize: 12 }}
        >
          {t('xiyueWorkshopRsepriteStep9Hint')}
        </Typography.Paragraph>
      </Card>

      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
        {t('xiyueWorkshopRsepriteRoadmapTitle')}
      </Typography.Title>
      <ul style={{ margin: '0 0 16px 0', paddingLeft: 20, lineHeight: 1.8 }}>
        {milestones.map((item) => (
          <li key={item}>
            <Typography.Text>{item}</Typography.Text>
          </li>
        ))}
      </ul>

      <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
        {t('xiyueWorkshopRsepriteDocLine')}
      </Typography.Paragraph>
    </div>
  )
}
