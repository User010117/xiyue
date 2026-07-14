"""存储管理"""
import json
import shutil
import uuid
from pathlib import Path
from typing import Optional

from .config import UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR

# 分块尺寸兼顾磁盘吞吐与上传超限后的及时终止。
UPLOAD_CHUNK_BYTES = 1024 * 1024


def ensure_dirs():
    """确保目录存在"""
    for d in [UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def generate_job_id() -> str:
    """生成任务ID"""
    return str(uuid.uuid4())[:12]


def get_job_dirs(job_id: str) -> tuple[Path, Path, Path]:
    """获取任务的各目录路径"""
    upload_path = UPLOAD_DIR / job_id
    temp_path = TEMP_DIR / job_id
    output_path = OUTPUT_DIR / job_id
    return upload_path, temp_path, output_path


def safe_upload_name(filename: str, fallback_extension: str) -> str:
    """仅保留已校验扩展名，并由服务端生成名称以阻断路径穿越。"""
    extension = Path(filename).suffix.lower() or fallback_extension
    return f"source{extension}"


async def save_uploaded_stream(job_id: str, upload, max_bytes: int, fallback_extension: str) -> Path:
    """边读边写上传内容，达到上限立即删除半成品并终止。"""
    ensure_dirs()
    upload_path, _, _ = get_job_dirs(job_id)
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / safe_upload_name(upload.filename or "", fallback_extension)
    total = 0
    try:
        with file_path.open("wb") as target:
            while chunk := await upload.read(UPLOAD_CHUNK_BYTES):
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError("UPLOAD_TOO_LARGE")
                target.write(chunk)
    except Exception:
        file_path.unlink(missing_ok=True)
        raise
    return file_path


def save_result(job_id: str, sprite_path: Path, index_data: dict) -> tuple[Path, Path]:
    """保存结果文件"""
    _, _, output_path = get_job_dirs(job_id)
    output_path.mkdir(parents=True, exist_ok=True)
    dest_sprite = output_path / "sprite.png"
    dest_index = output_path / "index.json"
    shutil.copy(sprite_path, dest_sprite)
    with open(dest_index, "w", encoding="utf-8") as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)
    return dest_sprite, dest_index


def get_result_paths(job_id: str) -> Optional[tuple[Path, Path]]:
    """获取结果文件路径"""
    _, _, output_path = get_job_dirs(job_id)
    sprite = output_path / "sprite.png"
    index = output_path / "index.json"
    if sprite.exists() and index.exists():
        return sprite, index
    return None


def get_watermark_output_path(job_id: str) -> Optional[Path]:
    """获取水印去除任务的结果视频路径"""
    _, _, output_path = get_job_dirs(job_id)
    clean = output_path / "clean.mp4"
    if clean.exists():
        return clean
    return None
