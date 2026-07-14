import { lazy, Suspense, useEffect, useState } from 'react'
import { Button, Card, Col, Row, Spin, Typography } from 'antd'
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  ClusterOutlined,
  ExperimentOutlined,
  ExpandOutlined,
  ForkOutlined,
  MergeCellsOutlined,
  ScissorOutlined,
  SoundOutlined,
} from './PixelIcons'
import { useLanguage } from '../i18n/context'
// 工坊子工具体积差异很大，只在用户进入具体能力时下载。
const XiyueWorkshopAdvancedPixel = lazy(() => import('./XiyueWorkshopAdvancedPixel'))
const XiyueWorkshopAudioCompress = lazy(() => import('./XiyueWorkshopAudioCompress'))
const XiyueWorkshopCustomScale = lazy(() => import('./XiyueWorkshopCustomScale'))
const XiyueWorkshopCustomSlice = lazy(() => import('./XiyueWorkshopCustomSlice'))
const XiyueWorkshopCustomWorkflow = lazy(() => import('./XiyueWorkshopCustomWorkflow'))
const XiyueWorkshopDuplicateFrames = lazy(() => import('./XiyueWorkshopDuplicateFrames'))
const XiyueWorkshopRseprite = lazy(() => import('./XiyueWorkshopRseprite'))
const XiyueWorkshopScatterSlice = lazy(() => import('./XiyueWorkshopScatterSlice'))
const XiyueWorkshopSheetPro = lazy(() => import('./XiyueWorkshopSheetPro'))
const XiyueWorkshopUnifySize = lazy(() => import('./XiyueWorkshopUnifySize'))

const ACCENT = '#C89332'
const ICON_BOX = 44

const XIYUE_FEATURE_ENTRIES = [
  {
    id: 'sheetPro' as const,
    Icon: AppstoreOutlined,
    titleKey: 'xiyueWorkshopSheetPro',
    descKey: 'xiyueWorkshopSheetProHint',
  },
  {
    id: 'scatterSlice' as const,
    Icon: ScissorOutlined,
    titleKey: 'xiyueWorkshopScatterSlice',
    descKey: 'xiyueWorkshopScatterSliceDesc',
  },
  {
    id: 'customSlice' as const,
    Icon: ScissorOutlined,
    titleKey: 'xiyueWorkshopCustomSlice',
    descKey: 'xiyueWorkshopCustomSliceHint',
  },
  {
    id: 'customScale' as const,
    Icon: ExpandOutlined,
    titleKey: 'xiyueWorkshopCustomScale',
    descKey: 'xiyueWorkshopCustomScaleHint',
  },
  {
    id: 'audioCompress' as const,
    Icon: SoundOutlined,
    titleKey: 'xiyueWorkshopAudioCompress',
    descKey: 'xiyueWorkshopAudioCompressCardDesc',
  },
  {
    id: 'unifySize' as const,
    Icon: MergeCellsOutlined,
    titleKey: 'xiyueWorkshopUnifySize',
    descKey: 'xiyueWorkshopUnifySizeHint',
  },
  {
    id: 'duplicateFrames' as const,
    Icon: ClusterOutlined,
    titleKey: 'xiyueWorkshopDupFrames',
    descKey: 'xiyueWorkshopDupFramesCardDesc',
  },
  {
    id: 'customWorkflow' as const,
    Icon: ForkOutlined,
    titleKey: 'xiyueWorkshopCustomWorkflow',
    descKey: 'xiyueWorkshopCustomWorkflowHint',
  },
  {
    id: 'advancedPixel' as const,
    Icon: ExperimentOutlined,
    titleKey: 'xiyueWorkshopAdvancedPixel',
    descKey: 'xiyueWorkshopAdvancedPixelCardDesc',
  },
  {
    id: 'rseprite' as const,
    Icon: AppstoreOutlined,
    titleKey: 'xiyueWorkshopRseprite',
    descKey: 'xiyueWorkshopRsepriteCardDesc',
  },
]

interface XiyueWorkshopProps {
  onBack?: () => void
  deepLinkFeature?: string | null
  onDeepLinkConsumed?: () => void
  onSendToFineProcess?: (blob: Blob, suggestedFilename: string) => void
}

