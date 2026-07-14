# 曦月 — 部署说明

产品能力与版本说明见根目录 [README.md](./README.md)；功能扩展与已实现对照见 [DEV_PLAN_extensions.md](./DEV_PLAN_extensions.md)。

![部署相关示意图](image/DEPLOY/1773816518080.png)

## 推送远程

- **GitHub Pages**：推送 `main` 后，由 `.github/workflows/deploy-pages.yml` 自动构建和发布。

## 不应提交到版本库的文件

已通过 `.gitignore` 排除：
- `backend/uploads/*`：用户上传文件（.gitkeep 除外）
- `dist/`、`frontend/dist/`：构建产物
- `*.log`、`.env` 等

## 后端安全环境变量

- `CORS_ORIGINS`：用英文逗号分隔允许访问 API 的前端来源，例如 `https://example.com,http://localhost:5173`。Docker 同源部署可留空，默认不会开放任意来源。
- `ALLOW_LOCAL_THREAD_FALLBACK`：仅在明确接受单进程临时任务时设为 `true`；默认 `false`，生产环境应使用 Redis 与 RQ Worker。
- `MAX_UPLOAD_BYTES`、`MAX_VIDEO_DURATION_SEC`、`MAX_FRAMES`、`MAX_SPRITE_SHEET_EDGE`：分别限制上传大小、视频时长、帧数与精灵表边长，API 与处理层会重复校验。

部署后访问 `GET /health` 检查 API、Redis 与本地线程回退状态。静态部署不会伪装后端能力，工作台会明确提示需要启动本地服务。
