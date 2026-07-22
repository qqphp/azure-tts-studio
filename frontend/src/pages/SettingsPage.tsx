import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, LoaderCircle, Palette, Save, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';
import { applyTheme, DEFAULT_THEME, isTheme, themes, type ThemeId } from '../theme';

const audioFormats = [
  'amr-wb-16000hz',
  'audio-16khz-16bit-32kbps-mono-opus',
  'audio-16khz-32kbitrate-mono-mp3',
  'audio-16khz-64kbitrate-mono-mp3',
  'audio-16khz-128kbitrate-mono-mp3',
  'audio-24khz-16bit-24kbps-mono-opus',
  'audio-24khz-16bit-48kbps-mono-opus',
  'audio-24khz-48kbitrate-mono-mp3',
  'audio-24khz-96kbitrate-mono-mp3',
  'audio-24khz-160kbitrate-mono-mp3',
  'audio-48khz-96kbitrate-mono-mp3',
  'audio-48khz-192kbitrate-mono-mp3',
  'g722-16khz-64kbps',
  'ogg-16khz-16bit-mono-opus',
  'ogg-24khz-16bit-mono-opus',
  'ogg-48khz-16bit-mono-opus',
  'raw-8khz-8bit-mono-alaw',
  'raw-8khz-8bit-mono-mulaw',
  'raw-8khz-16bit-mono-pcm',
  'raw-16khz-16bit-mono-pcm',
  'raw-16khz-16bit-mono-truesilk',
  'raw-22050hz-16bit-mono-pcm',
  'raw-24khz-16bit-mono-pcm',
  'raw-24khz-16bit-mono-truesilk',
  'raw-44100hz-16bit-mono-pcm',
  'raw-48khz-16bit-mono-pcm',
  'webm-16khz-16bit-mono-opus',
  'webm-24khz-16bit-24kbps-mono-opus',
  'webm-24khz-16bit-mono-opus',
] as const;