export default function XiyueWorkshop({
  deepLinkFeature = null,
  onDeepLinkConsumed,
  onSendToFineProcess,
}: XiyueWorkshopProps) {
  const { t } = useLanguage()
  const [activeFeature, setActiveFeature] = useState<string | null>(null)

  useEffect(() => {
    if (!deepLinkFeature) return
    setActiveFeature(deepLinkFeature)
    onDeepLinkConsumed?.()
  }, [deepLinkFeature, onDeepLinkConsumed])

  const displayedFeature = deepLinkFeature === 'sheetPro' ? 'sheetPro' : activeFeature

  /** 工坊卡片可能位于长列表下方，进入或退出子工具时统一回到页面标题。 */
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [displayedFeature])

  const shellMaxWidth =
    displayedFeature === 'customWorkflow' || displayedFeature === 'rseprite' || displayedFeature === 'sheetPro' || displayedFeature === 'scatterSlice'
      ? 'min(calc(100vw - 40px), 1920px)'
      : 1200

  return (
    <div
      style={{
        padding: '20px 24px 32px',
        maxWidth: shellMaxWidth,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {displayedFeature && (
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setActiveFeature(null)}>
            {t('xiyueWorkshopBack')}
          </Button>
        </div>
      )}

      {!displayedFeature ? (
        <div>
          <Typography.Paragraph
            type="secondary"
            style={{
              marginBottom: 24,
              marginTop: 0,
              fontSize: 14,
              lineHeight: 1.65,
              maxWidth: 720,
            }}
          >
            {t('moduleXiyueWorkshopDesc')}
          </Typography.Paragraph>
          <Row gutter={[20, 20]}>
            {XIYUE_FEATURE_ENTRIES.map(({ id, Icon, titleKey, descKey }) => (
              <Col key={id} xs={24} sm={24} md={12} lg={12}>
                <Card
                  hoverable
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveFeature(id)
                    }
                  }}
                  styles={{
                    body: {
                      padding: '18px 20px',
                      height: '100%',
                    },
                  }}
                  style={{
                    height: '100%',
                    minHeight: 112,
                    borderRadius: 0,
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                  }}
                  onClick={() => setActiveFeature(id)}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      alignItems: 'flex-start',
                      height: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: ICON_BOX,
                        height: ICON_BOX,
                        borderRadius: 0,
                        background: '#FFF8E8',
                        border: '2px solid #2D2926',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon style={{ fontSize: 22, color: ACCENT }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text
                        strong
                        style={{
                          fontSize: 15,
                          display: 'block',
                          marginBottom: 8,
                          color: 'var(--ant-color-text)',
                        }}
                      >
                        {t(titleKey)}
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        style={{
                          fontSize: 12,
                          lineHeight: 1.6,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical' as const,
                          overflow: 'hidden',
                        }}
                      >
                        {t(descKey)}
                      </Typography.Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ) : <Suspense fallback={<div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>}>{displayedFeature === 'customSlice' ? (
        <XiyueWorkshopCustomSlice />
      ) : displayedFeature === 'scatterSlice' ? (
        <XiyueWorkshopScatterSlice />
      ) : displayedFeature === 'customScale' ? (
        <XiyueWorkshopCustomScale />
      ) : displayedFeature === 'audioCompress' ? (
        <XiyueWorkshopAudioCompress />
      ) : displayedFeature === 'unifySize' ? (
        <XiyueWorkshopUnifySize />
      ) : displayedFeature === 'duplicateFrames' ? (
        <XiyueWorkshopDuplicateFrames />
      ) : displayedFeature === 'sheetPro' ? (
        <XiyueWorkshopSheetPro />
      ) : displayedFeature === 'customWorkflow' ? (
        <XiyueWorkshopCustomWorkflow onSendToFineProcess={onSendToFineProcess} />
      ) : displayedFeature === 'advancedPixel' ? (
        <XiyueWorkshopAdvancedPixel />
      ) : displayedFeature === 'rseprite' ? (
        <XiyueWorkshopRseprite />
      ) : null}</Suspense>}
    </div>
  )
}
