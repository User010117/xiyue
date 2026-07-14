"""RQ 任务定义"""
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def get_queue():
    """获取 Redis 队列"""
    import redis
    from rq import Queue

    conn = redis.from_url(REDIS_URL)
    return Queue("pixelwork", connection=conn)


def enqueue_job(job_id: str, video_path: str, output_base: str, temp_base: str, params: dict) -> str:
    """使用公开任务 ID 入队，使 API 重启后仍可直接从 Redis 查询。"""
    from .processor import run_pipeline

    q = get_queue()
    job = q.enqueue(
        run_pipeline,
        job_id, video_path, output_base, temp_base, params,
        job_timeout="30m",
        job_id=job_id,
        result_ttl=604800,
        failure_ttl=604800,
    )
    # 参数随 RQ 任务保存，API 进程重启后仍能返回完整任务信息。
    job.meta.update({"kind": "video", "params": params})
    job.save_meta()
    return job.id


def enqueue_watermark_job(job_id: str, video_path: str, output_base: str) -> str:
    """使用公开任务 ID 入队，并将结果与失败信息保留七天。"""
    from .watermark_remover import run_watermark_pipeline

    q = get_queue()
    job = q.enqueue(
        run_watermark_pipeline,
        job_id, video_path, output_base,
        job_timeout="30m",
        job_id=job_id,
        result_ttl=604800,
        failure_ttl=604800,
    )
    job.meta["kind"] = "watermark"
    job.save_meta()
    return job.id


def get_job_status(rq_job_id: str) -> dict:
    """获取 RQ 任务状态"""
    import redis
    from rq.job import Job

    conn = redis.from_url(REDIS_URL)
    job = Job.fetch(rq_job_id, connection=conn)
    status = job.get_status()
    if job.meta.get("cancel_requested") and status in {"finished", "failed", "stopped", "canceled"}:
        status = "canceled"
    return {
        "status": status,
        "result": job.result,
        "exc_info": str(job.exc_info) if job.exc_info else None,
        "meta": job.meta,
    }


def cancel_job(job_id: str) -> str:
    """取消排队任务或请求正在运行的 Worker 在安全边界停止。"""
    import redis
    from rq.job import Job

    conn = redis.from_url(REDIS_URL)
    job = Job.fetch(job_id, connection=conn)
    status = job.get_status()
    if status in {"queued", "deferred", "scheduled"}:
        job.cancel()
    elif status == "started":
        job.meta["cancel_requested"] = True
        job.save_meta()
    return status
