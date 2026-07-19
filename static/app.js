/* Azure 配音工坊 前端逻辑 */
'use strict';

const $ = (id) => document.getElementById(id);

const state = {
  voices: [],
  selectedVoice: null,
  currentAudio: null,   // HTMLAudioElement
  currentBlob: null,
  currentMeta: null,
  historyLoaded: false,
};

/* Azure Locale 短码 -> 友好显示 (中文名 + 语言代码). 未命中的回退为纯代码. */
const LOCALE_NAMES = {
  'zh-CN':'中文 (zh-CN)','zh-HK':'粤语 (zh-HK)','zh-TW':'台湾国语 (zh-TW)',
  'en-US':'美式英语 (en-US)','en-GB':'英式英语 (en-GB)','en-AU':'澳洲英语 (en-AU)',
  'en-CA':'加拿大英语 (en-CA)','en-IN':'印度英语 (en-IN)','en-IE':'爱尔兰英语 (en-IE)',
  'en-NZ':'新西兰英语 (en-NZ)','en-PH':'菲律宾英语 (en-PH)','en-ZA':'南非英语 (en-ZA)',
  'en-HK':'香港英语 (en-HK)',
  'ja-JP':'日语 (ja-JP)','ko-KR':'韩语 (ko-KR)',
  'fr-FR':'法语 (fr-FR)','fr-CA':'加拿大法语 (fr-CA)','fr-CH':'瑞士法语 (fr-CH)','fr-BE':'比利时法语 (fr-BE)',
  'de-DE':'德语 (de-DE)','de-AT':'奥地利德语 (de-AT)','de-CH':'瑞士德语 (de-CH)',
  'es-ES':'西班牙语 (es-ES)','es-MX':'墨西哥西班牙语 (es-MX)','es-US':'美国西班牙语 (es-US)',
  'es-AR':'阿根廷西班牙语 (es-AR)','es-CO':'哥伦比亚西班牙语 (es-CO)','es-CL':'智利西班牙语 (es-CL)',
  'es-PY':'巴拉圭西班牙语 (es-PY)','es-PE':'秘鲁西班牙语 (es-PE)','es-PR':'波多黎各西班牙语 (es-PR)',
  'it-IT':'意大利语 (it-IT)','pt-BR':'巴西葡语 (pt-BR)','pt-PT':'欧洲葡语 (pt-PT)',
  'ru-RU':'俄语 (ru-RU)','pl-PL':'波兰语 (pl-PL)','tr-TR':'土耳其语 (tr-TR)',
  'nl-NL':'荷兰语 (nl-NL)','nl-BE':'比利时荷兰语 (nl-BE)',
  'sv-SE':'瑞典语 (sv-SE)','fi-FI':'芬兰语 (fi-FI)','da-DK':'丹麦语 (da-DK)','nb-NO':'挪威语 (nb-NO)',
  'cs-CZ':'捷克语 (cs-CZ)','sk-SK':'斯洛伐克语 (sk-SK)','hu-HU':'匈牙利语 (hu-HU)',
  'ro-RO':'罗马尼亚语 (ro-RO)','bg-BG':'保加利亚语 (bg-BG)','hr-HR':'克罗地亚语 (hr-HR)',
  'el-GR':'希腊语 (el-GR)','uk-UA':'乌克兰语 (uk-UA)','he-IL':'希伯来语 (he-IL)',
  'ar-EG':'阿拉伯语 (ar-EG)','ar-SA':'沙特阿拉伯语 (ar-SA)','ar-AE':'阿联酋阿拉伯语 (ar-AE)',
  'hi-IN':'印地语 (hi-IN)','th-TH':'泰语 (th-TH)','vi-VN':'越南语 (vi-VN)',
  'id-ID':'印尼语 (id-ID)','ms-MY':'马来语 (ms-MY)','fil-PH':'菲律宾语 (fil-PH)',
  'sw-KE':'斯瓦希里语 (sw-KE)','af-ZA':'南非荷兰语 (af-ZA)',
  'ca-ES':'加泰罗尼亚语 (ca-ES)','cy-GB':'威尔士语 (cy-GB)','et-EE':'爱沙尼亚语 (et-EE)',
  'lv-LV':'拉脱维亚语 (lv-LV)','lt-LT':'立陶宛语 (lt-LT)','sl-SI':'斯洛文尼亚语 (sl-SI)',
  'ga-IE':'爱尔兰语 (ga-IE)','mt-MT':'马耳他语 (mt-MT)','is-IS':'冰岛语 (is-IS)',
  'de-DE':'德语 (de-DE)',
};
function localeName(code) { return LOCALE_NAMES[code] || code; }

/* ------------------------------ 工具 ------------------------------ */
async function api(path, opts = {}) {
  const r = await fetch(path, opts);
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const j = await r.json(); msg = j.detail || j.message || msg; } catch {}
    throw new Error(msg);
  }
  const ct = r.headers.get('content-type') || '';
  return ct.includes('application/json') ? r.json() : r;
}

