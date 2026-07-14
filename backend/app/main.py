"""FastAPI 主应用"""
import asyncio
import os
import sys
import threading
import shutil
from pathlib import Path

# 确保项目根目录在 path 中
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from .config import (
    ALLOW_LOCAL_THREAD_FALLBACK,
    ALLOWED_VIDEO_EXTENSIONS,
    CORS_ORIGINS,
    MAX_VIDEO_DURATION_SEC,
    MAX_UPLOAD_SIZE_MB,
    OUTPUT_DIR,
    TEMP_DIR,
    UPLOAD_DIR,
)

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
MAX_IMAGE_MB = 20

# Worker 与 API 共享存储路径
from .models import JobParams, JobResponse
from .storage import (
    ensure_dirs,
    generate_job_id,
    get_result_paths,
    get_watermark_output_path,
    save_uploaded_stream,
)

# 任务状态存储（生产环境应使用 Redis）
_jobs: dict[str, dict] = {}
_watermark_jobs: dict[str, dict] = {}


def _update_job(job_id: str, **kwargs):
    """更新任务"""
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


def _run_pipeline_sync(job_id: str, video_path: str):
    """同步模式：在后台线程中执行管线（Windows 无 Redis 时使用）"""
    try:
        from worker.processor import run_pipeline
        result = run_pipeline(job_id, video_path, str(OUTPUT_DIR), str(TEMP_DIR), _jobs[job_id]["params"])
        _update_job(job_id, status="completed", progress=100, result=result)
    except Exception as e:
        _update_job(job_id, status="failed", error={"code": "PROCESSING_ERROR", "message": str(e)})


def _run_watermark_sync(job_id: str, video_path: str):
    """同步模式：在后台线程中执行水印去除"""
    def _update_wm(jid: str, **kwargs):
        if jid in _watermark_jobs:
            _watermark_jobs[jid].update(kwargs)

    try:
        from worker.watermark_remover import run_watermark_pipeline
        result = run_watermark_pipeline(job_id, video_path, str(OUTPUT_DIR))
        _update_wm(job_id, status="completed", progress=100, result=result)
    except Exception as e:
        _update_wm(job_id, status="failed", error={"code": "PROCESSING_ERROR", "message": str(e)})

app = FastAPI(
    title="曦月 - 视频与素材处理 API",
    version="1.6",
    description="上传视频后自动提取帧、抠图处理，生成序列帧 Sprite Sheet",
)

if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _init_job(job_id: str, params: JobParams, rq_job_id: str = ""):
    """初始化任务记录"""
    _jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "params": params.model_dump(),
        "rq_job_id": rq_job_id,
        "result": None,
        "error": None,
    }


@app.on_event("startup")
async def startup():
    ensure_dirs()


@app.get("/health")
async def health():
    """供前端判断本地处理服务是否可用，不把 Redis 暂时离线伪装成整站故障。"""
    redis_connected = False
    try:
        from worker.tasks import get_queue
        redis_connected = bool(get_queue().connection.ping())
    except Exception:
        redis_connected = False
    return {"status": "ok", "redis": redis_connected, "local_fallback": ALLOW_LOCAL_THREAD_FALLBACK}


async def _save_video_upload(job_id: str, file: UploadFile) -> Path:
    """流式保存并用 FFprobe 校验真实视频及最长时长。"""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(400, f"不支持的格式，仅支持: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}")
    try:
        path = await save_uploaded_stream(job_id, file, MAX_UPLOAD_SIZE_MB * 1024 * 1024, ext)
    except ValueError as error:
        if str(error) == "UPLOAD_TOO_LARGE":
            raise HTTPException(413, f"文件过大，限制 {MAX_UPLOAD_SIZE_MB}MB") from error
        raise
    try:
        from worker.processor import get_video_info
        info = await asyncio.to_thread(get_video_info, path)
        if not info["width"] or not info["height"] or not info["duration"]:
            raise ValueError("无法读取有效的视频流")
        if info["duration"] > MAX_VIDEO_DURATION_SEC:
            raise ValueError(f"视频时长不能超过 {MAX_VIDEO_DURATION_SEC} 秒")
    except Exception as error:
        path.unlink(missing_ok=True)
        raise HTTPException(400, f"视频校验失败: {error}") from error
    return path


def _remove_job_dirs(job_id: str) -> None:
    """集中清理三个任务目录，避免删除端点间行为漂移。"""
    for base in (UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR):
        shutil.rmtree(base / job_id, ignore_errors=True)


