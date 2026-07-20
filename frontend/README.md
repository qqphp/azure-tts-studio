# Azure TTS Studio Web

新版前端采用 React、TypeScript、Vite、React Router、TanStack Query 和 Zustand。

它与根目录的 `static/` 旧版页面并行存在，便于逐页迁移并在迁移期间保留全部已有能力。

## 本地开发

先在一个终端启动现有 FastAPI 服务：

```bash
cd backend
python main.py
```

再在另一个终端启动新版前端：

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 Vite 输出的地址（通常是 <http://127.0.0.1:5173>）。开发服务器会把 `/api` 请求代理至 `http://127.0.0.1:8000`。

## 用 FastAPI 托管新版页面

```bash
cd frontend
npm run build

cd ../backend
python main.py
```

构建产物存在时，FastAPI 会在 <http://127.0.0.1:8000> 托管新版前端，并支持页面刷新后的路由回退。未构建新版时，根路径仍使用旧版页面。

旧版只保留为应急回退，不会默认暴露。确需访问时，在启动服务前设置环境变量 `TTS_ENABLE_LEGACY_UI=1`，然后访问 <http://127.0.0.1:8000/legacy/>。

## 密钥存储

首次启动新版后，原 `config.json` 中的 Azure 与 LLM Key 会自动迁移到 Windows 凭据管理器（服务名为 `Azure-TTS-Studio`），并从 JSON 文件清除。应用只会向前端返回脱敏后的值。

若本机没有可用的系统凭据后端，应用会保留本地 JSON 兼容模式；安装依赖时请使用 `pip install -r backend/requirements.txt` 以启用凭据库支持。

## 迁移原则

- `pages/` 只负责页面组合和路由。
- `features/`（后续创建）按配音、音色、历史、SSML、AI 检测等业务域组织。
- `services/api.ts` 是 HTTP 请求的单一入口；组件不直接 `fetch`。
- 可跨页面复用的编辑状态放到 `stores/`，远端缓存统一交给 TanStack Query。
- UI 基础组件集中在 `components/ui/`，避免重新形成巨型全局样式文件。
