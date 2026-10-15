# Azure TTS Studio（大风车配音工坊）

基于 Azure Speech 的本地配音工作台，支持文本转语音、多角色编排、SSML 编辑和音频素材管理。前端使用 React、TypeScript 和 Vite，后端使用 FastAPI，业务数据保存在本机。

[个人博客](https://qqphp.com) · [站点源码](https://github.com/qqphp/azure-tts-studio)

## 核心功能

| 模块 | 能力 |
| --- | --- |
| 快速配音 | 输入文本，设置音色、语速、音调、音量、风格与角色；长文本按 1800 字符分段合成 |
| 专业配音 | 可视化片段编排、多音色与角色管理、SSML 源码编辑、标签工具和本地结构校验 |
| 音色中心 | 多条件筛选、搜索、收藏；按音色生成并缓存试听音频 |
| 音频素材 | 音效与背景音乐的分类、标签、搜索、试听和管理，支持 Excel 模板、导入与导出，可插入专业配音 |
| 历史配音 | 本地保存合成音频和元数据，支持播放、下载、分页和批量删除 |
| AI 文本优化 | 通过 OpenAI 兼容接口优化配音文本，展示摘要、评分和问题数量；可选配置 |
| 设置 | Azure 连接、默认音色、输出格式、AI 接口和主题切换 |

## 运行环境

- **Node.js v24.21.0**：用于前端开发与构建，版本记录在 `.nvmrc` 和前端 `package.json`。
- **Python**：当前已在 **3.12.9** 下验证，建议使用项目独立虚拟环境。
- **Azure Speech 资源**：需准备可用的 Endpoint 和 API Key；实际可用音色、风格与格式取决于资源及服务支持。
- AI 文本优化另需提供兼容接口地址、密钥和模型；不配置也可使用配音功能。

## 快速启动

```bash
git clone git@github.com:qqphp/azure-tts-studio.git
cd azure-tts-studio
nvm install 24.21.0
nvm use 24.21.0
```

### 一键启动

Windows 在项目根目录运行 `start.bat`；macOS/Linux 执行 `bash start.sh`。

脚本会创建后端虚拟环境并安装 Python 依赖；如果缺少前端构建，会安装前端依赖并构建。启动后访问 **<http://127.0.0.1:8030>**。

**脚本不会自动重建已有的前端产物。** 更新前端代码后，请先在 `frontend/` 执行 `npm ci` 和 `npm run build`，再启动服务或刷新页面。

### 手动启动

先构建前端：

```bash
cd frontend
npm ci
npm run build
cd ../backend
python -m venv .venv
```

激活虚拟环境：

```powershell
# Windows PowerShell，在 backend 目录执行
.\.venv\Scripts\Activate.ps1
```

```bash
# macOS/Linux，在 backend 目录执行
source .venv/bin/activate
```

然后安装依赖并启动：

```bash
python -m pip install -r requirements.txt
python main.py
```

后端默认仅监听 `127.0.0.1:8030`，并托管 `frontend/dist/`。运行期间保持终端打开，按 `Ctrl+C` 停止。

## 配置与使用

### Azure Speech

在左侧“设置”中填写 Azure Speech Endpoint 和 API Key，选择默认音色与音频格式，保存后测试连接。密钥输入框留空表示保留已保存的值。

Endpoint 请填写资源地址或区域 TTS 地址，**不要附加** `cognitiveservices/voices/list` 或 `cognitiveservices/v1`：

| 输入示例 | 程序使用的语音服务基址 |
| --- | --- |
| `https://<resource>.services.ai.azure.com` | `https://<resource>.services.ai.azure.com/tts` |
| `https://<region>.tts.speech.microsoft.com` | 保持该地址 |
| `https://<host>/tts` | 保持该地址 |

程序去除末尾 `/` 后，若地址包含 `.tts.speech.` 或以 `/tts` 结尾，就直接使用；其他地址会自动追加 `/tts`。音色列表和合成请求分别在基址后追加 `/cognitiveservices/voices/list` 与 `/cognitiveservices/v1`。无需填写 Region 字段。

建议先用默认 MP3 格式验证播放。音色中心的首次试听会请求 Azure 合成并写入缓存，后续播放复用缓存。

### AI 文本优化（可选）

在“设置 → AI 文本优化”填写：

1. **Base URL**：填写兼容 API 的完整基址，例如 `https://api.example.com/v1`；不要附加 `/models` 或 `/chat/completions`，程序不会自动补 `/v1`。
2. **API Key**：使用 Bearer 认证；已保存密钥可留空沿用。
3. 点击“获取模型”，从返回列表中选择默认模型，点击“保存配置”。可用“测试 LLM”检查模型列表接口是否可访问。

不需要选择服务商。接口需支持 `GET {base}/models` 和 `POST {base}/chat/completions`；当前优化请求包含 `response_format: {"type":"json_object"}`，模型需要返回可解析的 JSON 对象。测试连接仅检查模型列表，不代表文本优化请求一定成功。

优化提示词位于 `backend/prompt/text _detection.txt`。优化成功且返回非空 `tts_text` 时会替换当前配音文本；生成配音前请确认内容。

### 专业配音与音频素材

- 可视化编辑中按片段设置音色和表达参数；切换至源码模式可编辑完整 SSML。
- 本地校验检查 XML 安全性与基本 SSML 结构，具体标签、音色和参数是否可用仍由 Azure 判断。
- 完整 SSML 单次提交，不自动分段；快速配音的分段结果采用字节拼接，并非音频重编码或严格无缝合并。
- 音效与背景音乐库保存的是音频 URL 及元数据，不会自动下载素材。插入 SSML 的素材地址需可被 Azure 访问，浏览器试听还受格式与网络条件影响。

## 数据存储与备份

| 位置 | 内容 |
| --- | --- |
| `config.json` | Azure、AI 接口及主题等设置；运行后按需生成 |
| 系统凭据库 | Azure 和 AI 密钥；Windows 使用凭据管理器，服务名 `Azure-TTS-Studio` |
| `data/studio.db` | SQLite 数据库：历史索引、收藏音色、专业配音角色、音效及背景音乐元数据 |
| `history/` | 合成音频 `.bin` 与对应 JSON 元数据 |
| `voice_previews/` | 试听音频及缓存清单 |

旧 JSON 密钥在系统凭据库可用时会自动迁移；不可用时仍保留本地 JSON 回退。后端设置接口只返回脱敏密钥。不要提交或分享包含密钥的配置文件。

备份前先停止服务，再复制 `config.json`、`data/`、`history/` 和需要保留的 `voice_previews/`。系统凭据不包含在这些文件中，迁移到新电脑后需要重新输入密钥；外部音频 URL 对应的素材也需自行保存。

## 开发与检查

主要目录：`frontend/src/` 包含页面、组件、API 客户端和状态；`backend/app/modules/` 按业务模块组织路由与数据访问，`core/` 提供配置、凭据和 SQLite 基础设施，`services/` 处理语音及 SSML；回归测试位于 `backend/tests/`。

后端使用虚拟环境运行 `python main.py`。前端开发另开终端：

```bash
cd frontend
npm ci
npm run dev
```

访问 <http://127.0.0.1:5173>，Vite 将 `/api` 请求代理至 8030 后端。后端 API 文档为 <http://127.0.0.1:8030/docs>，健康检查为 `/api/health`。

激活后端虚拟环境后，在项目根目录运行回归测试，再检查前端：

```bash
python -m unittest discover -s backend/tests -v
cd frontend
npm run check
npm run build
```

AI 接口回归使用模拟响应，不调用付费优化服务。数据库写入测试使用临时文件；应用初始化会执行已有的本地凭据迁移逻辑。

## 常见问题

- **首页提示缺少前端构建**：在 `frontend/` 执行 `npm ci` 和 `npm run build`，再重启后端。
- **更新后仍显示旧界面**：重新构建前端，再刷新浏览器；一键启动不会覆盖已有构建。
- **Azure 连接失败**：核对资源密钥、Endpoint 以及实际拼接后的 `/tts` 路径；401/403 时检查凭据与资源权限。
- **音色数量或风格与预期不同**：以当前资源返回列表为准，不同资源、区域、模型及时间可能不同。
- **AI 无法获取模型**：检查 Base URL、密钥、网络和 `/models` 支持；默认模型必须从返回列表选择。
- **LLM 测试成功但优化失败**：确认所选模型支持 Chat Completions、当前请求参数以及 JSON 对象输出。
- **音频无法播放**：优先使用默认 MP3 格式；RAW、部分编码或分段字节拼接结果可能不适合浏览器直接播放。

## Azure 资源创建参考

以下截图保留资源创建与取用凭据的参考流程，门户界面、资源可用性和计费规则以 Azure 实际显示为准。

<details>
<summary>通过 Foundry 资源配置</summary>

在 [Azure 门户](https://portal.azure.com) 创建 Foundry 资源，检查可用模型，再从资源中获取请求地址与密钥。

![创建 Foundry 资源入口](./docs/assets/readme/foundry0.png)
![填写 Foundry 资源信息](./docs/assets/readme/foundry1.png)
![查看可用模型](./docs/assets/readme/foundry2.png)
![检查模型信息](./docs/assets/readme/foundry3.png)
![查看资源地址](./docs/assets/readme/foundry4.png)
![获取资源密钥](./docs/assets/readme/foundry5.png)

</details>

<details>
<summary>通过 Speech 语音服务资源配置</summary>

在 [Azure 门户](https://portal.azure.com) 搜索并创建语音服务资源，按订阅可用选项选择区域与定价层，再进入资源的“密钥和终结点”获取凭据。

![查找语音服务](./docs/assets/readme/voice1.png)
![创建语音服务资源](./docs/assets/readme/voice2.png)
![查看资源信息](./docs/assets/readme/voice3.png)
![获取语音服务密钥和终结点](./docs/assets/readme/voice4.png)

</details>