@app.post("/jobs", response_model=dict)
async def create_job(
    file: UploadFile = File(None),
    params: str = Form(default="{}"),
):
    """
    创建任务。上传视频文件或提供 URL（URL 可选实现）。
    """
    job_id = generate_job_id()

    try:
        params_obj = JobParams.model_validate_json(params)
    except Exception as e:
        raise HTTPException(400, f"参数解析失败: {e}")

    if not file:
        raise HTTPException(400, "请上传视频文件")

    video_path = await _save_video_upload(job_id, file)

    _init_job(job_id, params_obj)

    try:
        from worker.tasks import enqueue_job
        rq_id = enqueue_job(
            job_id,
            str(video_path),
            str(OUTPUT_DIR),
            str(TEMP_DIR),
            params_obj.model_dump(),
        )
        _update_job(job_id, rq_job_id=rq_id)
    except Exception as error:
        if not ALLOW_LOCAL_THREAD_FALLBACK:
            _jobs.pop(job_id, None)
            _remove_job_dirs(job_id)
            raise HTTPException(503, "任务队列不可用，请启动 Redis 与 Worker") from error
        # 本地开发只有显式开启时才允许在线程内执行重任务。
        _update_job(job_id, status="processing", rq_job_id="")
        thread = threading.Thread(target=_run_pipeline_sync, args=(job_id, str(video_path)))
        thread.daemon = True
        thread.start()

    return {"job_id": job_id}


@app.get("/jobs/{job_id}", response_model=dict)
async def get_job(job_id: str):
    """查询任务状态"""
    if job_id not in _jobs:
        try:
            from worker.tasks import get_job_status
            rq_status = get_job_status(job_id)
            status_map = {"queued": "queued", "started": "processing", "finished": "completed", "failed": "failed", "canceled": "canceled", "stopped": "canceled", "deferred": "queued"}
            return {
                "id": job_id,
                "status": status_map.get(rq_status["status"], rq_status["status"]),
                "progress": 100 if rq_status["status"] == "finished" else 0,
                "params": rq_status.get("meta", {}).get("params"),
                "error": {"code": "PROCESSING_ERROR", "message": rq_status["exc_info"]} if rq_status.get("exc_info") else None,
                "result": rq_status.get("result"),
            }
        except Exception as error:
            raise HTTPException(404, "任务不存在") from error

    job = _jobs[job_id]
    resp = {
        "id": job_id,
        "status": job["status"],
        "progress": job.get("progress", 0),
        "params": job.get("params"),
        "error": job.get("error"),
        "result": job.get("result"),
    }

    # 若内存状态为 queued/processing，尝试从 RQ 拉取最新状态
    if job["status"] in ("queued", "processing") and job.get("rq_job_id"):
        try:
            from worker.tasks import get_job_status
            rq_status = get_job_status(job["rq_job_id"])
            status_map = {"queued": "queued", "started": "processing", "finished": "completed", "failed": "failed", "deferred": "queued"}
            resp["status"] = status_map.get(rq_status["status"], job["status"])
            if rq_status.get("result"):
                resp["result"] = rq_status["result"]
                resp["progress"] = 100
                _update_job(job_id, status="completed", progress=100, result=rq_status["result"])
            if rq_status.get("exc_info"):
                resp["error"] = {"code": "PROCESSING_ERROR", "message": rq_status["exc_info"]}
                resp["status"] = "failed"
                _update_job(job_id, status="failed", error=resp["error"])
        except Exception:
            pass

    return resp


@app.get("/jobs/{job_id}/result")
async def get_result(job_id: str, format: str = "png"):
    """下载结果：png 或 zip"""
    status = await get_job(job_id)
    if status["status"] != "completed":
        raise HTTPException(400, "任务未完成")

    paths = get_result_paths(job_id)
    if not paths:
        raise HTTPException(404, "结果文件不存在")

    sprite_path, index_path = paths
    if format == "zip":
        import zipfile
        zip_path = OUTPUT_DIR / job_id / "result.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(sprite_path, "sprite.png")
            zf.write(index_path, "index.json")
        return FileResponse(zip_path, filename="sprite_sheet.zip", media_type="application/zip")
    return FileResponse(sprite_path, filename="sprite.png", media_type="image/png")


@app.get("/jobs/{job_id}/index")
async def get_index(job_id: str):
    """获取索引 JSON"""
    paths = get_result_paths(job_id)
    if not paths:
        raise HTTPException(404, "结果不存在")
    _, index_path = paths
    return FileResponse(index_path, media_type="application/json")


def _run_matte_sync(content: bytes) -> bytes:
    """在线程池中执行 rembg 抠图，避免阻塞事件循环"""
    from rembg import remove
    from worker.processor import _get_session
    return remove(content, session=_get_session())


@app.post("/matte")
async def matte_image(file: UploadFile = File(...)):
    """
    AI 抠图：上传单张图片，返回透明背景 PNG。使用 rembg u2net 模型。
    首次调用会下载模型，可能较慢。
    """
    if not file.filename:
        raise HTTPException(400, "请上传图片文件")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(400, f"不支持的格式，仅支持: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}")

    matte_job_id = generate_job_id()
    try:
        image_path = await save_uploaded_stream(matte_job_id, file, MAX_IMAGE_MB * 1024 * 1024, ext)
    except ValueError as error:
        raise HTTPException(413, f"图片不得超过 {MAX_IMAGE_MB}MB") from error

    try:
        from PIL import Image
        with Image.open(image_path) as image:
            image.verify()
        content = image_path.read_bytes()
        result = await asyncio.to_thread(_run_matte_sync, content)
        return Response(content=result, media_type="image/png")
    except Exception as e:
        raise HTTPException(500, f"抠图失败: {str(e)}")
    finally:
        _remove_job_dirs(matte_job_id)