export function SettingsPage() {
  const client = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const { data: providers = [] } = useQuery({ queryKey: ['llm-providers'], queryFn: api.llmProviders });
  const [endpoint, setEndpoint] = useState('');
  const [defaultVoice, setDefaultVoice] = useState('');
  const [outputFormat, setOutputFormat] = useState('audio-16khz-128kbitrate-mono-mp3');
  const [apiKey, setApiKey] = useState('');
  const [azureMessage, setAzureMessage] = useState('');
  const [provider, setProvider] = useState('');
  const [base, setBase] = useState('');
  const [llmKey, setLlmKey] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [llmMessage, setLlmMessage] = useState('');
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [themeMessage, setThemeMessage] = useState('');

  useEffect(() => {
    if (data) {
      setEndpoint(data.endpoint || '');
      setDefaultVoice(data.defaultVoice || '');
      setOutputFormat(data.outputFormat || 'audio-16khz-128kbitrate-mono-mp3');
      setProvider(data.llm?.provider || '');
      setBase(data.llm?.base || '');
      setModel('');
      setModels([]);
      const savedTheme = isTheme(data.theme) ? data.theme : DEFAULT_THEME;
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, [data]);

  const azurePayload = () => ({ endpoint, defaultVoice, outputFormat, ...(apiKey ? { apiKey } : {}) });
  const llmPayload = () => ({ provider, base, defaultModel: model, timeout: 60, ...(llmKey ? { apiKey: llmKey } : {}) });
  const save = useMutation({ mutationFn: () => api.saveSettings(azurePayload()), onSuccess: () => { setApiKey(''); client.invalidateQueries({ queryKey: ['settings'] }); setAzureMessage('设置已保存'); }, onError: (error) => setAzureMessage(error instanceof Error ? error.message : '保存失败') });
  const test = useMutation({ mutationFn: async () => { await api.saveSettings(azurePayload()); return api.testConnection(); }, onSuccess: (result) => { if (result.ok) { client.invalidateQueries({ queryKey: ['voices'] }); setAzureMessage(`连接成功：共 ${result.count} 个音色，其中中文 ${result.zh_count} 个。`); } else setAzureMessage(result.error || '连接失败'); }, onError: (error) => setAzureMessage(error instanceof Error ? error.message : '连接失败') });
  const saveLlm = useMutation({ mutationFn: () => api.saveSettings({ llm: llmPayload() }), onSuccess: () => { setLlmKey(''); client.invalidateQueries({ queryKey: ['settings'] }); client.invalidateQueries({ queryKey: ['llm-status'] }); setLlmMessage('AI 检测配置已保存'); }, onError: (error) => setLlmMessage(error instanceof Error ? error.message : '保存失败') });
  const loadModels = useMutation({ mutationFn: async () => { await api.saveSettings({ llm: llmPayload() }); return api.llmModels(); }, onSuccess: (items) => { const ids = items.map((item) => item.id); setModels(ids); setModel(''); setLlmMessage(ids.length ? `已获取 ${ids.length} 个模型，请选择默认模型。` : '服务未返回模型'); }, onError: (error) => setLlmMessage(error instanceof Error ? error.message : '获取模型失败') });
  const testLlm = useMutation({ mutationFn: async () => { await api.saveSettings({ llm: llmPayload() }); return api.testLlm(); }, onSuccess: (result) => { if (result.ok) { client.invalidateQueries({ queryKey: ['llm-status'] }); setLlmMessage(`LLM 连接成功，可用模型 ${result.count ?? 0} 个。`); } else setLlmMessage(result.error || 'LLM 连接失败'); }, onError: (error) => setLlmMessage(error instanceof Error ? error.message : 'LLM 连接失败') });
  const saveTheme = useMutation({ mutationFn: () => api.saveSettings({ theme }), onSuccess: () => { client.invalidateQueries({ queryKey: ['settings'] }); setThemeMessage('主题已保存'); }, onError: (error) => setThemeMessage(error instanceof Error ? error.message : '保存失败') });
  const chooseProvider = (id: string) => { setProvider(id); setModels([]); setModel(''); const selected = providers.find((item) => item.id === id); setBase(selected?.base || ''); };
  const chooseTheme = (id: ThemeId) => { setTheme(id); applyTheme(id); setThemeMessage('已预览，保存后将在下次打开时保留。'); };

  return <><PageHeader eyebrow="SETTINGS" title="连接与智能设置" description="所有密钥仅交给本机 FastAPI 保存，浏览器不会取得明文。" />{isLoading ? <p className="state-message">正在读取设置…</p> : <div className="settings-stack"><section className="card settings-card"><div className="settings-heading"><Palette size={19} /><div><h2>主题风格</h2><p>为你的配音工作台挑一束合适的光。</p></div></div><div className="theme-grid">{themes.map((item) => <button key={item.id} className={`theme-option ${theme === item.id ? 'selected' : ''}`} onClick={() => chooseTheme(item.id)}><span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]} 58%, ${item.colors[2]})` }} /><span><b>{item.name}</b><small>{item.description}</small></span></button>)}</div><div className="settings-actions"><button className="primary-button" onClick={() => saveTheme.mutate()} disabled={saveTheme.isPending}>{saveTheme.isPending ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} 保存主题</button><span className={saveTheme.isError ? 'error' : ''}>{themeMessage}</span></div></section><section className="card settings-card"><div className="settings-heading"><Wifi size={19} /><div><h2>Azure Speech</h2><p>配置语音资源、默认音色与合成音频格式。</p></div></div><label>Azure Speech Endpoint<input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://your-resource.cognitiveservices.azure.com" /></label><label>Azure API Key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={data?.apiKey ? `已保存：${data.apiKey}` : 'Ocp-Apim-Subscription-Key'} autoComplete="off" /></label><label>默认音色<input value={defaultVoice} onChange={(event) => setDefaultVoice(event.target.value)} placeholder="zh-CN-XiaoxiaoNeural" /></label><label>音频格式<select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)}>{audioFormats.map((format) => <option key={format} value={format}>{format}</option>)}</select></label><div className="settings-actions"><button className="primary-button" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} 保存设置</button><button className="secondary-button" onClick={() => test.mutate()} disabled={test.isPending}>{test.isPending ? <LoaderCircle className="spin" size={16} /> : <Wifi size={16} />} 测试连接</button><span className={test.isError || save.isError ? 'error' : ''}>{azureMessage}</span></div></section><section className="card settings-card"><div className="settings-heading"><Bot size={19} /><div><h2>AI 文本优化</h2><p>使用 OpenAI 兼容接口检测并优化配音文本。</p></div></div><label>服务商<select value={provider} onChange={(event) => chooseProvider(event.target.value)}><option value="">请选择服务商</option>{providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Base URL<input value={base} onChange={(event) => setBase(event.target.value)} placeholder="https://api.example.com/v1" /></label><label>API Key<input type="password" value={llmKey} onChange={(event) => setLlmKey(event.target.value)} placeholder={data?.llm?.apiKey ? `已保存：${data.llm.apiKey}` : 'Bearer token'} autoComplete="off" /></label><label><span className="field-label">默认模型 <span className="required-mark" aria-hidden="true">*</span></span><span className="field-hint">请先点击“获取模型”，获取模型列表后再配置默认模型。</span><select value={model} onChange={(event) => setModel(event.target.value)} disabled={!models.length}><option value="">请选择模型</option>{models.map((id) => <option key={id} value={id}>{id}</option>)}</select></label><div className="settings-actions"><button className="primary-button" onClick={() => saveLlm.mutate()} disabled={!model || saveLlm.isPending}>{saveLlm.isPending ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} 保存配置</button><button className="secondary-button" onClick={() => loadModels.mutate()} disabled={loadModels.isPending || !provider || !base}>{loadModels.isPending ? <LoaderCircle className="spin" size={16} /> : <Bot size={16} />} 获取模型</button><button className="secondary-button" onClick={() => testLlm.mutate()} disabled={testLlm.isPending}>{testLlm.isPending ? <LoaderCircle className="spin" size={16} /> : <Wifi size={16} />} 测试 LLM</button><span className={loadModels.isError || testLlm.isError || saveLlm.isError ? 'error' : ''}>{llmMessage}</span></div></section></div>}</>;
}
