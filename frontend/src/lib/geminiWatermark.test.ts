import { describe, expect, it } from 'vitest'
import { locateGeminiWatermark, removeWatermarkReverseAlpha, repairWatermarkFromEdges } from './geminiWatermark'

/** 创建纯色测试图，避免自动定位测试依赖浏览器 Canvas。 */
function createSolidImageData(width: number, height: number): Pick<ImageData, 'data' | 'width' | 'height'> {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < data.length; index += 4) data.set([40, 140, 60, 255], index)
  return { data, width, height }
}

/** 按白色角标的 Alpha 混合公式，把测试蒙版叠加到指定位置。 */
function applyWatermark(
  imageData: Pick<ImageData, 'data' | 'width' | 'height'>,
  alphaMap: Float32Array,
  mapSize: number,
  x: number,
  y: number,
  alphaScale = 1,
): void {
  for (let mapY = 0; mapY < mapSize; mapY++) {
    for (let mapX = 0; mapX < mapSize; mapX++) {
      const alpha = (alphaMap[mapY * mapSize + mapX] ?? 0) * alphaScale
      const index = ((y + mapY) * imageData.width + x + mapX) * 4
      for (let channel = 0; channel < 3; channel++) {
        const original = imageData.data[index + channel] ?? 0
        imageData.data[index + channel] = Math.round(original * (1 - alpha) + 255 * alpha)
      }
    }
  }
}

describe('repairWatermarkFromEdges', () => {
  it('使用周围背景像素覆盖选区', () => {
    const width = 5
    const height = 5
    const data = new Uint8ClampedArray(width * height * 4)
    for (let index = 0; index < data.length; index += 4) {
      data.set([20, 140, 40, 255], index)
    }
    data.set([255, 255, 255, 255], (2 * width + 2) * 4)

    repairWatermarkFromEdges({ data, width, height }, { x: 2, y: 2, width: 1, height: 1 })

    expect(Array.from(data.slice((2 * width + 2) * 4, (2 * width + 2) * 4 + 4))).toEqual([20, 140, 40, 255])
  })
})

describe('locateGeminiWatermark', () => {
  it('能识别 1024 图片中距边缘 96px 的新版 48px 角标', () => {
    const imageData = createSolidImageData(1024, 1024)
    const mapSize = 48
    const alphaMap = new Float32Array(mapSize * mapSize)
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        const distance = Math.abs(x - 24) + Math.abs(y - 24)
        alphaMap[y * mapSize + x] = Math.max(0, 0.5 - distance / 48)
      }
    }
    applyWatermark(imageData, alphaMap, mapSize, 880, 880, 0.6)

    const location = locateGeminiWatermark(imageData, alphaMap, mapSize, mapSize, 48)
    expect(location).toEqual({
      x: 880,
      y: 880,
      alphaScale: 0.6,
    })
    removeWatermarkReverseAlpha(
      imageData,
      alphaMap,
      mapSize,
      mapSize,
      location.x,
      location.y,
      255,
      location.alphaScale,
    )
    const centerIndex = ((880 + 24) * imageData.width + 880 + 24) * 4
    const restored = Array.from(imageData.data.slice(centerIndex, centerIndex + 3))
    expect(Math.abs((restored[0] ?? 0) - 40)).toBeLessThanOrEqual(1)
    expect(Math.abs((restored[1] ?? 0) - 140)).toBeLessThanOrEqual(1)
    expect(Math.abs((restored[2] ?? 0) - 60)).toBeLessThanOrEqual(1)
  })

  it('继续兼容距边缘 32px 的旧版 48px 角标', () => {
    const imageData = createSolidImageData(1024, 1024)
    const mapSize = 48
    const alphaMap = new Float32Array(mapSize * mapSize)
    for (let index = 0; index < alphaMap.length; index++) alphaMap[index] = (index % mapSize) / 96
    applyWatermark(imageData, alphaMap, mapSize, 944, 944)

    expect(locateGeminiWatermark(imageData, alphaMap, mapSize, mapSize, 48)).toEqual({
      x: 944,
      y: 944,
      alphaScale: 1,
    })
  })
})
