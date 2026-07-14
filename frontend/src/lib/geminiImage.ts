/** Google Gemini 图片生成请求的最小前端封装；不保存 API Key。 */
export interface GeminiImageRequest {
  /** 用户当前页面输入的 Google API Key。 */
  apiKey: string
  /** Google 官方图片模型 ID。 */
  model: string
  /** 已组合固定预设规则与用户描述的完整提示词。 */
  prompt: string
  /** 默认参考图与用户角色参考图，均已转为 Base64。 */
  referenceImages?: Array<{ mimeType: string; data: string }>
  /** 页面离开或用户停止时中止本地等待。 */
  signal?: AbortSignal
}

/** 统一保留 HTTP 状态，供页面决定是否安全自动重试。 */
export class GeminiImageError extends Error {
  /** Google 返回的 HTTP 状态；网络异常时不存在。 */
  readonly status?: number

  /** 这里保存原始错误分类，避免 UI 依赖英文报错文本。 */
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GeminiImageError'
    this.status = status
  }
}

/** 将浏览器 File 转为 API 所需的裸 Base64 数据，不产生任何持久化副本。 */
export async function fileToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new GeminiImageError('读取角色参考图失败。'))
    reader.readAsDataURL(file)
  })
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) throw new GeminiImageError('角色参考图格式无效。')
  return dataUrl.slice(commaIndex + 1)
}

/** 调用 Google GenerateContent，并只返回第一张有效图片。 */
export async function generateGeminiImage(request: GeminiImageRequest): Promise<{ mimeType: string; data: string }> {
  const parts: Array<Record<string, unknown>> = [{ text: request.prompt }]
  for (const referenceImage of request.referenceImages ?? []) {
    parts.push({ inlineData: referenceImage })
  }

  let response: Response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(request.model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': request.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts }],
        }),
        signal: request.signal,
      }
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new GeminiImageError('网络连接中断，结果可能未知，请手动重试。')
  }

  const payload = await response.json().catch(() => ({})) as {
    error?: { message?: string }
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>
  }
  if (!response.ok) {
    throw new GeminiImageError(payload.error?.message || `Google 请求失败（${response.status}）。`, response.status)
  }

  const inlineData = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.inlineData)
    .find((part) => part?.data)
  if (!inlineData?.data) {
    throw new GeminiImageError('Google 没有返回图片数据，请调整描述后重试。')
  }
  return { mimeType: inlineData.mimeType || 'image/png', data: inlineData.data }
}
