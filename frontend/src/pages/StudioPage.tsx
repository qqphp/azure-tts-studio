import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Play, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../services/api';
import { usePlayerStore } from '../stores/player-store';
import { useStudioStore } from '../stores/studio-store';

const percent = (value: number) => value ? `${value > 0 ? '+' : ''}${value}%` : undefined;

export function StudioPage() {
  const client = useQueryClient();
  const { data: voices = [], isLoading, error } = useQuery({ queryKey: ['voices'], queryFn: api.voices });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const { data: llmStatus } = useQuery({ queryKey: ['llm-status'], queryFn: api.llmStatus });
  const { text, setText, selectedVoice, setVoice } = useStudioStore();
  const setTrack = usePlayerStore((state) => state.setTrack);
  const [rate, setRate] = useState(0); const [pitch, setPitch] = useState(0); const [volume, setVolume] = useState(0); const [style, setStyle] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { if (!selectedVoice && voices.length) setVoice(voices.find((voice) => voice.ShortName === settings?.defaultVoice) ?? voices[0]); }, [voices, settings?.defaultVoice, selectedVoice, setVoice]);
  useEffect(() => setStyle(''), [selectedVoice?.ShortName]);
  const synthesize = useMutation({ mutationFn: api.speak, onSuccess: (result) => { setTrack(`/api/history/${result.id}`, result.meta.voice || selectedVoice?.LocalName || '新生成的配音'); client.invalidateQueries({ queryKey: ['history'] }); setMessage('配音已生成，正在播放。'); }, onError: (cause) => setMessage(cause instanceof Error ? cause.message : '生成失败') });
  const review = useMutation({ mutationFn: api.reviewText, onSuccess: (result) => { if (!result.ok || !result.result) { setMessage(result.error || 'AI 检测未返回有效结果'); return; } if (result.result.tts_text) setText(result.result.tts_text); const score = result.result.score === null || result.result.score === undefined ? '' : `评分 ${result.result.score} · `; setMessage(`${score}${result.result.summary || '已完成文本优化'}${result.result.tts_text ? '，已替换编辑内容。' : ''}`); }, onError: (cause) => setMessage(cause instanceof Error ? cause.message : 'AI 检测失败') });
  const submit = () => synthesize.mutate({ text: text.trim(), voice: selectedVoice?.ShortName, rate: percent(rate), pitch: percent(pitch), volume: percent(volume), style: style || undefined });
  const reset = () => { setRate(0); setPitch(0); setVolume(0); setStyle(''); };
  return <><PageHeader eyebrow="STUDIO" title="开始一段好听的配音" description="选择音色，调整表达方式，然后即时生成音频。" />
    <div className="studio-grid">
      <section className="card compose-card"><div className="card-title"><span>配音内容</span><span className="muted">{text.length} 字</span></div><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="输入希望朗读的内容…" />
        <div className="compose-footer"><button className="text-button" onClick={() => review.mutate(text)} disabled={!text.trim() || !llmStatus?.configured || review.isPending} title={llmStatus?.configured ? `使用 ${llmStatus.model || '默认模型'} 优化文本` : '请先在旧版设置中配置 LLM'}>{review.isPending ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} AI 文本优化</button><button className="primary-button" onClick={submit} disabled={!text.trim() || !selectedVoice || synthesize.isPending}>{synthesize.isPending ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />}{synthesize.isPending ? '正在生成…' : '生成配音'}</button></div>{message && <p className={`inline-message ${synthesize.isError || review.isError ? 'error' : ''}`}>{message}</p>}
      </section>
      <section className="card voice-picker"><div className="card-title"><span>选择音色</span><span className="muted">{voices.length || '—'} 个可用</span></div><div className="voice-list">{isLoading ? <p className="state-message">加载中…</p> : error ? <p className="state-message error">请先在设置中连接 Azure Speech。</p> : voices.slice(0, 10).map((voice) => <button key={voice.ShortName} className={`voice-option ${selectedVoice?.ShortName === voice.ShortName ? 'selected' : ''}`} onClick={() => setVoice(voice)}><span className="voice-avatar">{voice.LocalName?.slice(0, 1) ?? '声'}</span><span><b>{voice.LocalName || voice.DisplayName || voice.ShortName}</b><small>{voice.LocaleName || voice.Locale} · {voice.Gender === 'Female' ? '女声' : '男声'}</small></span></button>)}</div></section>
      <section className="card quick-settings"><div className="card-title"><span>表达设置</span><button className="text-button" onClick={reset}>重置</button></div><div className="setting-row"><span>语速</span><input type="range" min="-50" max="200" value={rate} onChange={(event) => setRate(Number(event.target.value))} /><output>{rate ? `${rate > 0 ? '+' : ''}${rate}%` : '默认'}</output></div><div className="setting-row"><span>音调</span><input type="range" min="-50" max="50" value={pitch} onChange={(event) => setPitch(Number(event.target.value))} /><output>{pitch ? `${pitch > 0 ? '+' : ''}${pitch}%` : '默认'}</output></div><div className="setting-row"><span>音量</span><input type="range" min="-50" max="50" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><output>{volume ? `${volume > 0 ? '+' : ''}${volume}%` : '默认'}</output></div>{selectedVoice?.StyleList?.length ? <label className="style-select">说话风格<select value={style} onChange={(event) => setStyle(event.target.value)}><option value="">默认</option>{selectedVoice.StyleList.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : null}</section>
    </div></>;
}
