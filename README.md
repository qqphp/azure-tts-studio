# Azure 文本转语音 (Azure TTS Studio)

一个本地运行的 Web 应用,提供调用微软 Azure Cognitive Services 文本转语音 (Text-to-Speech) 的友好界面。后端 FastAPI 做代理,前端纯静态页面,密钥只存在本机,不会暴露给浏览器。

## 功能

- 设置菜单:配置端点 (Endpoint) / 区域 (Region) / 密钥 (Key),可一键**测试连接**,成功后自动拉取音色列表
- 音色库:支持按语言筛选、按名字搜索,显示性别标签
- 合成台:
  - 输入文本 (任意长度,超过 1800 字字符**自动分段合成后拼接**)
  - 调语速 / 音调 / 音量 (滑块,留空即用默认)
  - 选择说话风格 (mstts:express-as,自动按音色支持的 StyleList 动态填充)
  - 选择角色 (role,OLT / Young / Senior 等)
- 音频播放条:页面底部胶囊式播放条,带频谱可视化动画,显示时长
- 下载音频 / 历史记录 (本机持久化,可单条删除)

## 目录结构

```
Azure_TTS/
├── backend/
│   ├── main.py             FastAPI 入口:配置读写、连接测试、合成、历史
│   └── requirements.txt
├── static/                 前端静态资源
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── config.json             保存的配置 (运行后自动生成,含 apiKey,请勿提交 git)
└── history/                历史音频 + 元数据 (.bin / .json)
```

## 安装与运行

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

打开浏览器访问 <http://127.0.0.1:8000>。

## 配置 Azure Speech 资源

1. 在 [Azure Portal](https://portal.azure.com) 创建 **Azure AI Speech** 资源(AI Services kind,F0 免费层即可)
2. 进入资源 → "密钥和终结点" (Keys and Endpoint),复制
   - **Key 1**
   - **Endpoint**,形如 `https://<your-resource>.services.ai.azure.com/`
3. 在本应用右上角点击"设置",把端点和密钥填入,点击"测试连接"
   - 成功后会显示中文音色数量,音色库自动加载

REST 路径说明:本后端固定走经典 Azure AI Speech REST 形式:
- 列出音色:`GET {endpoint}/cognitiveservices/voices/list`
- 合成语音:`POST {endpoint}/cognitiveservices/v1`(body 为 SSML)
- `endpoint` 直接用填入的请求地址(去尾部 `/`),可填自定义资源端点(如 `https://xxx.services.ai.azure.com/`)或区域专用 TTS 域名(如 `https://eastus.tts.speech.microsoft.com`);无需 region 字段。

## 音色速查

中文常用音色 (ShortName):
- 女声: `zh-CN-XiaoxiaoNeural` (晓晓,多风格)、`zh-CN-XiaoyiNeural` (晓伊)、`zh-CN-XiaohanNeural`
- 男声: `zh-CN-YunyangNeural` (云扬)、`zh-CN-YunjianNeural` (云健)、`zh-CN-YunxiNeural` (云希)

## 设计取舍说明

- **配置存储在服务端** `config.json`,而非常浏览器 localStorage:密钥不出后端,换浏览器/设备无需重填;代价是要本机跑后端进程。
- **长文本分段**:Azure 单次合成约 5000 字符上限,本项目按 1800 字符分段,合成后**直接字节拼接**播放。简单 mp3 字节拼接在主流浏览器 `<audio>` 上可正常播放和解码;如需严格无缝合并,可改用 ffmpeg 拼接 (需额外依赖)。
- **SSML** 由后端构造,前端只发送语义字段 (rate/pitch/volume/style/role),避免前端手拼 XML 出错或注入。
- 输出格式默认 `audio-16khz-128kbitrate-mono-mp3`,在设置弹窗里可调整为 24kHz / 48kHz / WAV / OGG。

## 常见问题

- **测试连接显示 HTTP 401**:apiKey 不对,或在错误区域。
- **测试连接显示 HTTP 403**:可能用了免key 部署模式,或区域与资源不匹配。
- **音色列表为空**:Azure 部分订阅未开通 neural 音色,确认资源区域支持 Neural。
- **合成音频听不到**:浏览器对 mp3 简单拼接的解码通常 OK;若换格式后失败,建议保持默认 mp3 16kHz。

## 如何创建 AI Services 资源？
在 Azure 门户中为 Speech 创建一个 AI Services 资源。创建地址：[Create an AI Services resource for Speech](https://portal.azure.com/#create/Microsoft.CognitiveServicesAIFoundry)

填写创建资源所需的基础信息：
![这是图片](.\static\images\readme\no1.png)

获取请求地址和密钥：
![这是图片](.\static\images\readme\no2.png)
