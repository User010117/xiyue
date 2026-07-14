"""
Seedance 2.0 水印去除
参考: https://github.com/SamurAIGPT/seedance-2.0-watermark-remover
去除 Seedance / 即梦 视频中的「AI生成」角标水印，使用 OpenCV TELEA 修复。
"""
import subprocess
import shutil
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np

from .processor import JobCancelled


def _auto_detect(mean_gray: np.ndarray, std_map: np.ndarray, width: int, height: int) -> Optional[tuple[int, int, int, int]]:
    """
    扫描四个角定位水印。
    评分: edge_density × temporal_stability
    """
    corner_h = max(60, int(height * 0.08))
    corner_w = max(120, int(width * 0.12))
    corners = [
        (0, 0, corner_h, corner_w),
        (0, width - corner_w, corner_h, width),
        (height - corner_h, 0, height, corner_w),
        (height - corner_h, width - corner_w, height, width),
    ]

    best, best_score = None, 0
    for r1, c1, r2, c2 in corners:
        roi_gray = mean_gray[r1:r2, c1:c2]
        edges = cv2.Canny(roi_gray, 20, 60)
        edge_density = edges.mean() / 255.0
        temporal_std = std_map[r1:r2, c1:c2].mean()
        stability = 1.0 / (1.0 + temporal_std)
        score = edge_density * stability

        if score > best_score and edge_density > 0.002:
            ys, xs = np.where(edges > 0)
            if len(xs) > 20:
                best_score = score
                pad = 8
                x = max(0, c1 + int(xs.min()) - pad)
                y = max(0, r1 + int(ys.min()) - pad)
                w = min(width - x, int(xs.max() - xs.min()) + 1 + 2 * pad)
                h = min(height - y, int(ys.max() - ys.min()) + 1 + 2 * pad)
                best = (x, y, w, h)

    return best


def _build_mask(mean_frame_gray: np.ndarray, region_xywh: tuple, frame_shape: tuple) -> np.ndarray:
    """使用 Canny 边缘检测在平均帧上构建文本蒙版"""
    x, y, w, h = region_xywh
    H, W = frame_shape[:2]
    roi_gray = mean_frame_gray[y:y + h, x:x + w]
    edges = cv2.Canny(roi_gray, 30, 80)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    dilated = cv2.dilate(edges, kernel, iterations=1)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(dilated)
    clean = np.zeros_like(dilated)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= 100:
            clean[labels == i] = 255
    if clean.sum() == 0:
        clean = np.full((h, w), 255, dtype=np.uint8)
    mask = np.zeros((H, W), dtype=np.uint8)
    mask[y:y + h, x:x + w] = clean
    return mask


def remove_watermark(
    input_path: str,
    output_path: str,
    manual_region: Optional[tuple[int, int, int, int]] = None,
    on_progress: Optional[Callable[[int, int], None]] = None,
) -> bool:
    """
    去除视频水印。返回是否成功。
    on_progress: (current, total) -> None，可选进度回调。
    """
    cap = cv2.VideoCapture(input_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # 最多采样 24 张缩小灰度帧，并在线计算均值/方差，避免堆叠全分辨率 float32 数据。
    sample_count = 0
    sample_mean = None
    sample_m2 = None
    sample_scale = min(1.0, 640 / max(width, height))
    sample_width = max(1, round(width * sample_scale))
    sample_height = max(1, round(height * sample_scale))
    step = max(1, total // 24)
    for i in range(0, total, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, f = cap.read()
        if ret:
            gray = cv2.cvtColor(cv2.resize(f, (sample_width, sample_height), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32)
            sample_count += 1
            if sample_mean is None:
                sample_mean = gray.copy()
                sample_m2 = np.zeros_like(gray)
            else:
                delta = gray - sample_mean
                sample_mean += delta / sample_count
                sample_m2 += delta * (gray - sample_mean)
        if sample_count >= 24:
            break

    if sample_count == 0 or sample_mean is None or sample_m2 is None:
        cap.release()
        return False

    mean_gray_small = sample_mean.astype(np.uint8)
    std_map_small = np.sqrt(sample_m2 / max(1, sample_count - 1))
    mean_gray = cv2.resize(mean_gray_small, (width, height), interpolation=cv2.INTER_LINEAR)

    # 检测 / 手动区域
    if manual_region:
        x, y, w, h = manual_region
    else:
        sample_region = _auto_detect(mean_gray_small, std_map_small, sample_width, sample_height)
        if sample_region is None:
            cap.release()
            return False
        sx, sy, sw, sh = sample_region
        inverse_scale = 1 / sample_scale
        x, y = round(sx * inverse_scale), round(sy * inverse_scale)
        w, h = round(sw * inverse_scale), round(sh * inverse_scale)

    mask = _build_mask(mean_gray, (x, y, w, h), (height, width))

    # 单个 FFmpeg 进程从标准输入接收修复后的原始帧，并复用原视频音轨。
    cmd = [
        "ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
        "-s", f"{width}x{height}", "-r", str(fps), "-i", "pipe:0",
        "-i", input_path, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264",
        "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-movflags", "+faststart", output_path,
    ]
    process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        from .processor import _raise_if_cancelled
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        for i in range(total):
            _raise_if_cancelled()
            ret, frame = cap.read()
            if not ret:
                break
            result = cv2.inpaint(frame, mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
            if process.stdin is None:
                raise RuntimeError("FFmpeg 管道不可用")
            process.stdin.write(result.tobytes())
            if on_progress and (i + 1) % 10 == 0:
                on_progress(i + 1, total)
        process.stdin.close()
        ret_code = process.wait()
    finally:
        cap.release()
        if process.poll() is None:
            process.kill()

    return ret_code == 0


def run_watermark_pipeline(job_id: str, video_path: str, output_base: str) -> dict:
    """
    水印去除管线入口，供 RQ worker 调用。
    输出: output_base/job_id/clean.mp4
    """
    vpath = Path(video_path)
    if not vpath.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    out_dir = Path(output_base) / job_id
    out_dir.mkdir(parents=True, exist_ok=True)
    output_file = out_dir / "clean.mp4"

    try:
        ok = remove_watermark(str(vpath), str(output_file))
        if not ok:
            raise RuntimeError("Watermark removal failed")
        return {"output": str(output_file)}
    except JobCancelled:
        # 运行中删除在安全帧边界清理三个任务目录，避免与 API 并发删写。
        output_file.unlink(missing_ok=True)
        shutil.rmtree(out_dir, ignore_errors=True)
        shutil.rmtree(vpath.parent, ignore_errors=True)
        raise
    except Exception:
        # 普通处理失败只删除半成品，保留源文件便于排查或重试。
        output_file.unlink(missing_ok=True)
        raise
