# Azure TTS Studio Web

新版前端采用 React、TypeScript、Vite、React Router、TanStack Query 和 Zustand。

它是项目唯一的 Web 前端；生产构建由 FastAPI 从 `frontend/dist/` 托管。

## 本地开发

使用 Node.js **v24.21.0**。先执行 `nvm use 24.21.0` 切换版本（尚未安装时执行 `nvm install 24.21.0`），再运行下列命令。

先在一个终端启动现有 FastAPI 服务：

```bash
cd backend
python main.py
```

再在另一个终端启动新版前端：

```bash
cd frontend
npm ci
npm run dev
```

浏览器访问 Vite 输出的地址（通常是 <http://127.0.0.1:5173>）。开发服务器会把 `/api` 请求代理至 `http://127.0.0.1:8030`。

## 用 FastAPI 托管新版页面

```bash
cd frontend
npm run build

cd ../backend
python main.py
```

构建完成后，FastAPI 会在 <http://127.0.0.1:8030> 托管前端，并支持页面刷新后的路由回退。若构建产物不存在，根路径会返回包含构建命令的 503 提示；项目根目录的 `start.bat` 和 `start.sh` 会在首次启动时自动完成构建。

## 密钥存储

首次启动新版后，原 `config.json` 中的 Azure 与 LLM Key 会自动迁移到 Windows 凭据管理器（服务名为 `Azure-TTS-Studio`），并从 JSON 文件清除。应用只会向前端返回脱敏后的值。

若本机没有可用的系统凭据后端，应用会保留本地 JSON 兼容模式；安装依赖时请使用 `pip install -r backend/requirements.txt` 以启用凭据库支持。

## 迁移原则

- `pages/` 只负责页面组合和路由。
- `features/`（后续创建）按配音、音色、历史、SSML、AI 检测等业务域组织。
- `services/api.ts` 是 HTTP 请求的单一入口；组件不直接 `fetch`。
- 可跨页面复用的编辑状态放到 `stores/`，远端缓存统一交给 TanStack Query。
- UI 基础组件集中在 `components/ui/`，避免重新形成巨型全局样式文件。
