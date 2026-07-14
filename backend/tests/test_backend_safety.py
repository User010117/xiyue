"""安全边界、任务标识和布局限制的最小回归测试。"""
import tempfile
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from pydantic import ValidationError

from backend.app import storage
from backend.app.models import FrameRange, JobParams
from worker.processor import compute_layout
from worker.tasks import cancel_job, enqueue_job


class FakeUpload:
    """模拟 FastAPI UploadFile 的分块读取接口。"""

    def __init__(self, filename: str, chunks: list[bytes]):
        """保存文件名与待返回分块。"""
        self.filename = filename
        self._chunks = iter(chunks)

    async def read(self, _size: int) -> bytes:
        """逐次返回上传块，耗尽后返回空字节。"""
        return next(self._chunks, b"")


class StorageSafetyTests(unittest.IsolatedAsyncioTestCase):
    """验证上传边界和结果目录不会回归。"""

    async def test_stream_limit_removes_partial_file(self):
        """超限时必须立即失败且不留下半成品。"""
        with tempfile.TemporaryDirectory() as root:
            with patch.object(storage, 'UPLOAD_DIR', Path(root) / 'uploads'), patch.object(storage, 'OUTPUT_DIR', Path(root) / 'outputs'), patch.object(storage, 'TEMP_DIR', Path(root) / 'temp'):
                upload = FakeUpload('../../escape.mp4', [b'1234', b'5678'])
                with self.assertRaisesRegex(ValueError, 'UPLOAD_TOO_LARGE'):
                    await storage.save_uploaded_stream('job-1', upload, 6, '.mp4')
                self.assertFalse((Path(root) / 'uploads' / 'job-1' / 'source.mp4').exists())

    def test_safe_name_and_result_directory(self):
        """客户端路径只贡献扩展名，结果始终位于 outputs/jobId。"""
        self.assertEqual(storage.safe_upload_name('../../escape.mp4', '.mp4'), 'source.mp4')
        with tempfile.TemporaryDirectory() as root:
            with patch.object(storage, 'UPLOAD_DIR', Path(root) / 'uploads'), patch.object(storage, 'OUTPUT_DIR', Path(root) / 'outputs'), patch.object(storage, 'TEMP_DIR', Path(root) / 'temp'):
                output = Path(root) / 'outputs' / 'job-2'
                output.mkdir(parents=True)
                (output / 'sprite.png').write_bytes(b'png')
                (output / 'index.json').write_text('{}', encoding='utf-8')
                self.assertEqual(storage.get_result_paths('job-2'), (output / 'sprite.png', output / 'index.json'))


class BoundaryAndQueueTests(unittest.TestCase):
    """验证参数上限和公开任务 ID 持久化约束。"""

    def test_parameter_and_layout_bounds(self):
        """超长区间与超大画布必须在处理前拒绝。"""
        with self.assertRaises(ValidationError):
            FrameRange(start_sec=0, end_sec=301)
        with self.assertRaises(ValueError):
            compute_layout(2000, 4096, 4096, 64, 'fixed_columns', 64)
        self.assertEqual(JobParams().max_frames, 300)

    @patch('worker.tasks.get_queue')
    def test_public_job_id_and_retention(self, get_queue_mock):
        """入队时公开 ID、七天保留期与参数元数据必须写入 RQ。"""
        class FakeJob:
            """记录 RQ 元数据写入。"""
            id = 'public-id'
            meta: dict = {}

            def save_meta(self):
                """真实 RQ 会写 Redis；测试只验证调用契约。"""
                return None

        fake_job = FakeJob()
        get_queue_mock.return_value.enqueue.return_value = fake_job
        result = enqueue_job('public-id', 'video.mp4', 'outputs', 'temp', {'fps': 12})
        self.assertEqual(result, 'public-id')
        kwargs = get_queue_mock.return_value.enqueue.call_args.kwargs
        self.assertEqual(kwargs['job_id'], 'public-id')
        self.assertEqual(kwargs['result_ttl'], 604800)
        self.assertEqual(fake_job.meta['params'], {'fps': 12})

    def test_running_job_sets_cancel_flag(self):
        """运行中任务必须写取消标志并通知 Worker 停止。"""
        class FakeRunningJob:
            """模拟正在运行的 RQ 任务。"""
            meta: dict = {}
            saved = False

            def get_status(self):
                """返回 RQ 的运行中状态。"""
                return 'started'

            def save_meta(self):
                """记录取消标志已持久化。"""
                self.saved = True

        fake_job = FakeRunningJob()
        redis_module = types.ModuleType('redis')
        redis_module.from_url = lambda _url: object()
        job_module = types.ModuleType('rq.job')

        class FakeJobClass:
            """提供 RQ Job.fetch 兼容入口。"""

            @staticmethod
            def fetch(_job_id, connection):
                """返回正在运行的模拟任务。"""
                self.assertIsNotNone(connection)
                return fake_job

        job_module.Job = FakeJobClass
        with patch.dict(sys.modules, {'redis': redis_module, 'rq.job': job_module}):
            self.assertEqual(cancel_job('public-id'), 'started')
        self.assertTrue(fake_job.meta['cancel_requested'])
        self.assertTrue(fake_job.saved)


if __name__ == '__main__':
    unittest.main()