@app.post("/watermark")
async def create_watermark_job(file: UploadFile = File(...)):
    """
    创建 Seedance 水印去除任务。上传视频，返回 job_id，轮询 GET /watermark/{id} 获取状态。
    """
    job_id = generate_job_id()

    if not file.filename:
        raise HTTPException(400, "请上传视频文件")

    video_path = await _save_video_upload(job_id, file)

    _watermark_jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "rq_job_id": "",
        "result": None,
        "error": None,
    }

    try:
        from worker.tasks import enqueue_watermark_job
        rq_id = enqueue_watermark_job(job_id, str(video_path), str(OUTPUT_DIR))
        _watermark_jobs[job_id]["rq_job_id"] = rq_id
    except Exception as error:
        if not ALLOW_LOCAL_THREAD_FALLBACK:
            _watermark_jobs.pop(job_id, None)
            _remove_job_dirs(job_id)
            raise HTTPException(503, "任务队列不可用，请启动 Redis 与 Worker") from error
        _watermark_jobs[job_id]["status"] = "processing"
        _watermark_jobs[job_id]["rq_job_id"] = ""
        thread = threading.Thread(target=_run_watermark_sync, args=(job_id, str(video_path)))
        thread.daemon = True
        thread.start()

    return {"job_id": job_id}


@app.get("/watermark/{job_id}")
async def get_watermark_job(job_id: str):
    """查询水印去除任务状态"""
    if job_id not in _watermark_jobs:
        try:
            from worker.tasks import get_job_status
            rq_status = get_job_status(job_id)
            status_map = {"queued": "queued", "started": "processing", "finished": "completed", "failed": "failed", "canceled": "canceled", "stopped": "canceled", "deferred": "queued"}
            return {
                "id": job_id,
                "status": status_map.get(rq_status["status"], rq_status["status"]),
                "progress": 100 if rq_status["status"] == "finished" else 0,
                "error": {"code": "PROCESSING_ERROR", "message": rq_status["exc_info"]} if rq_status.get("exc_info") else None,
                "result": rq_status.get("result"),
            }
        except Exception as error:
            raise HTTPException(404, "任务不存在") from error

    job = _watermark_jobs[job_id]
    resp = {
        "id": job_id,
        "status": job["status"],
        "progress": job.get("progress", 0),
        "error": job.get("error"),
        "result": job.get("result"),
    }

    if job["status"] in ("queued", "processing") and job.get("rq_job_id"):
        try:
            from worker.tasks import get_job_status
            rq_status = get_job_status(job["rq_job_id"])
            status_map = {"queued": "queued", "started": "processing", "finished": "completed", "failed": "failed", "deferred": "queued"}
            resp["status"] = status_map.get(rq_status["status"], job["status"])
            if rq_status.get("result"):
                resp["result"] = rq_status["result"]
                resp["progress"] = 100
                job["status"] = "completed"
                job["progress"] = 100
                job["result"] = rq_status["result"]
            if rq_status.get("exc_info"):
                resp["error"] = {"code": "PROCESSING_ERROR", "message": rq_status["exc_info"]}
                resp["status"] = "failed"
                job["status"] = "failed"
                job["error"] = resp["error"]
        except Exception:
            pass

    return resp


@app.get("/watermark/{job_id}/result")
async def get_watermark_result(job_id: str):
    """下载去水印后的视频"""
    status = await get_watermark_job(job_id)
    if status["status"] != "completed":
        raise HTTPException(400, "任务未完成")

    job = _watermark_jobs.get(job_id, status)
    out_path = None
    if job.get("result", {}).get("output"):
        p = Path(job["result"]["output"]).resolve()
        if p.exists():
            out_path = p
    if not out_path:
        out_path = get_watermark_output_path(job_id)
    if not out_path:
        raise HTTPException(404, "结果文件不存在")

    return FileResponse(out_path, filename="clean.mp4", media_type="video/mp4")


@app.delete("/watermark/{job_id}")
async def delete_watermark_job(job_id: str):
    """删除水印去除任务及结果"""
    if job_id in _watermark_jobs:
        del _watermark_jobs[job_id]
    running = False
    try:
        from worker.tasks import cancel_job
        running = cancel_job(job_id) == "started"
    except Exception:
        pass
    if not running:
        _remove_job_dirs(job_id)
    return {"ok": True, "cancellation_pending": running}


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """删除任务及结果"""
    if job_id in _jobs:
        del _jobs[job_id]
    running = False
    try:
        from worker.tasks import cancel_job
        running = cancel_job(job_id) == "started"
    except Exception:
        pass
    if not running:
        _remove_job_dirs(job_id)
    return {"ok": True, "cancellation_pending": running}


# 后台轮询更新：需要 worker 完成后更新 _jobs。可通过 RQ 的失败/成功回调实现。
# 此处简化：GET /jobs/{id} 时主动查 RQ。
