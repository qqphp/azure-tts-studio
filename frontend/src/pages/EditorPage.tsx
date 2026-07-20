import { useMutation, useQueryClient } from '@tanstack/react-query';
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { CheckCircle2, Code2, LoaderCircle, Play } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';
import { usePlayerStore } from '../stores/player-store';

const starterSsml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">\n  <voice name="zh-CN-XiaoxiaoNeural">\n    <mstts:express-as style="cheerful">\n      <prosody rate="+5%">欢迎使用专业配音编辑器。</prosody>\n    </mstts:express-as>\n  </voice>\n</speak>`;

export function EditorPage() {
  const client = useQueryClient(); const setTrack = usePlayerStore((state) => state.setTrack); const [ssml, setSsml] = useState(starterSsml); const [message, setMessage] = useState('');
  const validate = useMutation({ mutationFn: api.validateSsml, onSuccess: (result) => setMessage(`校验通过：${result.voiceCount} 个音色，${result.textLength} 个文本字符。`), onError: (cause) => setMessage(cause instanceof Error ? cause.message : 'SSML 校验失败') });
  const synthesize = useMutation({ mutationFn: api.speakSsml, onSuccess: (result) => { setTrack(`/api/history/${result.id}`, result.meta.voice || '专业配音'); client.invalidateQueries({ queryKey: ['history'] }); setMessage('配音已生成，正在播放。'); }, onError: (cause) => setMessage(cause instanceof Error ? cause.message : '生成失败') });
  return <><PageHeader eyebrow="PRO EDITOR" title="专业 SSML 编辑器" description="直接编辑 Azure SSML，先校验结构，再生成多音色配音。" /><div className="editor-layout"><section className="card editor-card"><div className="card-title"><span>SSML 文档</span><span className="muted">{ssml.length} 字符</span></div><CodeMirror className="code-editor" value={ssml} height="465px" theme={oneDark} extensions={[xml()]} onChange={setSsml} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }} /><div className="editor-actions"><button className="secondary-button" onClick={() => validate.mutate(ssml)} disabled={validate.isPending}>{validate.isPending ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />} 校验结构</button><button className="primary-button" onClick={() => synthesize.mutate(ssml)} disabled={synthesize.isPending}>{synthesize.isPending ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />} 生成配音</button></div></section><aside className="editor-help"><Code2 size={24} /><h2>常用标签</h2><code>&lt;voice name="…"&gt;</code><code>&lt;prosody rate="+10%"&gt;</code><code>&lt;break time="500ms" /&gt;</code><code>&lt;mstts:express-as style="cheerful"&gt;</code><p className={validate.isError || synthesize.isError ? 'inline-message error' : 'inline-message'}>{message || '建议每次修改后先执行结构校验。'}</p></aside></div></>;
}
