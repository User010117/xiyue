"""数据模型定义"""
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field, model_validator

from .config import MAX_FRAMES, MAX_SHEET_EDGE, MAX_VIDEO_DURATION_SEC


class FrameRange(BaseModel):
    """帧范围"""
    start_sec: float = 0
    end_sec: Optional[float] = None
    start_frame: Optional[int] = None
    end_frame: Optional[int] = None

    @model_validator(mode="after")
    def validate_range(self):
        """限制用户选择的视频区间，避免绕过服务端处理预算。"""
        if self.end_sec is not None:
            if self.end_sec < self.start_sec:
                raise ValueError("结束时间不能早于开始时间")
            if self.end_sec - self.start_sec > MAX_VIDEO_DURATION_SEC:
                raise ValueError(f"处理区间不能超过 {MAX_VIDEO_DURATION_SEC} 秒")
        return self


class TargetSize(BaseModel):
    """目标尺寸"""
    w: int = Field(ge=1, le=4096)
    h: int = Field(ge=1, le=4096)


class JobParams(BaseModel):
    """任务参数"""
    fps: int = Field(ge=1, le=60, default=12)
    frame_range: FrameRange = Field(default_factory=FrameRange)
    max_frames: int = Field(ge=1, le=MAX_FRAMES, default=300)
    target_size: TargetSize = Field(default_factory=lambda: TargetSize(w=256, h=256))
    bg_color: str = "transparent"  # #RRGGBB or transparent
    transparent: bool = True
    padding: int = Field(ge=0, le=64, default=4)
    spacing: int = Field(ge=0, le=64, default=4)
    layout_mode: str = "fixed_columns"  # fixed_columns / auto_square
    columns: int = Field(ge=1, le=64, default=12)
    matte_strength: float = Field(ge=0.0, le=1.0, default=0.6)
    crop_mode: str = "tight_bbox"  # none / tight_bbox / safe_bbox

    @model_validator(mode="after")
    def validate_sheet_bounds(self):
        """在入队前估算最坏布局，避免 Worker 创建超大画布导致内存耗尽。"""
        columns = self.columns if self.layout_mode == "fixed_columns" else max(1, int(self.max_frames ** 0.5 + 0.999))
        rows = (self.max_frames + columns - 1) // columns
        sheet_w = columns * (self.target_size.w + self.spacing) - self.spacing
        sheet_h = rows * (self.target_size.h + self.spacing) - self.spacing
        if sheet_w > MAX_SHEET_EDGE or sheet_h > MAX_SHEET_EDGE:
            raise ValueError(f"Sprite Sheet 边长不能超过 {MAX_SHEET_EDGE}px")
        return self


class JobCreateRequest(BaseModel):
    """创建任务请求"""
    url: Optional[str] = None
    params: JobParams = Field(default_factory=JobParams)


class JobError(BaseModel):
    """任务错误"""
    code: str
    message: str


class JobResponse(BaseModel):
    """任务响应"""
    id: str
    status: str  # queued / processing / completed / failed / canceled
    progress: int = 0
    params: Optional[JobParams] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[JobError] = None
    result: Optional[dict] = None


class JobResult(BaseModel):
    """任务结果"""
    sprite_sheet_url: str
    json_index_url: str
    frame_count: int
    width: int
    height: int


class IndexFrame(BaseModel):
    """索引中的单帧"""
    i: int
    x: int
    y: int
    w: int
    h: int
    t: float