function toast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  setTimeout(() => t.classList.add('hidden'), 2200);
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

function setConn(status, label) {
  const el = $('connStatus');
  el.className = 'status-chip ' + status;
  el.querySelector('.label').textContent = label;
}

/* ------------------------------ 设置弹窗 ------------------------------ */
function openSettings() {
  $('settingsModal').classList.remove('hidden');
  loadSettingsForm();
  loadLlmForm();
}
function closeSettings() { $('settingsModal').classList.add('hidden'); }

async function loadSettingsForm() {
  const cfg = await api('/api/settings');
  $('cfgEndpoint').value = cfg.endpoint || '';
  // 密钥是脱敏的;如果包含 *** 则视为已有,不在输入框回填明文
  $('cfgKey').value = (cfg.apiKey && !cfg.apiKey.includes('***')) ? cfg.apiKey : '';
  $('cfgKey').placeholder = cfg.apiKey && cfg.apiKey.includes('***') ? `已保存: ${cfg.apiKey}` : 'Ocp-Apim-Subscription-Key';
  $('cfgFormat').value = cfg.outputFormat || 'audio-16khz-128kbitrate-mono-mp3';
  $('cfgDefaultVoice').value = cfg.defaultVoice || '';
  $('testResult').textContent = '';
}

async function saveSettings() {
  const body = {
    endpoint: $('cfgEndpoint').value.trim(),
    outputFormat: $('cfgFormat').value,
    defaultVoice: $('cfgDefaultVoice').value.trim(),
  };
  // 仅当用户输入了非脱敏形式才发送 key
  const k = $('cfgKey').value.trim();
  if (k && !k.includes('***')) body.apiKey = k;
  try {
    await api('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    toast('配置已保存', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

async function testSettings() {
  // 先保存当前输入,再用保存后的值测试
  await saveSettings();
  const r = $('testResult');
  r.textContent = '测试中…';
  r.className = 'test-result';
  try {
    const res = await api('/api/test', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
    if (res.ok) {
      r.textContent = `✓ 连接成功 · 共 ${res.count} 个音色 / ${res.zh_count} 个中文`;
      r.className = 'test-result ok';
      setConn('ok', `已连接 · ${res.count} 音色`);
      loadVoices();
    } else {
      r.textContent = `✗ ${res.error || '失败'}`;
      r.className = 'test-result err';
      r.style.whiteSpace = 'normal';
      setConn('err', '连接失败');
    }
  } catch (e) {
    r.textContent = `✗ ${e.message}`;
    r.className = 'test-result err';
  }
}

/* ------------------------------ LLM 大模型 ------------------------------ */
let LLM_PROVIDERS = [];
let LLM_MODELS = []; // 最近一次获取到的模型列表

async function loadLlmProviders() {
  if (LLM_PROVIDERS.length) return LLM_PROVIDERS;
  try {
    LLM_PROVIDERS = await api('/api/llm/providers');
    const sel = $('llmProvider');
    sel.innerHTML = '<option value="">请选择厂商</option>' +
      LLM_PROVIDERS.map(p => `<option value="${p.id}" data-base="${p.base}" data-model="${p.default_model}">${p.label}</option>`).join('');
    return LLM_PROVIDERS;
  } catch (e) { toast(e.message, 'err'); return []; }
}

async function loadLlmForm() {
  await loadLlmProviders();
  const cfg = await api('/api/settings');
  const llm = cfg.llm || {};
  $('llmProvider').value = llm.provider || '';
  $('llmBase').value = llm.base || '';
  // 密钥脱敏,不回填明文
  $('llmKey').value = (llm.apiKey && !llm.apiKey.includes('***')) ? llm.apiKey : '';
  $('llmKey').placeholder = llm.apiKey && llm.apiKey.includes('***') ? `已保存: ${llm.apiKey}` : 'Bearer token';

  // 默认模型下拉:如果有保存的默认模型,先放一个占位
  const dflt = llm.defaultModel || '';
  const mSel = $('llmDefaultModel');
  if (LLM_MODELS.length) {
    mSel.innerHTML = LLM_MODELS.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
  } else if (dflt) {
    mSel.innerHTML = `<option value="${dflt}">${dflt}</option>`;
  } else {
    mSel.innerHTML = '<option value="">请先获取模型</option>';
  }
  mSel.value = dflt;
  $('llmTestResult').textContent = '';
}

function llmFormToBody(includeKey = true) {
  const body = {
    provider: $('llmProvider').value,
    base: $('llmBase').value.trim(),
    defaultModel: $('llmDefaultModel').value,
    timeout: 60,
  };
  const k = $('llmKey').value.trim();
  if (includeKey && k && !k.includes('***')) body.apiKey = k;
  return body;
}

async function saveLlm() {
  if (!$('llmDefaultModel').value) {
    toast('请选择默认模型', 'err');
    return;
  }
  try {
    const saved = await api('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llm: llmFormToBody() }),
    });
    toast('LLM 配置已保存', 'ok');
    updateAiDetectBtn();
  } catch (e) { toast(e.message, 'err'); }
}

async function testLlm() {
  // 先保存,再测试
  await saveLlm();
  const r = $('llmTestResult');
  r.textContent = '测试中…';
  r.className = 'test-result';
  try {
    const res = await api('/api/llm/test', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}'
    });
    if (res.ok) {
      r.textContent = `✓ 连接成功 · 可用模型 ${res.count} 个`;
      r.className = 'test-result ok';
    } else {
      r.textContent = `✗ ${res.error || '失败'}`;
      r.className = 'test-result err';
    }
  } catch (e) {
    r.textContent = `✗ ${e.message}`;
    r.className = 'test-result err';
  }
}

async function fetchModels() {
  // 先保存(以免 base/key 不生效)
  await saveLlm();
  const r = $('llmTestResult');
  r.textContent = '获取模型列表中…';
  r.className = 'test-result';
  try {
    const list = await api('/api/llm/models');
    LLM_MODELS = list;
    const sel = $('llmDefaultModel');
    if (!list.length) {
      sel.innerHTML = '<option value="">未获取到模型</option>';
      r.textContent = '⚠ 服务返回空列表';
      r.className = 'test-result err';
      return;
    }
    const cur = sel.value;
    sel.innerHTML = list.map(m => `<option value="${m.id}">${m.id}${m.owned_by ? ' · ' + m.owned_by : ''}</option>`).join('');
    // 优先保留当前选择,否则保留保存时的默认
    if (list.some(m => m.id === cur)) sel.value = cur;
    r.textContent = `✓ 获取 ${list.length} 个模型`;
    r.className = 'test-result ok';
  } catch (e) {
    r.textContent = `✗ ${e.message}`;
    r.className = 'test-result err';
  }
}

async function updateAiDetectBtn() {
  // 拉一次 /api/llm/status,决定 AI 检测按钮高亮/灰
  try {
    const s = await api('/api/llm/status');
    const btn = $('aiDetectBtn');
    if (!btn) return;
    if (s.configured) {
      btn.disabled = false;
      btn.classList.remove('disabled');
      btn.title = s.model ? `用 ${s.model} 对文本做质量检测` : '对文本做质量检测';
    } else {
      btn.disabled = true;
      btn.classList.add('disabled');
      btn.title = '未配置 LLM,请到设置-大模型配置';
    }
  } catch {}
}
async function loadVoices() {
  try {
    const voices = await api('/api/voices');
    state.voices = voices;
    renderVoiceFilters();
    renderVoices();
    const locales = new Set(voices.map(v => v.Locale));
    $('voiceCount').textContent = `${voices.length} · ${locales.size} 语种`;
    setConn('ok', `已连接 · ${voices.length} 音色 / ${locales.size} 语种`);
  } catch (e) {
    $('voiceList').innerHTML = `<div class="empty-hint">加载失败:${e.message}<br>请到设置里配置并测试连接。</div>`;
    setConn('err', '未连接');
    $('voiceCount').textContent = '—';
  }
}

function renderVoiceFilters() {
  function valuesOf(items, getter) {
    const values = [];
    items.forEach(item => {
      const raw = getter(item);
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      list.forEach(value => {
        if (value !== null && value !== undefined && String(value)) values.push(String(value));
      });
    });
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }

  function setOptions(id, values, firstLabel, labelMap = {}) {
    const sel = $(id);
    const current = sel.value;
    sel.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` +
      values.map(value => {
        const label = labelMap[value] || labelMap[String(value).toLowerCase()] || value;
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      }).join('');
    sel.value = values.includes(current) ? current : '';
  }

  const tagValues = (v, key) => (v.VoiceTag && typeof v.VoiceTag === 'object') ? v.VoiceTag[key] : [];

  // 语言:带友好名,按代码排序
  const locales = valuesOf(state.voices, v => v.Locale);
  setOptions('localeFilter', locales, '全部语言', Object.fromEntries(locales.map(l => [l, localeName(l)])));

  // 类型:从数据里发现,Neural / Standard 可能有别的(VoiceType 字段)
  const types = valuesOf(state.voices, v => v.VoiceType);
  const typeLabels = { 'Neural':'Neural', 'Standard':'Standard', 'OnlineNatural':'OnlineNatural (自然)' };
  setOptions('typeFilter', types, '全部类型', typeLabels);

  const roleLabels = {
    Boy: '男孩', Girl: '女孩', YoungAdultMale: '青年男性', YoungAdultFemale: '青年女性',
    OlderAdultMale: '中老年男性', OlderAdultFemale: '中老年女性',
    SeniorMale: '老年男性', SeniorFemale: '老年女性', Narrator: '旁白',
  };
  const statusLabels = { GA: '正式版 GA', Preview: '预览版 Preview', Deprecated: '已弃用 Deprecated' };
  const scenarioLabels = {
    advertisement: '广告', assistant: '语音助手', audiobook: '有声书', audiobooks: '有声书',
    chat: '聊天对话', 'customer service': '客户服务', documentary: '纪录片',
    'e-learning': '在线学习', gaming: '游戏', learning: '学习', meditation: '冥想',
    narration: '旁白', news: '新闻播报', podcast: '播客', 'social media': '社交媒体',
    story: '故事讲述', 'call center': '呼叫中心', conversation: '对话',
  };
  const personalityLabels = {
    animated: '生动', approachable: '平易近人', authentic: '真诚自然', authoritative: '权威',
    bright: '明亮', calm: '平静', caring: '关怀', casual: '轻松', cheerful: '开朗',
    clear: '清晰', confident: '自信', crisp: '清脆', curious: '好奇', deep: '深沉',
    emotional: '富有情感', empathetic: '善解人意', engaging: '吸引人', expressive: '富有表现力',
    formal: '正式', friendly: '友好', gentle: '温和', hoarse: '沙哑', honest: '坦诚',
    'light-hearted': '轻快', mature: '成熟', pleasant: '悦耳', polite: '礼貌',
    professional: '专业', resonant: '共鸣感', serious: '严肃', shy: '腼腆', sincere: '真挚',
    smooth: '圆润', soft: '柔和', soothing: '舒缓', strong: '有力量', thoughtful: '体贴',
    trusthworthy: '值得信赖', upbeat: '积极', versatile: '多变', warm: '温暖',
    'well-rounded': '全面均衡', whimsical: '奇趣', youthful: '青春',
  };
  setOptions('roleFilter', valuesOf(state.voices, v => v.RolePlayList), '全部年龄感 / 角色', roleLabels);
  setOptions('statusFilter', valuesOf(state.voices, v => v.Status), '全部状态', statusLabels);
  setOptions('scenarioFilter', valuesOf(state.voices, v => tagValues(v, 'TailoredScenarios')), '全部使用场景', scenarioLabels);
  setOptions('personalityFilter', valuesOf(state.voices, v => tagValues(v, 'VoicePersonalities')), '全部音色人格', personalityLabels);
  setOptions('modelFilter', valuesOf(state.voices, v => tagValues(v, 'ModelSeries')), '全部模型系列');
  setOptions('sourceFilter', valuesOf(state.voices, v => tagValues(v, 'Source')), '全部模型来源');
}

function voiceTypeTag(v) {
  const t = v.VoiceType || '';
  if (!t) return '';
  const cls = t === 'Neural' ? 'type-n' : (t === 'Standard' ? 'type-s' : 'type-o');
  const label = t === 'Neural' ? 'N' : (t === 'Standard' ? 'S' : t.charAt(0).toUpperCase());
  return `<span class="vtype ${cls}" title="${t}">${label}</span>`;
}

function renderVoices() {
  const list = $('voiceList');
  const q = $('voiceSearch').value.toLowerCase();
  const loc = $('localeFilter').value;
  const gender = $('genderFilter').value;
  const type = $('typeFilter').value;
  const role = $('roleFilter').value;
  const status = $('statusFilter').value;
  const scenario = $('scenarioFilter').value;
  const personality = $('personalityFilter').value;
  const model = $('modelFilter').value;
  const source = $('sourceFilter').value;
  const styleOnly = $('styleOnly').checked;
  const tagValues = (v, key) => (v.VoiceTag && typeof v.VoiceTag === 'object') ? v.VoiceTag[key] : [];
  const hasValue = (value, selected) => {
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    return !selected || list.includes(selected);
  };

  const filtered = state.voices.filter(v => {
    if (loc && v.Locale !== loc) return false;
    if (gender && v.Gender !== gender) return false;
    if (type && v.VoiceType !== type) return false;
    if (!hasValue(v.RolePlayList, role)) return false;
    if (status && v.Status !== status) return false;
    if (!hasValue(tagValues(v, 'TailoredScenarios'), scenario)) return false;
    if (!hasValue(tagValues(v, 'VoicePersonalities'), personality)) return false;
    if (!hasValue(tagValues(v, 'ModelSeries'), model)) return false;
    if (!hasValue(tagValues(v, 'Source'), source)) return false;
    if (styleOnly && !(v.StyleList && v.StyleList.length)) return false;
    if (q) {
      const searchFields = [
        v.ShortName, v.LocalName, v.DisplayName, v.Locale, v.LocaleName,
        v.StyleList, v.RolePlayList,
        tagValues(v, 'TailoredScenarios'), tagValues(v, 'VoicePersonalities'),
        tagValues(v, 'ModelSeries'), tagValues(v, 'Source'),
      ];
      const hay = searchFields.flatMap(value => Array.isArray(value) ? value : [value])
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // 左下角显示筛选命中数
  $('voiceCount').textContent = `${filtered.length} / ${state.voices.length} · ${new Set(filtered.map(v => v.Locale)).size} 语种`;

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-hint">没有匹配项,试试调整筛选条件。</div>';
    return;
  }
  list.innerHTML = filtered.map(v => {
    const styleCount = (v.StyleList && v.StyleList.length) ? `${v.StyleList.length} 风格` : '';
    return `
    <div class="voice-item ${state.selectedVoice === v.ShortName ? 'active' : ''}" data-id="${v.ShortName}">
      <div class="vname">
        <span class="vgender ${v.Gender}">${v.Gender === 'Female' ? 'F' : 'M'}</span>
        ${voiceTypeTag(v)}
        ${v.ShortName}
      </div>
      <div class="vlocale">${localeName(v.Locale)} · ${(v.LocalName || v.DisplayName || '').replace(/</g,'&lt;')}</div>
      ${styleCount ? `<div class="vstyles">${styleCount}: ${(v.StyleList||[]).slice(0,4).map(s => STYLE_CN[s] ? `${STYLE_CN[s]}` : s).join('、')}${v.StyleList.length>4?'…':''}</div>` : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('.voice-item').forEach(el => {
    el.onclick = () => selectVoice(el.dataset.id);
  });
}

function selectVoice(id) {
  state.selectedVoice = id;
  $('selectedVoiceTag').textContent = id;
  renderVoices();
  updateStyleOptions();
  updateSpeakBtn();
}

function updateStyleOptions() {
  const sel = $('style');
  const v = state.voices.find(x => x.ShortName === state.selectedVoice);
  const styles = v?.StyleList || [];
  sel.innerHTML = '<option value="">默认 · default</option>' +
    styles.map(s => `<option value="${s}">${s} · ${STYLE_CN[s] || s}</option>`).join('');
}

/* Azure 说话风格英文名 -> 中文译名(用于下拉显示,值仍用英文以匹配 SSML) */
const STYLE_CN = {
  affectionate: '亲切',
  'angry': '愤怒',
  'anxious': '焦虑',
  'assistant': '助手',
  calm: '平静',
  'chat': '闲聊',
  'chat-casual': '休闲闲聊',
  'cheerful': '开朗',
  complaining: '抱怨',
  confused: '困惑',
  comforting: '安慰',
  customerservice: '客服',
  'customer-service': '客服',
  debating: '辩论',
  depressed: '沮丧',
  determined: '坚定',
  disappointed: '失望',
  disgusted: '厌恶',
  disgruntled: '不满',
  documentary: '解说',
  'docile': '温顺',
  'embarrassed': '尴尬',
  'empathetic': '共情',
  'envious': '羡慕',
  'encouraging': '鼓励',
  'excited': '兴奋',
  'fearful': '害怕',
  'friendly': '友好',
  'general': '通用',
  'gentle': '轻柔',
  'guilty': '内疚',
  'happy': '开心',
  'documentary-narration': '纪录片旁白',
  'hopeful': '充满希望',
  hostile: '敌意',
  'cute': '可爱',
  jealous: '嫉妒',
  'joyful': '欢欣',
  'live-commercial': '广告直播',
  'lonely': '孤独',
  'lyrical': '抒情',
  'narration-professional': '专业朗读',
  'narration-relaxed': '轻松朗读',
  'nervous': '紧张',
  'newscast': '新闻播报',
  'newscast-casual': '休闲新闻',
  'newscast-formal': '正式新闻',
  'poetry-reading': '诗朗诵',
  'regretful': '懊悔',
  'relieved': '释然',
  'sad': '悲伤',
  'sentimental': '伤感',
  'serious': '严肃',
  'shout': '呼喊',
  'shouting': '呼喊',
  'shy': '害羞',
  'softvoice': '轻声',
  'sorry': '抱歉',
  'sports-commentary': '体育解说',
  'sports-commentary-excited': '激动体育解说',
  'story-telling': '讲故事',
  'strict': '严厉',
  'surprised': '惊讶',
  'terrified': '惊恐',
  'tired': '疲惫',
  'unfriendly': '不友善',
  'voice-assistant': '语音助手',
  'whisper': '耳语',
  'whispering': '低语',
  'assassin':'刺客(冷酷、低沉、神秘、克制，语速偏慢，带压迫感)',
  'captain':'船长(威严、坚定、有领导力，像指挥官讲话)',
  'cavalier':'骑士(优雅、自信、绅士，有贵族气质)',
  'prince':'王子(高贵、温柔、优雅，带皇家气质)',
  'game-narrator':'游戏旁白(戏剧化、充满激情，像游戏剧情旁白)',
  'geomancer':'风水师(神秘、古老、智慧，像东方玄学角色)',
  'poet':'诗人(文艺、柔和、富有情感，节奏舒缓)',
  'yelling': '叫喊',
};

function updateSpeakBtn() {
  $('speakBtn').disabled = !state.selectedVoice || !$('textInput').value.trim();
}

/* ------------------------------ 合成 ------------------------------ */
function paramValue(id, suffix) {
  const v = parseInt($(id).value, 10);
  if ($(id).dataset.empty === '1' || v === 0) return '';
  return (v > 0 ? '+' : '') + v + suffix;
}

/* ------------------------------ AI 检测 ------------------------------ */
async function aiDetect() {
  const text = $('textInput').value.trim();
  if (!text) { toast('请先填写文本再检测', 'err'); return; }
  const btn = $('aiDetectBtn');
  btn.disabled = true;
  btn.classList.add('active-spin');
  $('studioStatus').textContent = 'AI 检测中…';
  try {
    const res = await api('/api/llm/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      toast(res.error || 'AI 检测失败', 'err');
      showAiResult(null, res.error);
      return;
    }
    const r = res.result || {};
    // 用 tts_text 替换用户文本
    if (r.tts_text) {
      $('textInput').value = r.tts_text;
      updateSpeakBtn();
      toast('已用检测结果替换文本', 'ok');
    } else {
      toast('LLM 未返回 tts_text,保留原文', '');
    }
    showAiResult(r, null, res.model);
  } catch (e) {
    toast(e.message, 'err');
    showAiResult(null, e.message);
  } finally {
    btn.classList.remove('active-spin');
    updateAiDetectBtn();
    $('studioStatus').textContent = '';
  }
}

function showAiResult(r, err, model) {
  const el = $('aiDetectResult');
  if (err && !r) {
    el.innerHTML = `<div class="ar-head"><span>AI 检测失败</span></div><div class="ar-summary">${escapeHtml(err)}</div>`;
    el.classList.remove('hidden');
    return;
  }
  if (!r) { el.classList.add('hidden'); return; }
  const score = (r.score !== undefined && r.score !== null) ? `评分 ${r.score}` : '';
  const issuesCount = (r.issues && r.issues.length) ? ` · ${r.issues.length} 处问题` : '';
  const summary = r.summary || '(LLM 未返回 summary)';
  el.innerHTML = `
    <div class="ar-head">
      <span>AI 检测结果${model ? ' · ' + escapeHtml(model) : ''}</span>
      ${score ? `<span class="ar-score">${score}${issuesCount}</span>` : ''}
    </div>
    <div class="ar-summary">${escapeHtml(summary)}</div>
  `;
  el.classList.remove('hidden');
}

async function speak() {
  const text = $('textInput').value.trim();
  if (!text || !state.selectedVoice) return;
  const btn = $('speakBtn');
  $('studioStatus').textContent = '合成中…';
  btn.disabled = true;
  const body = {
    text,
    voice: state.selectedVoice,
    rate: paramValue('rate', '%'),
    pitch: paramValue('pitch', 'Hz'),
    volume: paramValue('volume', '%'),
    style: $('style').value,
    role: $('role').value,
  };
  try {
    const res = await api('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(res.error || '合成失败');
    playAudio(res.audio_base64, res.mime, res.meta);
    $('studioStatus').textContent = `✓ ${res.meta.size} bytes · ${res.meta.chunks} 段`;
    $('downloadBtn').disabled = false;
    loadHistory();
  } catch (e) {
    $('studioStatus').textContent = '';
    toast(e.message, 'err');
  } finally {
    btn.disabled = false;
    updateSpeakBtn();
  }
}

function playAudio(b64, mime, meta) {
  const blob = base64ToBlob(b64, mime);
  state.currentBlob = blob;
  state.currentMeta = meta;
  const url = URL.createObjectURL(blob);
  if (state.currentAudio) {
    state.currentAudio.pause();
    URL.revokeObjectURL(state.currentAudio.src);
  }
  const audio = new Audio(url);
  state.currentAudio = audio;
  audio.addEventListener('timeupdate', () => {
    $('playerTime').textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`;
  });
  audio.addEventListener('play', () => {
    $('playerBar').classList.add('playing');
    $('playToggle').innerHTML = pauseIcon();
  });
  audio.addEventListener('pause', () => {
    $('playerBar').classList.remove('playing');
    $('playToggle').innerHTML = playIcon();
  });
  audio.addEventListener('ended', () => {
    $('playerBar').classList.remove('playing');
    $('playToggle').innerHTML = playIcon();
  });
  $('playerTitle').textContent = `${meta.voice}`;
  $('playerBar').classList.remove('hidden');
  audio.play();
}

function base64ToBlob(b64, mime) {
  const bin = atob(b64);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

function togglePlay() {
  const a = state.currentAudio;
  if (!a) return;
  if (a.paused) a.play(); else a.pause();
}

function playIcon()  { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'; }
function pauseIcon() { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'; }

function downloadAudio() {
  if (!state.currentBlob) return;
  const a = document.createElement('a');
  const ext = state.currentMeta?.format?.includes('mp3') ? 'mp3' :
              state.currentMeta?.format?.includes('ogg') ? 'ogg' :
              state.currentMeta?.format?.includes('webm') ? 'webm' : 'wav';
  a.href = URL.createObjectURL(state.currentBlob);
  a.download = `tts_${state.currentMeta?.id || Date.now()}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ------------------------------ 历史 ------------------------------ */
async function loadHistory() {
  try {
    const list = await api('/api/history');
    const c = $('historyList');
    $('historyCount').textContent = list.length ? `${list.length} 条` : '—';
    if (!list.length) {
      c.innerHTML = '<div class="empty-hint">暂无历史。</div>';
      updateBatchBtn();
      return;
    }
    c.innerHTML = list.map(h => `
      <div class="hist-item" data-id="${h.id}">
        <label class="h-check" title="选中以批量操作">
          <input type="checkbox" class="h-sel" data-id="${h.id}" />
        </label>
        <div class="h-body">
          <div class="h-top">
            <span class="h-voice">${h.voice}</span>
            <span class="h-time">${new Date(h.ts * 1000).toLocaleString('zh-CN', {hour12:false}).replace(/\//g,'-')}</span>
          </div>
          <div class="h-text">${escapeHtml(h.text)}</div>
          <div class="h-actions">
            <button class="icon-btn play" title="播放">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <span>播放</span>
            </button>
            <a class="icon-btn dl" href="/api/history/${h.id}" download title="下载">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>
              <span>下载</span>
            </a>
            <button class="icon-btn del" data-id="${h.id}" title="删除此条">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-9 0v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6"/></svg>
              <span>删除</span>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    c.querySelectorAll('.hist-item').forEach(el => {
      el.querySelector('.play').onclick = async (e) => {
        e.stopPropagation();
        const r = await fetch(`/api/history/${el.dataset.id}`);
        const blob = await r.blob();
        const meta = list.find(x => x.id === el.dataset.id) || { voice: el.dataset.id };
        playBlob(blob, meta);
      };
      el.querySelector('.del').onclick = async (e) => {
        e.stopPropagation();
        await api(`/api/history/${el.dataset.id}`, { method: 'DELETE' });
        loadHistory();
      };
      el.querySelector('.h-sel').onchange = updateBatchBtn;
      el.addEventListener('click', (e) => {
        // 点击条目空白处切换选中,方便批量选
        if (e.target.closest('.h-actions') || e.target.closest('label')) return;
        const cb = el.querySelector('.h-sel');
        cb.checked = !cb.checked;
        updateBatchBtn();
      });
    });
    // DOM 已重新渲染,旧复选框全清;按钮文案随之重置
    updateBatchBtn();
  } catch (e) { toast(e.message, 'err'); }
}

function selectedHistoryIds() {
  return [...document.querySelectorAll('.h-sel:checked')].map(cb => cb.dataset.id);
}

function updateBatchBtn() {
  const ids = selectedHistoryIds();
  const btn = $('batchDeleteHistory');
  if (!btn) return;
  btn.disabled = ids.length === 0;
  btn.textContent = ids.length ? `批量删除 (${ids.length})` : '批量删除';
}

async function batchDeleteHistory() {
  const ids = selectedHistoryIds();
  if (!ids.length) return;
  if (!confirm(`确定删除选中的 ${ids.length} 条历史吗?此操作不可撤销。`)) return;
  try {
    const res = await api('/api/history/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    toast(`已删除 ${res.deleted} 条${res.missing?.length ? `,${res.missing.length} 条未找到` : ''}`, 'ok');
    loadHistory();
  } catch (e) { toast(e.message, 'err'); }
}

function toggleSelectAllHistory() {
  const boxes = [...document.querySelectorAll('.h-sel')];
  if (!boxes.length) return;
  const allChecked = boxes.every(b => b.checked);
  boxes.forEach(b => b.checked = !allChecked);
  updateBatchBtn();
}

function playBlob(blob, meta) {
  if (state.currentAudio) { state.currentAudio.pause(); URL.revokeObjectURL(state.currentAudio.src); }
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  state.currentAudio = audio;
  state.currentBlob = blob;
  state.currentMeta = meta;
  audio.addEventListener('timeupdate', () => $('playerTime').textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`);
  audio.addEventListener('play', () => { $('playerBar').classList.add('playing'); $('playToggle').innerHTML = pauseIcon(); });
  audio.addEventListener('pause', () => { $('playerBar').classList.remove('playing'); $('playToggle').innerHTML = playIcon(); });
  audio.addEventListener('ended', () => { $('playerBar').classList.remove('playing'); $('playToggle').innerHTML = playIcon(); });
  $('playerTitle').textContent = meta.voice;
  $('playerBar').classList.remove('hidden');
  audio.play();
}

async function blobToB64(b) {
  const buf = await b.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ------------------------------ 参数滑块 ------------------------------ */
function bindRange(id, suffix) {
  const el = $(id);
  const valEl = $(id + 'Val');
  const update = () => {
    const v = parseInt(el.value, 10);
    if (v === 0) {
      valEl.textContent = '默认';
      el.classList.add('empty');
      el.dataset.empty = '1';
    } else {
      valEl.textContent = (v > 0 ? '+' : '') + v + suffix;
      el.classList.remove('empty');
      el.dataset.empty = '0';
    }
  };
  el.addEventListener('input', update);
  update();
}

/* ------------------------------ 启动 ------------------------------ */
/* ------------------------------ 主题切换 ------------------------------ */
function currentTheme() {
  return localStorage.getItem('theme') || 'system';
}
function setTheme(t) {
  localStorage.setItem('theme', t);
  document.documentElement.setAttribute('data-theme', t);
  updateThemeSwitch();
}
function updateThemeSwitch() {
  const cur = currentTheme();
  document.querySelectorAll('.theme-switch .seg').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === cur);
  });
}
function initTheme() {
  updateThemeSwitch();
  document.querySelectorAll('.theme-switch .seg').forEach(b => {
    b.onclick = () => setTheme(b.dataset.theme);
  });
  // 系统模式下,如果运行中操作系统切换了主题,跟随更新
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (currentTheme() === 'system') updateThemeSwitch();
  });
}

async function init() {
  initTheme();
  // 事件绑定
  $('settingsBtn').onclick = openSettings;
  $('closeSettings').onclick = closeSettings;
  document.querySelector('#settingsModal .modal-backdrop').onclick = closeSettings;
  $('saveSettings').onclick = saveSettings;
  $('testSettings').onclick = testSettings;
  $('aiDetectBtn').onclick = aiDetect;
  $('saveLlm').onclick = saveLlm;
  $('testLlm').onclick = testLlm;
  $('fetchModels').onclick = fetchModels;
  // Tab 切换
  document.querySelectorAll('#settingsModal .tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('#settingsModal .tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('#settingsModal .tab-pane').forEach(p => p.classList.remove('active'));
      t.classList.add('active');
      $('tab-' + t.dataset.tab).classList.add('active');
    };
  });
  // 厂商切换:用预设覆盖 Base URL,并把默认模型下拉填成预设默认模型占位
  $('llmProvider').onchange = () => {
    const opt = $('llmProvider').selectedOptions[0];
    if (!opt) return;
    const isCustom = opt.value === 'custom';
    const presetBase = opt.dataset.base || '';
    const presetModel = opt.dataset.model || '';
    // 自定义:不动 base(用户自己填);其余厂商直接覆盖为预设
    if (!isCustom) $('llmBase').value = presetBase;
    // 默认模型:填预设占位。已获取到的模型列表保留,否则只放预设一项
    const sel = $('llmDefaultModel');
    if (LLM_MODELS.length) {
      // 如果当前已有模型列表且包含预设模型,直接选它;否则把预设插到第一位
      if (!LLM_MODELS.some(m => m.id === presetModel)) {
        LLM_MODELS = [{ id: presetModel, owned_by: '' }, ...LLM_MODELS];
      }
      sel.innerHTML = LLM_MODELS.map(m => `<option value="${m.id}">${m.id}${m.owned_by ? ' · ' + m.owned_by : ''}</option>`).join('');
    } else {
      sel.innerHTML = presetModel
        ? `<option value="${presetModel}">${presetModel}(厂商默认 · 请保存后获取模型列表校验)</option>`
        : '<option value="">请先获取模型</option>';
    }
    sel.value = presetModel;
  };
  $('voiceSearch').addEventListener('input', renderVoices);
  $('localeFilter').addEventListener('change', renderVoices);
  $('genderFilter').addEventListener('change', renderVoices);
  $('typeFilter').addEventListener('change', renderVoices);
  $('roleFilter').addEventListener('change', renderVoices);
  $('statusFilter').addEventListener('change', renderVoices);
  $('scenarioFilter').addEventListener('change', renderVoices);
  $('personalityFilter').addEventListener('change', renderVoices);
  $('modelFilter').addEventListener('change', renderVoices);
  $('sourceFilter').addEventListener('change', renderVoices);
  $('styleOnly').addEventListener('change', renderVoices);
  $('resetFilters').addEventListener('click', () => {
    $('voiceSearch').value = '';
    ['localeFilter', 'genderFilter', 'typeFilter', 'roleFilter', 'statusFilter',
      'scenarioFilter', 'personalityFilter', 'modelFilter', 'sourceFilter']
      .forEach(id => { $(id).value = ''; });
    $('styleOnly').checked = false;
    renderVoices();
  });
  $('toggleFilters').onclick = () => {
    const bar = $('filterBar');
    bar.classList.toggle('hidden');
    if (!bar.classList.contains('hidden')) renderVoiceFilters();
  };
  $('textInput').addEventListener('input', updateSpeakBtn);
  $('speakBtn').onclick = speak;
  $('downloadBtn').onclick = downloadAudio;
  $('playToggle').onclick = togglePlay;
  $('refreshHistory').onclick = loadHistory;
  $('batchDeleteHistory').onclick = batchDeleteHistory;
  $('selectAllHistory').onclick = toggleSelectAllHistory;

  bindRange('rate', '%');
  bindRange('pitch', 'Hz');
  bindRange('volume', '%');

  // 启动时检查是否已配置
  updateAiDetectBtn();
  try {
    const cfg = await api('/api/settings');
    if (cfg.apiKey) {
      setConn('unknown', '验证中…');
      loadVoices();
    } else {
      setConn('unknown', '未配置');
      $('voiceList').innerHTML = '<div class="empty-hint">点击右上角"设置",填入 Azure 端点和密钥,再点"测试连接"。</div>';
    }
  } catch {}
  loadHistory();
}

document.addEventListener('DOMContentLoaded', init);
