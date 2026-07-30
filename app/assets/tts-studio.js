(() => {
  'use strict';

  const API_BASE = window.location.origin;
  const PAGE = document.body.dataset.page || 'tts';
  const $ = (id) => document.getElementById(id);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const LANGUAGE_OPTIONS_TURBO = [
    ['', '自动检测'], ['zh', '中文'], ['en', '英语'], ['ja', '日语'], ['ko', '韩语'],
    ['yue', '粤语'], ['ms', '马来语'], ['th', '泰语'], ['vi', '越南语'], ['id', '印尼语'], ['ar', '阿拉伯语']
  ];
  const LANGUAGE_OPTIONS_EX = [
    ...LANGUAGE_OPTIONS_TURBO,
    ['es', '西班牙语'], ['fr', '法语'], ['pt', '葡萄牙语'], ['de', '德语'], ['ru', '俄语'],
    ['it', '意大利语'], ['tr', '土耳其语'], ['nl', '荷兰语'], ['uk', '乌克兰语'], ['pl', '波兰语'],
    ['ro', '罗马尼亚语'], ['el', '希腊语'], ['cs', '捷克语'], ['fi', '芬兰语'], ['hi', '印地语'],
    ['bg', '保加利亚语'], ['da', '丹麦语'], ['he', '希伯来语'], ['fa', '波斯语'], ['sk', '斯洛伐克语'],
    ['sv', '瑞典语'], ['hr', '克罗地亚语'], ['tl', '菲律宾语'], ['hu', '匈牙利语'], ['no', '挪威语'],
    ['sl', '斯洛文尼亚语'], ['ca', '加泰罗尼亚语'], ['nn', '新挪威语'], ['ta', '泰米尔语'], ['af', '南非荷兰语']
  ];
  const EMOTIONS = [
    ['', '无（默认）'], ['happy', 'happy — 高兴'], ['sad', 'sad — 悲伤'], ['angry', 'angry — 愤怒'],
    ['fearful', 'fearful — 恐惧'], ['disgusted', 'disgusted — 厌恶'], ['surprised', 'surprised — 惊讶'],
    ['calm', 'calm — 平静'], ['fluent', 'fluent — 流畅'], ['whisper', 'whisper — 低语']
  ];

  const state = {
    voices: [],
    voiceById: new Map(),
    languageMap: {},
    languageMaps: {},
    selectedVoice: '',
    mode: 'tts',
    ttsAudioBlob: null,
    streamAudioBlob: null,
    cloneAudioBlob: null,
    clonedVoiceId: '',
    clonedVoices: [],
    recorder: null,
    mediaStream: null,
    recordedChunks: [],
    recordedBlob: null,
    recordedUrl: '',
    recordingStartedAt: 0,
    recordTimer: null,
    historyDb: null,
    historyFilter: 'all',
    libraryCategory: 'all',
    libraryModel: 'all',
    languageFiltersExpanded: { studio: false, library: false },
    previewAudio: new Audio(),
    objectUrls: new Set()
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function hashHue(value) {
    let hash = 0;
    for (const char of String(value || 'voice')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return hash;
  }

  function orbStyle(voiceId) {
    const hue = hashHue(voiceId) % 360;
    return `--c1:hsl(${hue} 76% 75%);--c2:hsl(${(hue + 65) % 360} 62% 42%)`;
  }

  function getSession() {
    return window.SupabaseAuthInject?.getSession?.() || null;
  }

  function authHeaders(json = false) {
    const session = getSession();
    if (!session?.access_token) throw new Error('未登录或会话已过期，请先登录');
    return {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${session.access_token}`
    };
  }

  async function apiFetch(path, options = {}, expect = 'json') {
    const response = await fetch(`${API_BASE}${path}`, options);
    if (!response.ok) {
      const raw = await response.text();
      let message = raw;
      try { message = JSON.parse(raw).message || raw; } catch (_) {}
      throw new Error(message || `请求失败（${response.status}）`);
    }
    if (expect === 'response') return response;
    return response.json();
  }

  function updateQuota(quota) {
    if (!quota) return;
    const daily = Number(quota.daily ?? 0);
    const used = Number(quota.used ?? 0);
    const remaining = Number(quota.remaining ?? Math.max(daily - used, 0));
    const badge = $('studio-quota-badge');
    if (!badge) return;
    $('studio-quota-remaining').textContent = String(remaining);
    $('studio-quota-daily').textContent = String(daily);
    badge.style.display = 'inline-flex';
    badge.classList.toggle('warning', remaining >= 500 && remaining < 1500);
    badge.classList.toggle('danger', remaining < 500);
  }

  function readQuotaFromResponse(response, data) {
    const quota = {
      daily: Number(response.headers.get('X-Quota-Daily')),
      used: Number(response.headers.get('X-Quota-Used')),
      remaining: Number(response.headers.get('X-Quota-Remaining'))
    };
    const finalQuota = Object.values(quota).every(Number.isFinite) ? quota : data?.quota;
    if (finalQuota) {
      updateQuota(finalQuota);
      window.SupabaseAuthInject?.updateQuota?.(finalQuota);
    }
  }

  function showMessage(id, type, text) {
    const element = $(id);
    if (!element) return;
    element.className = `message ${type}`;
    element.textContent = text;
  }

  function clearMessage(id) {
    const element = $(id);
    if (element) element.className = 'message';
  }

  function setLoading(prefix, loading) {
    $(`${prefix}-loading`)?.classList.toggle('active', loading);
    const button = $(`${prefix}-btn`);
    if (button) button.disabled = loading;
  }

  function makeObjectUrl(blob) {
    const url = URL.createObjectURL(blob);
    state.objectUrls.add(url);
    return url;
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function pcmToWav(pcmData, sampleRate = 24000) {
    const dataLength = pcmData.byteLength;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    const write = (offset, value) => Array.from(value).forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write(36, 'data'); view.setUint32(40, dataLength, true);
    new Uint8Array(buffer, 44).set(new Uint8Array(pcmData));
    return new Blob([buffer], { type: 'audio/wav' });
  }

  function combineBuffers(chunks) {
    const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const bytes = new Uint8Array(size);
    let offset = 0;
    chunks.forEach((chunk) => { bytes.set(new Uint8Array(chunk), offset); offset += chunk.byteLength; });
    return bytes.buffer;
  }

  function downloadBlob(blob, prefix = 'tts') {
    if (!blob) return;
    const anchor = document.createElement('a');
    anchor.href = makeObjectUrl(blob);
    anchor.download = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function copyText(text, feedbackElement) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    if (feedbackElement) {
      if (feedbackElement.classList.contains('copy-voice')) {
        window.clearTimeout(feedbackElement._copyFeedbackTimer);
        feedbackElement.classList.add('copied');
        feedbackElement.setAttribute('aria-label', 'Voice ID 已复制');
        feedbackElement._copyFeedbackTimer = window.setTimeout(() => {
          feedbackElement.classList.remove('copied');
          feedbackElement.setAttribute('aria-label', '复制 Voice ID');
        }, 1400);
        return;
      }

      const original = feedbackElement.textContent;
      feedbackElement.textContent = '已复制';
      setTimeout(() => { feedbackElement.textContent = original; }, 1000);
    }
  }

  async function loadVoices(includeExtended = false) {
    const query = includeExtended ? '?includeExtended=true' : '';
    const data = await apiFetch(`/api/tts/voices${query}`);
    state.voices = Array.isArray(data.voices) ? data.voices : [];
    state.languageMap = data.languageMap && typeof data.languageMap === 'object' ? data.languageMap : {};
    state.languageMaps = data.languageMaps && typeof data.languageMaps === 'object' ? data.languageMaps : {};
    state.voiceById = new Map(state.voices.map((voice) => [voice.id, voice]));
    if (!state.selectedVoice && state.voices[0]) state.selectedVoice = state.voices[0].id;
    return state.voices;
  }

  function availableLanguageOptions(model) {
    return model === 'flow_01_ex' ? LANGUAGE_OPTIONS_EX : LANGUAGE_OPTIONS_TURBO;
  }

  function voiceMatches(voice, query, category) {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = !normalizedQuery || [voice.name, voice.nameEn, voice.id, voice.language, voice.description, voice.scenarios]
      .filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
    if (!matchesQuery) return false;
    if (!category || category === 'all') return true;
    return String(voice.language || '').toLowerCase() === category;
  }

  function languageFilterHtml(model = 'all', expanded = false, activeCategory = 'all') {
    const counts = new Map();
    state.voices.forEach((voice) => {
      if (model !== 'all' && effectiveVoiceModel(voice) !== model) return;
      counts.set(voice.language, (counts.get(voice.language) || 0) + 1);
    });
    const items = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const labels = model === 'all' ? state.languageMap : (state.languageMaps[model] || state.languageMap);
    const normalizedActive = activeCategory === 'all' || items.some(([code]) => code === activeCategory) ? activeCategory : 'all';
    const visibleLimit = 6;
    const visibleItems = expanded ? items : items.slice(0, visibleLimit);
    const hiddenCount = Math.max(items.length - visibleLimit, 0);
    const activeIsHidden = !expanded && normalizedActive !== 'all' && !visibleItems.some(([code]) => code === normalizedActive);
    if (activeIsHidden) {
      const activeItem = items.find(([code]) => code === normalizedActive);
      if (activeItem) visibleItems.push(activeItem);
    }
    return [
      `<button class="chip ${normalizedActive === 'all' ? 'on' : ''}" data-category="all" type="button">全部</button>`,
      ...visibleItems.map(([code, count]) => `<button class="chip ${normalizedActive === code ? 'on' : ''}" data-category="${escapeHtml(code)}" type="button">${escapeHtml(labels[code]?.name || code)} <b>${count}</b></button>`),
      hiddenCount > 0 ? `<button class="chip language-more" data-language-toggle type="button">${expanded ? '收起' : `+${hiddenCount} 更多语言`} <span aria-hidden="true">${expanded ? '⌃' : '⌄'}</span></button>` : ''
    ].join('');
  }

  function bindFilterChips(container, onChange, onToggle) {
    if (!container) return;
    container.onclick = (event) => {
      const toggle = event.target.closest('[data-language-toggle]');
      if (toggle) {
        onToggle?.();
        return;
      }
      const chip = event.target.closest('.chip');
      if (!chip) return;
      qsa('.chip', container).forEach((item) => item.classList.toggle('on', item === chip));
      onChange(chip.dataset.category || 'all');
    };
  }

  function effectiveVoiceModel(voice) {
    const explicit = voice?.model;
    if (explicit === 'flow_01_ex' || explicit === 'flow_02_turbo') return explicit;
    return String(voice?.id || '').toLowerCase().includes('_ex') ? 'flow_01_ex' : 'flow_02_turbo';
  }

  function currentStudioModel() {
    return qsa('#studio-model .seg-item').find((button) => button.classList.contains('on'))?.dataset.model || '';
  }

  function voiceCardHtml(voice, selected = false, library = false) {
    const langs = Array.isArray(voice.supportedLanguages) ? voice.supportedLanguages.join(' · ') : (voice.language || 'auto');
    const isExtended = effectiveVoiceModel(voice) === 'flow_01_ex';
    return `<article class="voice-card ${selected ? 'selected' : ''}" data-voice-id="${escapeHtml(voice.id)}" tabindex="0">
      <div class="voice-top">
        <span class="voice-orb" style="${orbStyle(voice.id)}"></span>
        <span class="voice-actions">
          ${voice.previewUrl ? `<button class="icon-btn preview-voice" type="button" title="试听" data-preview-url="${escapeHtml(voice.previewUrl)}">▶</button>` : ''}
          <button class="icon-btn copy-voice" type="button" title="复制 Voice ID" aria-label="复制 Voice ID">
            <svg class="copy-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="8" y="8" width="11" height="11" rx="2"></rect>
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
            </svg>
            <svg class="copy-check" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 4 4L19 6"></path>
            </svg>
            <span class="copy-feedback" role="status">已复制</span>
          </button>
        </span>
      </div>
      <div class="voice-name">${escapeHtml(voice.name || voice.nameEn || '未命名音色')}</div>
      <div class="voice-badges"><span class="voice-badge">${escapeHtml(voice.language || 'auto')}</span>${isExtended ? '<span class="voice-badge ex">ex</span>' : ''}</div>
      <div class="voice-meta">${escapeHtml(langs)}<br>${escapeHtml(voice.id)}</div>
      ${library ? `<div class="voice-desc">${escapeHtml(voice.description || voice.scenarios || '预设音色')}</div>` : ''}
    </article>`;
  }

  function bindVoiceCards(container, onPick) {
    if (!container) return;
    container.onclick = (event) => {
      const preview = event.target.closest('.preview-voice');
      if (preview) {
        event.stopPropagation();
        state.previewAudio.pause();
        state.previewAudio.src = preview.dataset.previewUrl;
        state.previewAudio.play().catch(() => {});
        return;
      }
      const copy = event.target.closest('.copy-voice');
      const card = event.target.closest('.voice-card');
      if (copy && card) {
        event.stopPropagation();
        copyText(card.dataset.voiceId, copy);
        return;
      }
      if (card) onPick(card.dataset.voiceId);
    };
    container.onkeydown = (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.voice-card')) {
        event.preventDefault();
        onPick(event.target.closest('.voice-card').dataset.voiceId);
      }
    };
  }

  function setSelectOptions(select, options) {
    if (!select) return;
    select.innerHTML = options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
  }

  function initShell() {
    qsa('.side-item').forEach((item) => item.classList.toggle('active', item.dataset.page === PAGE));
    $('side-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('side-collapsed');
      localStorage.setItem('tts-side-collapsed', document.body.classList.contains('side-collapsed') ? '1' : '0');
    });
    if (localStorage.getItem('tts-side-collapsed') === '1') document.body.classList.add('side-collapsed');
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) document.body.classList.add('dark');
    $('theme-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    });
    window.addEventListener('quotaUpdated', (event) => updateQuota(event.detail));
    const initialQuota = window.SupabaseAuthInject?.getQuota?.();
    if (initialQuota) updateQuota(initialQuota);
  }

  function initHomePage() {
    const panels = qsa('[data-home-panel]');
    const tabs = qsa('[data-home-tab]');
    const setPanel = (name) => {
      tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.homeTab === name));
      panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.homePanel === name));
    };
    tabs.forEach((tab) => tab.addEventListener('click', () => setPanel(tab.dataset.homeTab)));
    const text = $('home-demo-text');
    const updateHomeCount = () => { if ($('home-demo-count')) $('home-demo-count').textContent = `${text.value.length} / 1000`; };
    text?.addEventListener('input', updateHomeCount);
    qsa('[data-home-example]').forEach((button) => button.addEventListener('click', () => {
      qsa('[data-home-example]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      text.value = button.dataset.text || '';
      const voiceByScene = {
        '课堂教育': 'v-female-Z3x9LmQ2',
        '客服场景': 'female-kefu-xiaomei',
        '游戏': 'v-male-Bk7vD3xP',
        '有声书': 'v-male-D1a3XyN1'
      };
      if ($('home-demo-voice')) $('home-demo-voice').value = voiceByScene[button.dataset.homeExample] || '';
      updateHomeCount();
    }));
    const updateTryLink = () => {
      const params = new URLSearchParams({
        text: text?.value || '',
        voice: $('home-demo-voice')?.value || '',
        model: $('home-demo-model')?.value || 'flow_02_turbo',
        language: $('home-demo-language')?.value || ''
      });
      $('home-try-tts').href = `tts.html?${params.toString()}`;
    };
    ['home-demo-text', 'home-demo-model', 'home-demo-language', 'home-demo-voice'].forEach((id) => $(id)?.addEventListener('input', updateTryLink));
    $('home-try-tts')?.addEventListener('pointerdown', updateTryLink);
    updateHomeCount();
    updateTryLink();
  }

  function renderStudioVoices() {
    const container = $('studio-voice-list');
    if (!container) return;
    const query = $('studio-voice-search')?.value || '';
    const category = qsa('#studio-voice-cats .chip').find((chip) => chip.classList.contains('on'))?.dataset.category || 'all';
    const model = currentStudioModel();
    const list = state.voices.filter((voice) => {
      const voiceModel = effectiveVoiceModel(voice);
      return voiceMatches(voice, query, category) && (!model || voiceModel === model);
    });
    container.innerHTML = list.slice(0, 36).map((voice) => voiceCardHtml(voice, voice.id === state.selectedVoice)).join('') || '<div class="voice-empty">没有匹配的音色</div>';
    const summary = $('studio-model-summary');
    if (summary) summary.textContent = `当前模型 ${model || '自动'} · ${list.length} 个可用音色`;
  }

  function renderStudioLanguageFilters() {
    const container = $('studio-voice-cats');
    if (!container) return;
    const activeCategory = qsa('.chip.on', container)[0]?.dataset.category || 'all';
    container.innerHTML = languageFilterHtml(currentStudioModel(), state.languageFiltersExpanded.studio, activeCategory);
    bindFilterChips(container, renderStudioVoices, () => {
      state.languageFiltersExpanded.studio = !state.languageFiltersExpanded.studio;
      renderStudioLanguageFilters();
    });
  }

  function chooseStudioVoice(voiceId, fillText = true) {
    state.selectedVoice = voiceId;
    const voice = state.voiceById.get(voiceId);
    if (fillText && voice?.sampleText) {
      $('studio-text').value = voice.sampleText;
      $('studio-text').dataset.userEdited = '1';
      updateCharCount();
    }
    renderStudioVoices();
  }

  function updateCharCount() {
    const text = $('studio-text')?.value || '';
    const max = 1000;
    $('studio-char-count').textContent = `${text.length} / ${max}`;
  }

  function setMode(mode) {
    state.mode = mode;
    qsa('.ctab').forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
    $('studio-submit-label').textContent = mode === 'streaming' ? '流式合成' : '合成语音';
    $('stream-status')?.classList.toggle('hidden', mode !== 'streaming');
    const advanced = $('studio-advanced');
    if (advanced) advanced.classList.toggle('hidden', mode === 'streaming');
    $('studio-cost').textContent = `本次${mode === 'streaming' ? '流式' : ''}合成将消耗 100 点配额`;
    updateCharCount();
  }

  function updateModelControls() {
    const model = currentStudioModel();
    const selectedLanguage = $('studio-language')?.value || '';
    setSelectOptions($('studio-language'), availableLanguageOptions(model));
    if (availableLanguageOptions(model).some(([value]) => value === selectedLanguage)) $('studio-language').value = selectedLanguage;
    $('studio-emotion-field')?.classList.toggle('hidden', model !== 'flow_01_ex');
    if (model !== 'flow_01_ex' && $('studio-emotion')) $('studio-emotion').value = '';
    if ($('studio-voice-search')) $('studio-voice-search').value = '';
    state.languageFiltersExpanded.studio = false;
    const firstAvailable = state.voices.find((voice) => effectiveVoiceModel(voice) === model);
    if (firstAvailable && !state.voices.some((voice) => voice.id === state.selectedVoice && effectiveVoiceModel(voice) === model)) state.selectedVoice = firstAvailable.id;
    renderStudioLanguageFilters();
    renderStudioVoices();
  }

  function getStudioRequest() {
    const customVoice = $('studio-custom-voice').value.trim();
    const model = currentStudioModel();
    const format = qsa('#studio-format .seg-item').find((button) => button.classList.contains('on'))?.dataset.format || 'pcm';
    return {
      text: $('studio-text').value.trim(),
      voiceId: customVoice || state.selectedVoice,
      language: $('studio-language').value,
      model,
      emotion: model === 'flow_01_ex' ? $('studio-emotion').value : '',
      speed: Number($('studio-speed').value),
      volume: Number($('studio-volume').value),
      pitch: Number($('studio-pitch').value),
      format,
      sampleRate: Number($('studio-sample-rate').value)
    };
  }

  function showStudioResult(blob, processingTime, size, firstChunk = null) {
    state.ttsAudioBlob = state.mode === 'tts' ? blob : state.ttsAudioBlob;
    state.streamAudioBlob = state.mode === 'streaming' ? blob : state.streamAudioBlob;
    $('studio-audio').src = makeObjectUrl(blob);
    $('studio-player').classList.add('active');
    $('result-empty')?.classList.add('hidden');
    $('metric-first').textContent = firstChunk == null ? '-' : `${firstChunk}ms`;
    $('metric-time').textContent = `${processingTime}ms`;
    $('metric-size').textContent = `${(size / 1024).toFixed(1)} KB`;
    $('metric-chars').textContent = String($('studio-text').value.length);
    $('studio-download').disabled = false;
    const status = $('studio-result-status');
    if (status) { status.textContent = '已完成'; status.className = 'status-pill done'; }
  }

  async function synthesizeNormal(request) {
    const started = Date.now();
    const response = await apiFetch('/api/tts/synthesize', {
      method: 'POST', headers: authHeaders(true), body: JSON.stringify(request)
    }, 'response');
    const data = await response.json();
    readQuotaFromResponse(response, data);
    if (!data.audio) throw new Error('服务端未返回音频数据');
    const raw = base64ToArrayBuffer(data.audio);
    let blob;
    if (request.format === 'wav') blob = new Blob([raw], { type: 'audio/wav' });
    else if (request.format === 'mp3') blob = new Blob([raw], { type: 'audio/mpeg' });
    else blob = pcmToWav(raw, request.sampleRate);
    const elapsed = Date.now() - started;
    showStudioResult(blob, elapsed, raw.byteLength);
    await saveHistory('tts', { ...request, processingTime: elapsed, size: raw.byteLength }, blob);
  }

  async function synthesizeStream(request) {
    const started = Date.now();
    const response = await apiFetch('/api/tts/synthesize-stream', {
      method: 'POST', headers: authHeaders(true), body: JSON.stringify({
        text: request.text, voiceId: request.voiceId, language: request.language,
        model: request.model, emotion: request.emotion
      })
    }, 'response');
    readQuotaFromResponse(response);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunks = [];
    let totalSize = 0;
    let firstChunk = null;
    let chunkCount = 0;
    $('stream-connection').textContent = '已连接';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let event;
        try { event = JSON.parse(line.slice(6)); } catch (_) { continue; }
        if (event.error) throw new Error(event.error);
        if (event.Type !== 'audio') continue;
        if (firstChunk == null) firstChunk = Date.now() - started;
        chunkCount += 1;
        if (event.Audio) {
          const bytes = base64ToArrayBuffer(event.Audio);
          chunks.push(bytes);
          totalSize += bytes.byteLength;
        }
        $('stream-chunks').textContent = String(chunkCount);
        $('stream-first').textContent = firstChunk == null ? '-' : `${firstChunk}ms`;
        $('stream-size').textContent = `${(totalSize / 1024).toFixed(1)} KB`;
        if (event.IsEnd) {
          const raw = combineBuffers(chunks);
          const blob = pcmToWav(raw, 24000);
          const elapsed = Date.now() - started;
          showStudioResult(blob, elapsed, raw.byteLength, firstChunk);
          $('stream-connection').textContent = '已完成';
          await saveHistory('streaming', { ...request, processingTime: elapsed, size: raw.byteLength }, blob);
          return;
        }
      }
    }
    throw new Error('流式响应异常结束');
  }

  async function runStudioSynthesis() {
    clearMessage('studio-message');
    const request = getStudioRequest();
    if (!request.text) return showMessage('studio-message', 'error', '请输入要合成的文本');
    if (request.text.length > 1000) return showMessage('studio-message', 'error', '文本最多支持 1,000 个字符');
    if (!request.voiceId) return showMessage('studio-message', 'error', '请选择音色或填写 Voice ID');
    setLoading('studio', true);
    const status = $('studio-result-status');
    if (status) { status.textContent = state.mode === 'streaming' ? '连接中' : '合成中'; status.className = 'status-pill loading'; }
    if (state.mode === 'streaming') {
      $('stream-connection').textContent = '连接中';
      $('stream-chunks').textContent = '0'; $('stream-first').textContent = '-'; $('stream-size').textContent = '0 KB';
    }
    try {
      if (state.mode === 'streaming') await synthesizeStream(request);
      else await synthesizeNormal(request);
      showMessage('studio-message', 'success', state.mode === 'streaming' ? '流式合成完成' : '语音合成完成');
    } catch (error) {
      showMessage('studio-message', 'error', `请求失败：${error.message}`);
      if (state.mode === 'streaming') $('stream-connection').textContent = '失败';
      if (status) { status.textContent = '失败'; status.className = 'status-pill failed'; }
    } finally {
      setLoading('studio', false);
    }
  }

  function initTtsPage() {
    setSelectOptions($('studio-language'), LANGUAGE_OPTIONS_TURBO);
    setSelectOptions($('studio-emotion'), EMOTIONS);
    qsa('.ctab').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
    qsa('#studio-model .seg-item').forEach((button) => button.addEventListener('click', () => {
      qsa('#studio-model .seg-item').forEach((item) => item.classList.remove('on'));
      button.classList.add('on'); updateModelControls();
    }));
    qsa('#studio-format .seg-item').forEach((button) => button.addEventListener('click', () => {
      if (button.disabled) return;
      qsa('#studio-format .seg-item').forEach((item) => item.classList.remove('on'));
      button.classList.add('on');
    }));
    qsa('[data-example]').forEach((button) => button.addEventListener('click', () => {
      $('studio-text').value = button.dataset.example; $('studio-text').dataset.userEdited = '1'; updateCharCount();
      if (button.dataset.voice && state.voiceById.has(button.dataset.voice)) {
        const recommendedModel = effectiveVoiceModel(state.voiceById.get(button.dataset.voice));
        qsa('#studio-model .seg-item').forEach((item) => item.classList.toggle('on', item.dataset.model === recommendedModel));
        updateModelControls();
        chooseStudioVoice(button.dataset.voice, false);
      }
    }));
    $('studio-text').addEventListener('input', () => { $('studio-text').dataset.userEdited = '1'; updateCharCount(); });
    $('studio-clear').addEventListener('click', () => { $('studio-text').value = ''; $('studio-text').dataset.userEdited = '1'; updateCharCount(); });
    $('studio-reset').addEventListener('click', () => {
      $('studio-text').value = '您好，欢迎致电智能客服中心。请问有什么可以帮您？如需人工服务，请按零。';
      $('studio-text').dataset.userEdited = '1';
      $('studio-custom-voice').value = '';
      $('studio-speed').value = '1'; $('studio-volume').value = '1'; $('studio-pitch').value = '0';
      $('studio-speed-value').textContent = '1.0'; $('studio-volume-value').textContent = '1.0'; $('studio-pitch-value').textContent = '0';
      $('studio-language').value = '';
      $('studio-voice-search').value = '';
      clearMessage('studio-message');
      $('studio-player').classList.remove('active');
      $('result-empty')?.classList.remove('hidden');
      $('studio-download').disabled = true;
      $('studio-result-status').textContent = '待合成'; $('studio-result-status').className = 'status-pill';
      state.selectedVoice = state.voices[0]?.id || '';
      renderStudioLanguageFilters();
      renderStudioVoices();
      updateCharCount();
    });
    qsa('input[type=range]').forEach((input) => input.addEventListener('input', () => {
      const output = $(`${input.id}-value`); if (output) output.textContent = Number(input.value).toFixed(input.step.includes('.') ? 1 : 0);
    }));
    $('studio-submit').addEventListener('click', runStudioSynthesis);
    $('studio-download').addEventListener('click', () => downloadBlob(state.mode === 'streaming' ? state.streamAudioBlob : state.ttsAudioBlob, state.mode));
    $('studio-text').addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); runStudioSynthesis(); }
    });
    $('studio-voice-search').addEventListener('input', renderStudioVoices);
    bindVoiceCards($('studio-voice-list'), (voiceId) => chooseStudioVoice(voiceId));
    loadVoices(true).then(() => {
      const params = new URLSearchParams(location.search);
      if (params.get('voice') && state.voiceById.has(params.get('voice'))) state.selectedVoice = params.get('voice');
      if (params.get('model')) {
        qsa('#studio-model .seg-item').forEach((item) => item.classList.toggle('on', item.dataset.model === params.get('model')));
      }
      updateModelControls();
      if (params.get('language') && availableLanguageOptions(currentStudioModel()).some(([value]) => value === params.get('language'))) {
        $('studio-language').value = params.get('language');
      }
      chooseStudioVoice(state.selectedVoice, false);
    }).catch((error) => showMessage('studio-message', 'error', `音色加载失败：${error.message}`));
    updateCharCount(); updateModelControls(); setMode(new URLSearchParams(location.search).get('mode') === 'streaming' ? 'streaming' : 'tts');
  }

  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function processAudioForCloning(file) {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const sourceBuffer = await context.decodeAudioData(await file.arrayBuffer());
      const length = Math.ceil(sourceBuffer.duration * 16000);
      const offline = new OfflineAudioContext(1, length, 16000);
      const source = offline.createBufferSource();
      source.buffer = sourceBuffer; source.connect(offline.destination); source.start();
      const rendered = await offline.startRendering();
      const floats = rendered.getChannelData(0);
      const pcm = new Int16Array(floats.length);
      for (let i = 0; i < floats.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, floats[i]));
        pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      return { blob: pcmToWav(pcm.buffer, 16000), duration: rendered.duration };
    } finally { await context.close(); }
  }

  function validateCloneName() {
    const input = $('clone-name');
    const hint = $('clone-name-hint');
    const valid = /^[A-Za-z0-9_]{1,36}$/.test(input.value.trim());
    hint.classList.toggle('error', input.value.trim() && !valid);
    hint.textContent = valid || !input.value.trim() ? '仅限数字、英文字母和下划线，最多 36 位' : '名称格式不正确，请仅使用数字、字母和下划线';
    return valid;
  }

  function setCloneSourceTab(tab) {
    qsa('.sub-tab').forEach((button) => button.classList.toggle('active', button.dataset.cloneTab === tab));
    $('clone-upload-tab').classList.toggle('active', tab === 'upload');
    $('clone-record-tab').classList.toggle('active', tab === 'record');
  }

  function renderSelectedFile(file, clearRecording = true) {
    const info = $('clone-file-info');
    if (!file) {
      info.textContent = '支持 WAV、MP3、M4A 等浏览器可解码的音频格式';
      $('clone-dropzone').classList.remove('has-file');
      if (clearRecording) {
        state.recordedBlob = null;
        if (state.recordedUrl) {
          URL.revokeObjectURL(state.recordedUrl);
          state.recordedUrl = '';
        }
        $('recording-audio')?.classList.add('hidden');
      }
      return;
    }
    info.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · 将转换为 16kHz 单声道 WAV`;
    $('clone-dropzone').classList.add('has-file');
    if (clearRecording) {
      resetRecording();
    }
  }

  function resetRecording() {
    if (state.recorder?.state === 'recording') {
      state.recorder.onstop = null;
      state.recorder.stop();
    }
    clearInterval(state.recordTimer);
    state.recordTimer = null;
    state.mediaStream?.getTracks().forEach((track) => track.stop());
    state.mediaStream = null;
    state.recorder = null;
    state.recordedChunks = [];
    state.recordedBlob = null;
    if (state.recordedUrl) {
      URL.revokeObjectURL(state.recordedUrl);
      state.objectUrls.delete(state.recordedUrl);
      state.recordedUrl = '';
    }
    const audio = $('recording-audio');
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.classList.add('hidden');
    }
    $('record-time').textContent = '0.0s';
    $('record-status').textContent = '点击开始录音';
    $('record-progress').style.width = '0%';
    $('record-button').classList.remove('recording');
    $('record-reset').disabled = true;
    clearMessage('clone-message');
  }

  async function toggleRecording() {
    if (state.recorder?.state === 'recording') {
      state.recorder.stop(); return;
    }
    try {
      if (state.recordedBlob) resetRecording();
      $('record-reset').disabled = true;
      state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const supported = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      state.recorder = new MediaRecorder(state.mediaStream, supported ? { mimeType: supported } : undefined);
      state.recordedChunks = [];
      state.recorder.ondataavailable = (event) => { if (event.data.size) state.recordedChunks.push(event.data); };
      state.recorder.onstop = () => {
        state.recordedBlob = new Blob(state.recordedChunks, { type: state.recorder.mimeType || 'audio/webm' });
        if ($('clone-file')) $('clone-file').value = '';
        renderSelectedFile(null, false);
        if (state.recordedUrl) URL.revokeObjectURL(state.recordedUrl);
        state.recordedUrl = makeObjectUrl(state.recordedBlob);
        $('recording-audio').src = state.recordedUrl; $('recording-audio').classList.remove('hidden');
        state.mediaStream?.getTracks().forEach((track) => track.stop());
        state.mediaStream = null;
        clearInterval(state.recordTimer); state.recordTimer = null;
        $('record-button').classList.remove('recording'); $('record-status').textContent = '录音完成';
        $('record-reset').disabled = false;
      };
      state.recordingStartedAt = Date.now(); state.recorder.start(); $('record-button').classList.add('recording'); $('record-status').textContent = '录音中，再次点击停止';
      state.recordTimer = setInterval(() => {
        const seconds = (Date.now() - state.recordingStartedAt) / 1000;
        $('record-time').textContent = `${seconds.toFixed(1)}s`; $('record-progress').style.width = `${Math.min(seconds / 180 * 100, 100)}%`;
        if (seconds >= 180) state.recorder.stop();
      }, 100);
    } catch (error) { showMessage('clone-message', 'error', `无法开始录音：${error.message}`); }
  }

  async function createClone() {
    clearMessage('clone-message');
    const name = $('clone-name').value.trim();
    if (!name || !validateCloneName()) return showMessage('clone-message', 'error', '请输入合法的音色名称');
    const source = state.recordedBlob || $('clone-file').files[0];
    if (!source) return showMessage('clone-message', 'error', '请上传音频或先完成录音');
    setLoading('clone', true);
    try {
      showMessage('clone-message', 'info', '正在转换并检查音频...');
      const processed = await processAudioForCloning(source);
      if (processed.duration < 6 || processed.duration > 180) throw new Error(`音频时长为 ${processed.duration.toFixed(1)} 秒，请使用 6–180 秒音频`);
      const response = await apiFetch('/api/voice/clone', {
        method: 'POST', headers: authHeaders(true), body: JSON.stringify({
          voiceName: name, audioData: await blobToBase64(processed.blob), audioDuration: processed.duration,
          model: $('clone-model').value || undefined
        })
      }, 'response');
      const data = await response.json(); readQuotaFromResponse(response, data);
      state.clonedVoiceId = data.voiceId || ''; $('clone-use-voice-id').value = state.clonedVoiceId;
      showMessage('clone-message', 'success', `克隆成功，Voice ID：${state.clonedVoiceId}`);
      await saveHistory('clone-create', { voiceId: state.clonedVoiceId, voiceName: name, processingTime: 0, size: processed.blob.size }, null);
      await loadClonedVoices();
    } catch (error) { showMessage('clone-message', 'error', `克隆失败：${error.message}`); }
    finally { setLoading('clone', false); }
  }

  async function loadClonedVoices() {
    const list = $('cloned-voice-list');
    if (!list) return;
    if (!getSession()?.access_token) { list.innerHTML = '<div class="empty-state">登录后可查看已保存音色</div>'; return; }
    try {
      const data = await apiFetch('/api/voice/list', { headers: authHeaders() });
      state.clonedVoices = data.voices || [];
      if ($('clone-count')) $('clone-count').textContent = `${state.clonedVoices.length} 个`;
      list.innerHTML = state.clonedVoices.length ? state.clonedVoices.map((voice) => `<div class="list-row">
        <div class="list-main"><div class="list-name">${escapeHtml(voice.voice_name || '未命名')} <span class="status-pill done">可用</span></div><div class="list-id">${escapeHtml(voice.voice_id)}</div><div class="list-meta">${voice.created_at ? new Date(voice.created_at).toLocaleString() : ''}${voice.audio_duration ? ` · ${Number(voice.audio_duration).toFixed(1)}s` : ''}</div></div>
        <div class="row-actions"><button class="small-button use-clone" data-voice-id="${escapeHtml(voice.voice_id)}">使用</button><button class="small-button copy-clone" data-voice-id="${escapeHtml(voice.voice_id)}">复制</button><button class="small-button danger delete-clone" data-voice-id="${escapeHtml(voice.voice_id)}">删除</button></div>
      </div>`).join('') : '<div class="empty-state">暂无克隆音色</div>';
    } catch (error) { list.innerHTML = `<div class="empty-state">加载失败：${escapeHtml(error.message)}</div>`; }
  }

  async function deleteClone(voiceId) {
    if (!confirm('确认删除这个克隆音色吗？')) return;
    try { await apiFetch(`/api/voice/${encodeURIComponent(voiceId)}`, { method: 'DELETE', headers: authHeaders() }); await loadClonedVoices(); }
    catch (error) { showMessage('clone-message', 'error', `删除失败：${error.message}`); }
  }

  async function synthesizeClone() {
    clearMessage('clone-synth-message');
    const request = {
      text: $('clone-text').value.trim(), voiceId: $('clone-use-voice-id').value.trim() || state.clonedVoiceId,
      language: $('clone-language').value, model: $('clone-synth-model').value,
      emotion: $('clone-synth-model').value === 'flow_01_ex' ? $('clone-emotion').value : '',
      format: 'pcm', sampleRate: 24000, speed: 1, volume: 1, pitch: 0, billingContext: 'clone-audition'
    };
    if (!request.text || !request.voiceId) return showMessage('clone-synth-message', 'error', '请填写文本并选择 Voice ID');
    setLoading('clone-synth', true);
    try {
      const started = Date.now();
      const response = await apiFetch('/api/tts/synthesize', { method: 'POST', headers: authHeaders(true), body: JSON.stringify(request) }, 'response');
      const data = await response.json(); readQuotaFromResponse(response, data);
      const raw = base64ToArrayBuffer(data.audio); const blob = pcmToWav(raw, 24000); const elapsed = Date.now() - started;
      state.cloneAudioBlob = blob; $('clone-audio').src = makeObjectUrl(blob); $('clone-player').classList.add('active');
      $('clone-time').textContent = `${elapsed}ms`; $('clone-size').textContent = `${(raw.byteLength / 1024).toFixed(1)} KB`;
      await saveHistory('clone-tts', { ...request, processingTime: elapsed, size: raw.byteLength }, blob);
      showMessage('clone-synth-message', 'success', '克隆音色合成完成');
    } catch (error) { showMessage('clone-synth-message', 'error', `合成失败：${error.message}`); }
    finally { setLoading('clone-synth', false); }
  }

  function initClonePage() {
    setSelectOptions($('clone-language'), LANGUAGE_OPTIONS_EX); setSelectOptions($('clone-emotion'), EMOTIONS);
    qsa('.sub-tab').forEach((button) => button.addEventListener('click', () => setCloneSourceTab(button.dataset.cloneTab)));
    $('clone-name').addEventListener('input', validateCloneName);
    $('clone-file').addEventListener('change', () => renderSelectedFile($('clone-file').files[0]));
    const drop = $('clone-dropzone');
    drop.addEventListener('click', () => $('clone-file').click());
    ['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach((type) => drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.remove('dragging'); }));
    drop.addEventListener('drop', (event) => { if (event.dataTransfer.files[0]) { $('clone-file').files = event.dataTransfer.files; renderSelectedFile(event.dataTransfer.files[0]); } });
    $('record-button').addEventListener('click', toggleRecording);
    $('record-reset').addEventListener('click', resetRecording);
    $('clone-btn').addEventListener('click', createClone);
    $('clone-synth-model').addEventListener('change', () => { $('clone-emotion-field').classList.toggle('hidden', $('clone-synth-model').value !== 'flow_01_ex'); });
    $('clone-synth-btn').addEventListener('click', synthesizeClone); $('clone-download').addEventListener('click', () => downloadBlob(state.cloneAudioBlob, 'clone-tts'));
    $('cloned-voice-list').addEventListener('click', (event) => {
      const button = event.target.closest('button'); if (!button) return; const id = button.dataset.voiceId;
      if (button.classList.contains('use-clone')) { state.clonedVoiceId = id; $('clone-use-voice-id').value = id; $('clone-text').focus(); }
      if (button.classList.contains('copy-clone')) copyText(id, button);
      if (button.classList.contains('delete-clone')) deleteClone(id);
    });
    window.addEventListener('authReady', loadClonedVoices); loadClonedVoices();
  }

  function renderLibrary() {
    const grid = $('library-grid'); if (!grid) return;
    const query = $('library-search').value; const category = state.libraryCategory;
    const list = state.voices.filter((voice) => voiceMatches(voice, query, category)
      && (state.libraryModel === 'all' || effectiveVoiceModel(voice) === state.libraryModel));
    $('library-count').textContent = `${list.length} 个音色`;
    grid.innerHTML = list.map((voice) => voiceCardHtml(voice, false, true)).join('') || '<div class="empty-state">没有匹配的音色</div>';
  }

  function initVoicesPage() {
    $('library-search').addEventListener('input', renderLibrary);
    $('library-model').addEventListener('change', () => {
      state.libraryModel = $('library-model').value;
      state.libraryCategory = 'all';
      state.languageFiltersExpanded.library = false;
      $('library-filters').innerHTML = languageFilterHtml(state.libraryModel, false, 'all');
      renderLibrary();
    });
    bindFilterChips($('library-filters'), (category) => {
      state.libraryCategory = category;
      renderLibrary();
    }, () => {
      state.languageFiltersExpanded.library = !state.languageFiltersExpanded.library;
      $('library-filters').innerHTML = languageFilterHtml(state.libraryModel, state.languageFiltersExpanded.library, state.libraryCategory);
    });
    bindVoiceCards($('library-grid'), (voiceId) => { location.href = `tts.html?voice=${encodeURIComponent(voiceId)}`; });
    loadVoices(true).then(() => {
      $('library-filters').innerHTML = languageFilterHtml('all', false, 'all');
      renderLibrary();
    }).catch((error) => { $('library-grid').innerHTML = `<div class="empty-state">音色加载失败：${escapeHtml(error.message)}</div>`; });
  }

  function openHistoryDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ttsDemo', 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('history')) {
          const store = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
          store.createIndex('type', 'type'); store.createIndex('createdAt', 'createdAt');
        }
      };
      request.onsuccess = () => { state.historyDb = request.result; resolve(request.result); };
      request.onerror = () => reject(request.error);
    });
  }

  async function saveHistory(type, meta, audio) {
    if (!state.historyDb) { try { await openHistoryDb(); } catch (_) { return; } }
    const tx = state.historyDb.transaction('history', 'readwrite');
    tx.objectStore('history').add({
      type, text: meta.text || '', voiceName: meta.voiceName || '', voice: meta.voiceId || '', voiceId: meta.voiceId || '', language: meta.language || '',
      model: meta.model || '', processingTime: meta.processingTime || 0, sampleRate: meta.sampleRate || 24000,
      size: meta.size || audio?.size || 0, audio: audio || null, createdAt: Date.now()
    });
  }

  function getHistoryItems() {
    return new Promise((resolve) => {
      if (!state.historyDb) return resolve([]);
      const request = state.historyDb.transaction('history', 'readonly').objectStore('history').getAll();
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.createdAt - a.createdAt));
      request.onerror = () => resolve([]);
    });
  }

  async function renderHistoryPage() {
    const list = $('history-list'); if (!list) return;
    const all = await getHistoryItems();
    const items = state.historyFilter === 'all' ? all : all.filter((item) => state.historyFilter === 'cloning' ? item.type.startsWith('clone') : item.type === state.historyFilter);
    if (!items.length) { list.innerHTML = '<div class="empty-state">暂无历史记录。完成文本转语音、流式合成、克隆音色或克隆试听后会自动保存在这里。</div>'; return; }
    list.innerHTML = items.map((item) => {
      const url = item.audio ? makeObjectUrl(item.audio) : ''; const label = item.type === 'tts' ? 'Text-to-Speech' : item.type === 'streaming' ? 'Streaming' : item.type === 'clone-create' ? 'Cloned Voice' : 'Cloning';
      const title = item.type === 'clone-create' ? item.voiceName || item.voiceId : item.text || '';
      return `<div class="history-row"><div class="history-main"><div class="history-title">${label} · ${escapeHtml(title)}</div><div class="history-meta">${escapeHtml(item.voiceId || item.voice || '')} · ${item.type === 'clone-create' ? 'Cloning' : label} · ${new Date(item.createdAt).toLocaleString()}</div></div>${url ? `<audio src="${url}" controls></audio>` : ''}<div class="row-actions">${item.type !== 'clone-create' ? `<button class="small-button history-reuse" data-id="${item.id}">复用</button>` : ''}${item.audio ? `<button class="small-button history-download" data-id="${item.id}">下载</button>` : ''}<button class="small-button danger history-delete" data-id="${item.id}">删除</button></div></div>`;
    }).join('');
  }

  function getHistoryItem(id) {
    return new Promise((resolve) => {
      const request = state.historyDb.transaction('history', 'readonly').objectStore('history').get(Number(id));
      request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(null);
    });
  }

  async function deleteHistory(id) {
    const tx = state.historyDb.transaction('history', 'readwrite'); tx.objectStore('history').delete(Number(id));
    tx.oncomplete = renderHistoryPage;
  }

  async function clearHistory() {
    if (!confirm('确认清空全部历史记录吗？')) return;
    const tx = state.historyDb.transaction('history', 'readwrite'); tx.objectStore('history').clear(); tx.oncomplete = renderHistoryPage;
  }

  async function reuseHistory(id) {
    const item = await getHistoryItem(id); if (!item) return;
    const params = new URLSearchParams({ text: item.text || '', voice: item.voiceId || item.voice || '', mode: item.type === 'streaming' ? 'streaming' : 'tts' });
    if (item.type === 'clone-tts' || item.type === 'clone-create') location.href = `voice-clone.html?text=${encodeURIComponent(item.text || '')}&voice=${encodeURIComponent(item.voiceId || '')}`;
    else location.href = `tts.html?${params.toString()}`;
  }

  async function initHistoryPage() {
    try { await openHistoryDb(); } catch (error) { $('history-list').innerHTML = `<div class="empty-state">IndexedDB 初始化失败：${escapeHtml(error.message)}</div>`; return; }
    qsa('.history-filter').forEach((button) => button.addEventListener('click', () => {
      state.historyFilter = button.dataset.filter; qsa('.history-filter').forEach((item) => item.classList.remove('on')); button.classList.add('on'); renderHistoryPage();
    }));
    $('history-clear').addEventListener('click', clearHistory);
    $('history-list').addEventListener('click', async (event) => {
      const button = event.target.closest('button'); if (!button) return; const id = button.dataset.id;
      if (button.classList.contains('history-reuse')) reuseHistory(id);
      if (button.classList.contains('history-delete')) deleteHistory(id);
      if (button.classList.contains('history-download')) { const item = await getHistoryItem(id); downloadBlob(item?.audio, item?.type || 'history'); }
    });
    renderHistoryPage();
  }

  function applyUrlState() {
    const params = new URLSearchParams(location.search);
    if (PAGE === 'tts') {
      if (params.get('text')) { $('studio-text').value = params.get('text'); $('studio-text').dataset.userEdited = '1'; }
      if (params.get('voice')) { $('studio-custom-voice').value = params.get('voice'); state.selectedVoice = params.get('voice'); }
      updateCharCount();
    }
    if (PAGE === 'clone') {
      if (params.get('text')) $('clone-text').value = params.get('text');
      if (params.get('voice')) { $('clone-use-voice-id').value = params.get('voice'); state.clonedVoiceId = params.get('voice'); }
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initShell();
    if (PAGE === 'home') initHomePage();
    if (PAGE === 'tts') initTtsPage();
    if (PAGE === 'clone') initClonePage();
    if (PAGE === 'voices') initVoicesPage();
    if (PAGE === 'history') initHistoryPage();
    applyUrlState();
    if (!state.historyDb) openHistoryDb().catch(() => {});
  });

  window.addEventListener('beforeunload', () => {
    state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.mediaStream?.getTracks().forEach((track) => track.stop());
  });
})();
