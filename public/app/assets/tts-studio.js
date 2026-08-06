(() => {
  'use strict';

  const API_BASE = window.location.origin;
  const PAGE = document.body.dataset.page || 'tts';
  const $ = (id) => document.getElementById(id);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const i18n = window.TTSI18n;
  const t = (text, variables) => i18n?.t(text, variables) || text;
  const formatDateTime = (value) => i18n?.formatDateTime(value) || new Date(value).toLocaleString();
  const HISTORY_CACHE_PREFIX = 'tts-history-cache-v1:';
  const HISTORY_CACHE_MAX_AGE = 50 * 60 * 1000;

  const LANGUAGE_OPTIONS_TURBO_SOURCE = [
    ['', '自动检测'], ['zh', '中文'], ['en', '英语'], ['ja', '日语'], ['ko', '韩语'],
    ['yue', '粤语'], ['ms', '马来语'], ['th', '泰语'], ['vi', '越南语'], ['id', '印尼语'], ['ar', '阿拉伯语']
  ];
  const LANGUAGE_OPTIONS_EX_SOURCE = [
    ...LANGUAGE_OPTIONS_TURBO_SOURCE,
    ['es', '西班牙语'], ['fr', '法语'], ['pt', '葡萄牙语'], ['de', '德语'], ['ru', '俄语'],
    ['it', '意大利语'], ['tr', '土耳其语'], ['nl', '荷兰语'], ['uk', '乌克兰语'], ['pl', '波兰语'],
    ['ro', '罗马尼亚语'], ['el', '希腊语'], ['cs', '捷克语'], ['fi', '芬兰语'], ['hi', '印地语'],
    ['bg', '保加利亚语'], ['da', '丹麦语'], ['he', '希伯来语'], ['fa', '波斯语'], ['sk', '斯洛伐克语'],
    ['sv', '瑞典语'], ['hr', '克罗地亚语'], ['tl', '菲律宾语'], ['hu', '匈牙利语'], ['no', '挪威语'],
    ['sl', '斯洛文尼亚语'], ['ca', '加泰罗尼亚语'], ['nn', '新挪威语'], ['ta', '泰米尔语'], ['af', '南非荷兰语']
  ];
  const EMOTIONS_SOURCE = [
    ['', '无（默认）'], ['happy', 'happy — 高兴'], ['sad', 'sad — 悲伤'], ['angry', 'angry — 愤怒'],
    ['fearful', 'fearful — 恐惧'], ['disgusted', 'disgusted — 厌恶'], ['surprised', 'surprised — 惊讶'],
    ['calm', 'calm — 平静'], ['fluent', 'fluent — 流畅'], ['whisper', 'whisper — 低语']
  ];
  const SCENE_PRESETS = {
    education: {
      voice: 'v-female-A7c9QmP2',
      zh: `同学们好，欢迎来到今天的物理课堂。今天我们要学习的内容是"牛顿第三定律"——也就是作用力与反作用力的关系。在我们日常生活中，这个定律无处不在。比如，当你站在地面上，你的脚向下压地面，地面同时给你一个向上的支撑力，这两个力大小相等、方向相反。再比如，火箭发射时，向下喷射的高温气体给火箭一个强大的向上推力。大家注意，作用力和反作用力一定作用在两个不同的物体上，而且它们是同时产生、同时消失的。接下来，请翻开课本第四十二页，我们一起来看几道经典例题，巩固一下今天的知识。`,
      en: `Hello everyone, welcome to today's physics class. Today we'll be exploring Newton's Third Law of Motion — the principle of action and reaction. This law is at work all around us in daily life. For example, when you stand on the ground, your feet push down on the surface, and the ground pushes back up with an equal and opposite force. Another great example is a rocket launch: the hot gases expelled downward generate a powerful upward thrust. Remember, action and reaction forces always act on two different objects, and they appear and disappear simultaneously. Now, please turn to page forty-two in your textbook, and let's work through some classic problems together to reinforce what we've learned today.`
    },
    'customer-service': {
      voice: 'female-kefu-xiaomei',
      zh: `您好，感谢您致电客户服务中心，我是您的智能语音助手。请问有什么可以帮助您的？如果您需要查询订单状态，请按一；如果您需要办理退换货服务，请按二；如果您需要技术支持或故障报修，请按三；如需转接人工客服，请按零。在等待过程中，我想提醒您，我们最新推出的会员积分兑换活动已经上线，消费满一百积分即可兑换精美好礼。您也可以通过我们的官方小程序随时查看物流进度、修改收货地址或申请电子发票。感谢您的耐心等待，我们将竭诚为您服务。`,
      en: `Hello and thank you for calling Customer Service Center. I'm your virtual assistant. How may I help you today? For order status inquiries, please press one. For returns and exchanges, press two. For technical support or to report a malfunction, press three. To speak with a live agent, please press zero. While you wait, I'd like to let you know that our new loyalty rewards program is now live — redeem your points for exclusive gifts with just one hundred points. You can also track your delivery, update your shipping address, or request an electronic invoice anytime through our official app. Thank you for your patience, and we look forward to assisting you.`
    },
    game: {
      voice: 'v-male-D6p3KxN8',
      zh: `你竟能走到这里……百年了，云隐峰的石阶早已碎了大半，能踏完最后一级的人，寥寥无几。看你周身灵气尚浅，却有一股不肯回头的倔劲儿，倒让我想起从前那个人。我叫苏长渊。这名字，江湖上怕是早没人记得了。当年天玄宗八百弟子，我排剑榜第一，一柄「霜落」横扫六合，自以为天下无敌。直到那场浩劫降临，妖潮涌入中原——我的剑斩了三天三夜，最终也没能护住身后的人。从那以后，我把「霜落」插在这崖顶，再没拔出来过。你若想取这柄剑，我不拦你。但我得提醒你一句——剑无对错，持剑之人才分善恶。想清楚你为何而战，再去握它。否则，这柄剑会比妖魔更先吞噬你。

去吧，崖顶风大，别让心也跟着乱了。`,
      en: `Another visitor... You've walked a long way through rubble and ash to reach my door. See this hammer? It's been with me for forty years — it's struck more steel than you've seen roads. Back in the day, the Royal Knight Order — now those were men of iron and fire — every blade they carried was quenched in this very forge. I remember the last night I lit the furnace. The sky beyond the walls was burning red, and I was mending Captain Alven's broken sword. He told me, "One last edge, old Morgen. This will be my final battle." ...He never came back for that blade. And after that? Well, you see what's left of this city now. But I suppose you didn't come here to listen to an old man's stories. Place your weapon on the anvil and let me take a look — these hands may be weathered, but they haven't forgotten the feel of fire and steel.`
    },
    audiobook: {
      voice: 'v-female-p9Xy7Q1L',
      zh: `那年深秋，林小晚独自走在回家的路上。梧桐叶在晚风中旋转着落下，铺满了整条青石小巷。远处传来若有若无的桂花香气，混合着老街坊炖煮晚饭的烟火气息。她不自觉地放慢了脚步，目光落在巷口那盏昏黄的路灯上——那是外婆每晚都会亮起的灯。然而今天，老屋的窗户暗着，门前的藤椅空空荡荡。她的心猛地一沉，脚步变得沉重起来。推开那扇褪色的木门，屋内一切如旧，桌上的茶杯还冒着微微的热气。"外婆？"她轻轻喊了一声，声音在空旷的老屋里回荡，久久没有回应。`,
      en: `That late autumn evening, Jane walked home alone. Plane tree leaves spiraled down in the evening breeze, carpeting the old cobblestone alley in gold and amber. A faint fragrance of osmanthus drifted from somewhere far away, mingling with the warm, smoky aroma of neighbors' suppers simmering on stoves. She slowed her pace without thinking, her gaze settling on the dim yellow streetlamp at the alley's entrance — the one her grandmother always kept lit each night. But tonight, the old house windows were dark, and the rattan chair by the door sat empty. Her heart sank, and her footsteps grew heavy. She pushed open the faded wooden door. Inside, everything remained as it always had — the teacup on the table still trailed a wisp of steam. "Grandma?" she called softly. Her voice echoed through the hollow old house, met only with silence.`
    }
  };

  const translateOptions = (options) => options.map(([value, label]) => [value, label.includes(' — ')
    ? `${label.split(' — ')[0]} — ${t(label.split(' — ').slice(1).join(' — '))}`
    : t(label)]);
  const languageOptionsTurbo = () => translateOptions(LANGUAGE_OPTIONS_TURBO_SOURCE);
  const languageOptionsEx = () => translateOptions(LANGUAGE_OPTIONS_EX_SOURCE);
  const emotionOptions = () => translateOptions(EMOTIONS_SOURCE);

  const state = {
    voices: [],
    voiceById: new Map(),
    languageMap: {},
    languageMaps: {},
    selectedVoice: '',
    activeScene: '',
    mode: 'tts',
    ttsAudioBlob: null,
    ttsDownloadBlob: null,
    ttsFormat: 'mp3',
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
    historyFilter: 'all',
    historyItems: [],
    historyUserId: '',
    historyLoaded: false,
    historyLoading: null,
    historyAudio: new Audio(),
    historyAudioItemId: '',
    historyAudioStatus: 'idle',
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

  function currentSceneLocale() {
    return i18n?.getLocale?.() === 'en' ? 'en' : 'zh';
  }

  function sceneText(sceneId) {
    const scene = SCENE_PRESETS[sceneId];
    return scene?.[currentSceneLocale()] || scene?.zh || '';
  }

  function voiceDisplayName(voice) {
    return i18n?.getLocale?.() === 'en'
      ? (voice?.nameEn || voice?.name || t('未命名音色'))
      : (voice?.name || voice?.nameEn || t('未命名音色'));
  }

  function getSession() {
    return window.SupabaseAuthInject?.getSession?.() || null;
  }

  function historyCacheKey(userId) {
    return `${HISTORY_CACHE_PREFIX}${userId}`;
  }

  function readHistoryCache(userId) {
    if (!userId) return null;
    try {
      const raw = sessionStorage.getItem(historyCacheKey(userId));
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!Array.isArray(cached.items) || Date.now() - Number(cached.cachedAt || 0) > HISTORY_CACHE_MAX_AGE) {
        sessionStorage.removeItem(historyCacheKey(userId));
        return null;
      }
      return cached.items;
    } catch (_) {
      return null;
    }
  }

  function writeHistoryCache(userId, items) {
    if (!userId) return;
    try {
      sessionStorage.setItem(historyCacheKey(userId), JSON.stringify({
        cachedAt: Date.now(),
        items
      }));
    } catch (_) {}
  }

  function updateHistoryCache(userId, updater) {
    const cachedItems = readHistoryCache(userId);
    if (!cachedItems) return;
    writeHistoryCache(userId, updater(cachedItems));
  }

  function resetHistoryState() {
    stopHistoryAudio();
    state.historyItems = [];
    state.historyUserId = '';
    state.historyLoaded = false;
    state.historyLoading = null;
  }

  function authHeaders(json = false) {
    const session = getSession();
    if (!session?.access_token) throw new Error(t('未登录或会话已过期，请先登录'));
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
      throw new Error(message || t(`请求失败（${response.status}）`));
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
    $('studio-quota-remaining').textContent = formatCompactQuota(remaining);
    badge.title = `剩余 ${remaining.toLocaleString()} / ${daily.toLocaleString()} 点体验配额`;
    badge.style.display = 'inline-flex';
    badge.classList.toggle('warning', remaining >= 500 && remaining < 1500);
    badge.classList.toggle('danger', remaining < 500);
  }

  function formatCompactQuota(value) {
    const number = Number(value || 0);
    if (number >= 1000) {
      const compact = number / 1000;
      return `${compact >= 10 ? compact.toFixed(0) : compact.toFixed(1)}K`;
    }
    return String(number);
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

  const AUDIO_EXTENSIONS = {
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'opus',
    'audio/opus': 'opus',
    'application/ogg': 'opus',
    'audio/l16': 'pcm',
    'application/octet-stream': 'pcm'
  };

  function audioExtension(blob, preferredFormat = '') {
    const normalized = String(preferredFormat || '').toLowerCase();
    if (['pcm', 'wav', 'mp3', 'opus'].includes(normalized)) return normalized;
    return AUDIO_EXTENSIONS[String(blob?.type || '').toLowerCase()] || 'wav';
  }

  function downloadBlob(blob, prefix = 'tts', preferredFormat = '') {
    if (!blob) return;
    const anchor = document.createElement('a');
    anchor.href = makeObjectUrl(blob);
    anchor.download = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.${audioExtension(blob, preferredFormat)}`;
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
        feedbackElement.setAttribute('aria-label', t('Voice ID 已复制'));
        feedbackElement._copyFeedbackTimer = window.setTimeout(() => {
          feedbackElement.classList.remove('copied');
          feedbackElement.setAttribute('aria-label', t('复制 Voice ID'));
        }, 1400);
        return;
      }

      const original = feedbackElement.textContent;
      feedbackElement.textContent = t('已复制');
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
    return model === 'flow_01_ex' ? languageOptionsEx() : languageOptionsTurbo();
  }

  function voiceMatches(voice, query, category) {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = !normalizedQuery || [voice.name, voice.nameEn, voice.id, voice.language, voice.description, voice.scenarios]
      .filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
    if (!matchesQuery) return false;
    if (!category || category === 'all') return true;
    return String(voice.language || '').toLowerCase() === category;
  }

  function languageFilterHtml(model = 'all', expanded = false, activeCategory = 'all', modelMatcher = voiceSupportsModel) {
    const counts = new Map();
    state.voices.forEach((voice) => {
      if (!modelMatcher(voice, model)) return;
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
      `<button class="chip ${normalizedActive === 'all' ? 'on' : ''}" data-category="all" type="button">${t('全部')}</button>`,
      ...visibleItems.map(([code, count]) => `<button class="chip ${normalizedActive === code ? 'on' : ''}" data-category="${escapeHtml(code)}" type="button">${escapeHtml(t(labels[code]?.name || code))} <b>${count}</b></button>`),
      hiddenCount > 0 ? `<button class="chip language-more" data-language-toggle type="button">${expanded ? t('收起') : `+${hiddenCount} ${t('更多语言')}`} <span aria-hidden="true">${expanded ? '⌃' : '⌄'}</span></button>` : ''
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

  function voiceSupportsModel(voice, model) {
    if (!model || model === 'all') return true;
    const models = Array.isArray(voice?.models) && voice.models.length
      ? voice.models
      : [effectiveVoiceModel(voice)];
    return models.includes(model);
  }

  function libraryVoiceSupportsModel(voice, model) {
    return !model || model === 'all' || effectiveVoiceModel(voice) === model;
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
          ${voice.previewUrl ? `<button class="icon-btn preview-voice" type="button" title="${t('试听')}" data-preview-url="${escapeHtml(voice.previewUrl)}">▶</button>` : ''}
          <button class="icon-btn copy-voice" type="button" title="${t('复制 Voice ID')}" aria-label="${t('复制 Voice ID')}">
            <svg class="copy-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="8" y="8" width="11" height="11" rx="2"></rect>
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
            </svg>
            <svg class="copy-check" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 4 4L19 6"></path>
            </svg>
            <span class="copy-feedback" role="status">${t('已复制')}</span>
          </button>
        </span>
      </div>
      <div class="voice-name">${escapeHtml(voiceDisplayName(voice))}</div>
      <div class="voice-badges"><span class="voice-badge">${escapeHtml(voice.language || 'auto')}</span>${isExtended ? '<span class="voice-badge ex">ex</span>' : ''}</div>
      <div class="voice-meta">
        <span class="voice-langs">${escapeHtml(langs)}</span>
        <span class="voice-id">${escapeHtml(voice.id)}</span>
      </div>
      ${library ? `<div class="voice-desc">${escapeHtml(voice.description || voice.scenarios || t('预设音色'))}</div>` : ''}
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
    window.addEventListener('authReady', (event) => {
      if (PAGE === 'history') {
        if (event.detail?.user) loadHistoryPage();
        else {
          resetHistoryState();
          renderHistoryPage();
        }
      }
    });
    window.addEventListener('authStateChanged', (event) => {
      if (PAGE !== 'history') return;
      if (event.detail?.isLoggedIn) loadHistoryPage();
      else {
        const previousUserId = state.historyUserId;
        resetHistoryState();
        if (previousUserId) {
          try { sessionStorage.removeItem(historyCacheKey(previousUserId)); } catch (_) {}
        }
        renderHistoryPage();
      }
    });
    const initialQuota = window.SupabaseAuthInject?.getQuota?.();
    if (initialQuota) updateQuota(initialQuota);
    window.addEventListener('localeChanged', () => {
      if (PAGE === 'tts' || PAGE === 'home') {
        const selectedLanguage = $('studio-language')?.value || '';
        const selectedEmotion = $('studio-emotion')?.value || '';
        setSelectOptions($('studio-language'), availableLanguageOptions(currentStudioModel()));
        setSelectOptions($('studio-emotion'), emotionOptions());
        if ($('studio-language')) $('studio-language').value = selectedLanguage;
        if ($('studio-emotion')) $('studio-emotion').value = selectedEmotion;
        renderStudioLanguageFilters();
        renderStudioVoices();
        setMode(state.mode);
      }
      if (PAGE === 'clone') {
        const selectedLanguage = $('clone-language')?.value || '';
        const selectedEmotion = $('clone-emotion')?.value || '';
        setSelectOptions($('clone-language'), languageOptionsEx());
        setSelectOptions($('clone-emotion'), emotionOptions());
        if ($('clone-language')) $('clone-language').value = selectedLanguage;
        if ($('clone-emotion')) $('clone-emotion').value = selectedEmotion;
        loadClonedVoices();
      }
      if (PAGE === 'voices') {
        $('library-filters').innerHTML = languageFilterHtml(
          state.libraryModel,
          state.languageFiltersExpanded.library,
          state.libraryCategory,
          libraryVoiceSupportsModel
        );
        renderLibrary();
      }
      if (PAGE === 'history') renderHistoryPage();
    });
  }

  function renderStudioVoices() {
    const container = $('studio-voice-list');
    if (!container) return;
    const query = $('studio-voice-search')?.value || '';
    const category = qsa('#studio-voice-cats .chip').find((chip) => chip.classList.contains('on'))?.dataset.category || 'all';
    const model = currentStudioModel();
    const list = state.voices.filter((voice) => {
      return voiceMatches(voice, query, category) && voiceSupportsModel(voice, model);
    });
    container.innerHTML = list.map((voice) => voiceCardHtml(voice, voice.id === state.selectedVoice)).join('') || `<div class="voice-empty">${t('没有匹配的音色')}</div>`;
    const summary = $('studio-model-summary');
    if (summary) summary.textContent = i18n?.getLocale?.() === 'en'
      ? `Current model: ${model || t('自动')} · ${list.length} available voices`
      : `当前模型 ${model || '自动'} · ${list.length} 个可用音色`;
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

  function scrollToStudioVoice(voiceId, behavior = 'smooth') {
    const container = $('studio-voice-list');
    const escapedVoiceId = window.CSS?.escape
      ? window.CSS.escape(voiceId)
      : String(voiceId).replace(/["\\]/g, '\\$&');
    const card = container?.querySelector(`[data-voice-id="${escapedVoiceId}"]`);
    if (!container || !card) return;
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const cardLeft = container.scrollLeft + cardRect.left - containerRect.left;
    const targetLeft = cardLeft - Math.max(0, (container.clientWidth - card.offsetWidth) / 2);
    container.scrollTo({ left: Math.max(0, targetLeft), behavior });
  }

  function setActiveStudioScene(sceneId) {
    qsa('[data-example]').forEach((button) => button.classList.toggle('active', button.dataset.scene === sceneId));
  }

  function applyStudioScene(sceneId, options = {}) {
    const scene = SCENE_PRESETS[sceneId];
    if (!scene) return false;
    const text = $('studio-text');
    state.activeScene = sceneId;
    setActiveStudioScene(sceneId);
    text.value = sceneText(sceneId);
    text.dataset.userEdited = '0';
    text.dataset.i18nUserEdited = '0';
    updateCharCount();

    const voice = state.voiceById.get(scene.voice);
    if (!voice) return false;
    const recommendedModel = effectiveVoiceModel(voice);
    qsa('#studio-model .seg-item').forEach((item) => item.classList.toggle('on', item.dataset.model === recommendedModel));
    updateModelControls();
    chooseStudioVoice(scene.voice, false);
    requestAnimationFrame(() => scrollToStudioVoice(scene.voice, options.behavior || 'smooth'));
    return true;
  }

  function updateCharCount() {
    const text = $('studio-text')?.value || '';
    const max = 1000;
    $('studio-char-count').textContent = `${text.length} / ${max}`;
  }

  function resetStudioVoiceParams() {
    $('studio-speed').value = '1';
    $('studio-volume').value = '1';
    $('studio-pitch').value = '0';
    $('studio-speed-value').textContent = '1.0';
    $('studio-volume-value').textContent = '1.0';
    $('studio-pitch-value').textContent = '0';
  }

  function setMode(mode) {
    state.mode = mode;
    qsa('.ctab').forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
    $('studio-submit-label').textContent = t(mode === 'streaming' ? '流式合成' : '合成语音');
    $('stream-status')?.classList.toggle('hidden', mode !== 'streaming');
    const advanced = $('studio-advanced');
    if (advanced) advanced.classList.toggle('hidden', mode === 'streaming');
    $('studio-cost').textContent = t(mode === 'streaming' ? '本次流式合成将消耗 100 点配额' : '本次合成将消耗 100 点配额');
    updateCharCount();
  }

  function updateModelControls() {
    const model = currentStudioModel();
    const selectedLanguage = $('studio-language')?.value || '';
    setSelectOptions($('studio-language'), availableLanguageOptions(model));
    if (availableLanguageOptions(model).some(([value]) => value === selectedLanguage)) $('studio-language').value = selectedLanguage;
    const supportsEmotion = model === 'flow_01_ex';
    if ($('studio-emotion')) {
      $('studio-emotion').disabled = !supportsEmotion;
      if (!supportsEmotion) $('studio-emotion').value = '';
    }
    $('studio-emotion-hint')?.classList.toggle('hidden', supportsEmotion);
    if ($('studio-voice-search')) $('studio-voice-search').value = '';
    state.languageFiltersExpanded.studio = false;
    const firstAvailable = state.voices.find((voice) => voiceSupportsModel(voice, model));
    if (firstAvailable && !state.voices.some((voice) => voice.id === state.selectedVoice && voiceSupportsModel(voice, model))) state.selectedVoice = firstAvailable.id;
    renderStudioLanguageFilters();
    renderStudioVoices();
  }

  function getStudioRequest() {
    const customVoice = $('studio-custom-voice').value.trim();
    const model = currentStudioModel();
    return {
      text: $('studio-text').value.trim(),
      voiceId: customVoice || state.selectedVoice,
      language: $('studio-language').value,
      model,
      emotion: model === 'flow_01_ex' ? $('studio-emotion').value : '',
      speed: Number($('studio-speed').value),
      volume: Number($('studio-volume').value),
      pitch: Number($('studio-pitch').value),
      format: 'mp3',
      sampleRate: 24000,
      bitrate: 64
    };
  }

  function updateStudioBitrateField() {
    $('studio-bitrate-field')?.classList.remove('hidden');
  }

  function showStudioResult(blob, processingTime, size, firstChunk = null, options = {}) {
    if (state.mode === 'tts') {
      state.ttsAudioBlob = blob;
      state.ttsDownloadBlob = options.downloadBlob || blob;
      state.ttsFormat = options.format || audioExtension(state.ttsDownloadBlob);
    }
    state.streamAudioBlob = state.mode === 'streaming' ? blob : state.streamAudioBlob;
    $('studio-audio').src = makeObjectUrl(blob);
    $('studio-player').classList.add('active');
    $('result-empty')?.classList.add('hidden');
    $('metric-first').textContent = firstChunk == null ? t('仅流式模式') : `${firstChunk}ms`;
    $('metric-time').textContent = `${processingTime}ms`;
    $('metric-size').textContent = `${(size / 1024).toFixed(1)} KB`;
    $('metric-chars').textContent = String($('studio-text').value.length);
    $('studio-download').disabled = false;
    const status = $('studio-result-status');
    if (status) { status.textContent = t('已完成'); status.className = 'status-pill done'; }
  }

  async function synthesizeNormal(request) {
    const started = Date.now();
    const response = await apiFetch('/api/tts/synthesize', {
      method: 'POST', headers: authHeaders(true), body: JSON.stringify(request)
    }, 'response');
    const data = await response.json();
    readQuotaFromResponse(response, data);
    if (!data.audio) throw new Error(t('服务端未返回音频数据'));
    const raw = base64ToArrayBuffer(data.audio);
    const format = data.audioFormat || data.appliedParams?.format || request.format;
    const sampleRate = Number(data.sampleRate || data.appliedParams?.sampleRate || request.sampleRate);
    let playbackBlob;
    let downloadAudio;
    if (format === 'wav') {
      playbackBlob = new Blob([raw], { type: 'audio/wav' });
      downloadAudio = playbackBlob;
    } else if (format === 'mp3') {
      playbackBlob = new Blob([raw], { type: 'audio/mpeg' });
      downloadAudio = playbackBlob;
    } else if (format === 'opus') {
      playbackBlob = new Blob([raw], { type: 'audio/ogg; codecs=opus' });
      downloadAudio = playbackBlob;
    } else {
      playbackBlob = pcmToWav(raw, sampleRate);
      downloadAudio = new Blob([raw], { type: 'application/octet-stream' });
    }
    const elapsed = Date.now() - started;
    showStudioResult(playbackBlob, elapsed, raw.byteLength, null, {
      downloadBlob: downloadAudio,
      format
    });
    await saveHistory('tts', {
      ...request,
      format,
      processingTime: elapsed,
      size: raw.byteLength,
      playbackAudio: playbackBlob
    }, downloadAudio);
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
    $('stream-connection').textContent = t('已连接');
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
          $('stream-connection').textContent = t('已完成');
          await saveHistory('streaming', { ...request, processingTime: elapsed, size: raw.byteLength }, blob);
          return;
        }
      }
    }
    throw new Error(t('流式响应异常结束'));
  }

  async function runStudioSynthesis() {
    clearMessage('studio-message');
    const request = getStudioRequest();
    if (!request.text) return showMessage('studio-message', 'error', t('请输入要合成的文本'));
    if (request.text.length > 1000) return showMessage('studio-message', 'error', t('文本最多支持 1,000 个字符'));
    if (!request.voiceId) return showMessage('studio-message', 'error', t('请选择音色或填写 Voice ID'));
    setLoading('studio', true);
    const status = $('studio-result-status');
    if (status) { status.textContent = t(state.mode === 'streaming' ? '连接中' : '合成中'); status.className = 'status-pill loading'; }
    if (state.mode === 'streaming') {
      $('stream-connection').textContent = t('连接中');
      $('stream-chunks').textContent = '0'; $('stream-first').textContent = '-'; $('stream-size').textContent = '0 KB';
    }
    try {
      if (state.mode === 'streaming') await synthesizeStream(request);
      else await synthesizeNormal(request);
      showMessage('studio-message', 'success', t(state.mode === 'streaming' ? '流式合成完成' : '语音合成完成'));
    } catch (error) {
      showMessage('studio-message', 'error', t(`请求失败：${error.message}`));
      if (state.mode === 'streaming') $('stream-connection').textContent = t('失败');
      if (status) { status.textContent = t('失败'); status.className = 'status-pill failed'; }
    } finally {
      setLoading('studio', false);
    }
  }

  function initTtsPage() {
    const defaultScene = qsa('[data-example].active')[0]?.dataset.scene || '';
    if (defaultScene) {
      state.activeScene = defaultScene;
      $('studio-text').value = sceneText(defaultScene);
      $('studio-text').dataset.userEdited = '0';
      $('studio-text').dataset.i18nUserEdited = '0';
    }
    setSelectOptions($('studio-language'), languageOptionsTurbo());
    setSelectOptions($('studio-emotion'), emotionOptions());
    qsa('.ctab').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
    qsa('#studio-model .seg-item').forEach((button) => button.addEventListener('click', () => {
      qsa('#studio-model .seg-item').forEach((item) => item.classList.remove('on'));
      button.classList.add('on'); updateModelControls();
    }));
    qsa('#studio-format .seg-item').forEach((button) => button.addEventListener('click', () => {
      if (button.disabled) return;
      qsa('#studio-format .seg-item').forEach((item) => item.classList.remove('on'));
      button.classList.add('on');
      updateStudioBitrateField();
    }));
    qsa('[data-example]').forEach((button) => button.addEventListener('click', () => {
      applyStudioScene(button.dataset.scene, { behavior: 'smooth' });
    }));
    $('studio-text').addEventListener('input', () => {
      $('studio-text').dataset.userEdited = '1';
      state.activeScene = '';
      setActiveStudioScene('');
      updateCharCount();
    });
    $('studio-clear').addEventListener('click', () => {
      $('studio-text').value = '';
      $('studio-text').dataset.userEdited = '1';
      state.activeScene = '';
      setActiveStudioScene('');
      $('studio-text').focus();
      updateCharCount();
    });
    $('studio-params-reset').addEventListener('click', resetStudioVoiceParams);
    $('studio-reset').addEventListener('click', () => {
      $('studio-text').value = t('您好，欢迎致电腾讯云智能客服中心。请问有什么可以帮您？');
      $('studio-text').dataset.userEdited = '1';
      $('studio-custom-voice').value = '';
      resetStudioVoiceParams();
      $('studio-language').value = '';
      $('studio-voice-search').value = '';
      qsa('#studio-format .seg-item').forEach((item) => item.classList.toggle('on', item.dataset.format === 'mp3'));
      if ($('studio-sample-rate')) $('studio-sample-rate').value = '24000 Hz';
      if ($('studio-bitrate')) $('studio-bitrate').value = '64 kbps';
      updateStudioBitrateField();
      clearMessage('studio-message');
      $('studio-player').classList.remove('active');
      $('result-empty')?.classList.remove('hidden');
      $('studio-download').disabled = true;
      state.ttsAudioBlob = null;
      state.ttsDownloadBlob = null;
      state.ttsFormat = 'mp3';
      $('studio-result-status').textContent = t('待合成'); $('studio-result-status').className = 'status-pill';
      state.selectedVoice = state.voices[0]?.id || '';
      renderStudioLanguageFilters();
      renderStudioVoices();
      updateCharCount();
    });
    qsa('input[type=range]').forEach((input) => input.addEventListener('input', () => {
      const output = $(`${input.id}-value`); if (output) output.textContent = Number(input.value).toFixed(input.step.includes('.') ? 1 : 0);
    }));
    $('studio-submit').addEventListener('click', runStudioSynthesis);
    $('studio-download').addEventListener('click', () => {
      if (state.mode === 'streaming') downloadBlob(state.streamAudioBlob, state.mode, 'wav');
      else downloadBlob(state.ttsDownloadBlob || state.ttsAudioBlob, state.mode, state.ttsFormat);
    });
    $('studio-text').addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); runStudioSynthesis(); }
    });
    $('studio-voice-search').addEventListener('input', renderStudioVoices);
    bindVoiceCards($('studio-voice-list'), (voiceId) => chooseStudioVoice(voiceId));
    loadVoices(true).then(() => {
      const params = new URLSearchParams(location.search);
      const urlSceneId = params.get('scene');
      const hasUrlScene = Boolean(urlSceneId && SCENE_PRESETS[urlSceneId]);
      const canUseDefaultScene = !hasUrlScene && !params.get('voice') && !params.get('text');
      const sceneId = hasUrlScene ? urlSceneId : (canUseDefaultScene ? defaultScene : '');
      if (sceneId) {
        applyStudioScene(sceneId, { behavior: 'auto' });
      } else if (params.get('voice') && state.voiceById.has(params.get('voice'))) {
        state.selectedVoice = params.get('voice');
      }
      if (!sceneId && params.get('model')) {
        qsa('#studio-model .seg-item').forEach((item) => item.classList.toggle('on', item.dataset.model === params.get('model')));
      }
      if (!sceneId) updateModelControls();
      if (params.get('language') && availableLanguageOptions(currentStudioModel()).some(([value]) => value === params.get('language'))) {
        $('studio-language').value = params.get('language');
      }
      chooseStudioVoice(state.selectedVoice, false);
      requestAnimationFrame(() => scrollToStudioVoice(state.selectedVoice, 'auto'));
    }).catch((error) => showMessage('studio-message', 'error', t(`音色加载失败：${error.message}`)));
    window.addEventListener('localeChanged', () => {
      if (state.activeScene && $('studio-text').dataset.userEdited !== '1') {
        $('studio-text').value = sceneText(state.activeScene);
        updateCharCount();
      }
      renderStudioVoices();
      requestAnimationFrame(() => scrollToStudioVoice(state.selectedVoice, 'auto'));
    });
    updateCharCount(); updateModelControls(); updateStudioBitrateField(); setMode(new URLSearchParams(location.search).get('mode') === 'streaming' ? 'streaming' : 'tts');
  }

  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function audioPayload(blob, format = '') {
    if (!blob) return null;
    return {
      data: await blobToBase64(blob),
      mimeType: blob.type || 'application/octet-stream',
      format: format || audioExtension(blob)
    };
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
    hint.textContent = t(valid || !input.value.trim() ? '仅限数字、英文字母和下划线，最多 36 位' : '名称格式不正确，请仅使用数字、字母和下划线');
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
      info.textContent = t('支持 WAV、MP3、M4A 等浏览器可解码的音频格式');
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
    info.textContent = i18n?.getLocale?.() === 'en'
      ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB · Will be converted to 16 kHz mono WAV`
      : `${file.name} · ${(file.size / 1024).toFixed(1)} KB · 将转换为 16kHz 单声道 WAV`;
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
    $('record-status').textContent = t('点击开始录音');
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
        $('record-button').classList.remove('recording'); $('record-status').textContent = t('录音完成');
        $('record-reset').disabled = false;
      };
      state.recordingStartedAt = Date.now(); state.recorder.start(); $('record-button').classList.add('recording'); $('record-status').textContent = t('录音中，再次点击停止');
      state.recordTimer = setInterval(() => {
        const seconds = (Date.now() - state.recordingStartedAt) / 1000;
        $('record-time').textContent = `${seconds.toFixed(1)}s`; $('record-progress').style.width = `${Math.min(seconds / 30 * 100, 100)}%`;
        if (seconds >= 30) state.recorder.stop();
      }, 100);
    } catch (error) { showMessage('clone-message', 'error', t(`无法开始录音：${error.message}`)); }
  }

  async function createClone() {
    clearMessage('clone-message');
    const name = $('clone-name').value.trim();
    if (!name || !validateCloneName()) return showMessage('clone-message', 'error', t('请输入合法的音色名称'));
    const source = state.recordedBlob || $('clone-file').files[0];
    if (!source) return showMessage('clone-message', 'error', t('请上传音频或先完成录音'));
    setLoading('clone', true);
    try {
      showMessage('clone-message', 'info', t('正在转换并检查音频...'));
      const processed = await processAudioForCloning(source);
      if (processed.duration < 6 || processed.duration > 30) throw new Error(t(`音频时长为 ${processed.duration.toFixed(1)} 秒，请使用 6–30 秒音频`));
      const response = await apiFetch('/api/voice/clone', {
        method: 'POST', headers: authHeaders(true), body: JSON.stringify({
          voiceName: name, audioData: await blobToBase64(processed.blob), audioDuration: processed.duration,
          model: $('clone-model').value || undefined
        })
      }, 'response');
      const data = await response.json(); readQuotaFromResponse(response, data);
      state.clonedVoiceId = data.voiceId || ''; $('clone-use-voice-id').value = state.clonedVoiceId;
      showMessage('clone-message', 'success', t(`克隆成功，Voice ID：${state.clonedVoiceId}`));
      await saveHistory('clone-create', { voiceId: state.clonedVoiceId, voiceName: name, processingTime: 0, size: processed.blob.size }, null);
      await loadClonedVoices();
    } catch (error) { showMessage('clone-message', 'error', t(`克隆失败：${error.message}`)); }
    finally { setLoading('clone', false); }
  }

  async function loadClonedVoices() {
    const list = $('cloned-voice-list');
    if (!list) return;
    if (!getSession()?.access_token) {
      if (!window.SupabaseAuthInject?.getState?.()?.resolved) {
        list.innerHTML = `<div class="empty-state">${t('正在恢复登录状态...')}</div>`;
        return;
      }
      list.innerHTML = `<div class="empty-state">${t('登录后可查看已保存音色')}</div>`;
      return;
    }
    try {
      const data = await apiFetch('/api/voice/list', { headers: authHeaders() });
      state.clonedVoices = data.voices || [];
      list.innerHTML = state.clonedVoices.length ? state.clonedVoices.map((voice) => `<div class="list-row">
        <div class="list-main"><div class="list-name">${escapeHtml(voice.voice_name || t('未命名'))} <span class="status-pill done">${t('可用')}</span></div><div class="clone-voice-meta-row"><div class="list-id">${escapeHtml(voice.voice_id)}</div><div class="list-meta">${voice.created_at ? formatDateTime(voice.created_at) : ''}${voice.audio_duration ? ` · ${Number(voice.audio_duration).toFixed(1)}s` : ''}</div></div></div>
        <div class="row-actions"><button class="small-button use-clone" data-voice-id="${escapeHtml(voice.voice_id)}">${t('使用')}</button><button class="small-button copy-clone" data-voice-id="${escapeHtml(voice.voice_id)}">${t('复制')}</button><button class="small-button danger delete-clone" data-voice-id="${escapeHtml(voice.voice_id)}">${t('删除')}</button></div>
      </div>`).join('') : `<div class="empty-state">${t('暂无克隆音色')}</div>`;
    } catch (error) { list.innerHTML = `<div class="empty-state">${escapeHtml(t(`加载失败：${error.message}`))}</div>`; }
  }

  async function deleteClone(voiceId) {
    if (!confirm(t('确认删除这个克隆音色吗？'))) return;
    try { await apiFetch(`/api/voice/${encodeURIComponent(voiceId)}`, { method: 'DELETE', headers: authHeaders() }); await loadClonedVoices(); }
    catch (error) { showMessage('clone-message', 'error', t(`删除失败：${error.message}`)); }
  }

  async function synthesizeClone() {
    clearMessage('clone-synth-message');
    const request = {
      text: $('clone-text').value.trim(), voiceId: $('clone-use-voice-id').value.trim() || state.clonedVoiceId,
      language: $('clone-language').value, model: $('clone-synth-model').value,
      emotion: $('clone-synth-model').value === 'flow_01_ex' ? $('clone-emotion').value : '',
      format: 'pcm', sampleRate: 24000, speed: 1, volume: 1, pitch: 0, billingContext: 'clone-audition'
    };
    if (!request.text || !request.voiceId) return showMessage('clone-synth-message', 'error', t('请填写文本并选择 Voice ID'));
    setLoading('clone-synth', true);
    try {
      const started = Date.now();
      const response = await apiFetch('/api/tts/synthesize', { method: 'POST', headers: authHeaders(true), body: JSON.stringify(request) }, 'response');
      const data = await response.json(); readQuotaFromResponse(response, data);
      const raw = base64ToArrayBuffer(data.audio); const blob = pcmToWav(raw, 24000); const elapsed = Date.now() - started;
      state.cloneAudioBlob = blob; $('clone-audio').src = makeObjectUrl(blob); $('clone-player').classList.add('active');
      $('clone-time').textContent = `${elapsed}ms`; $('clone-size').textContent = `${(raw.byteLength / 1024).toFixed(1)} KB`;
      await saveHistory('clone-tts', { ...request, processingTime: elapsed, size: raw.byteLength }, blob);
      showMessage('clone-synth-message', 'success', t('克隆音色合成完成'));
    } catch (error) { showMessage('clone-synth-message', 'error', t(`合成失败：${error.message}`)); }
    finally { setLoading('clone-synth', false); }
  }

  function initClonePage() {
    setSelectOptions($('clone-language'), languageOptionsEx()); setSelectOptions($('clone-emotion'), emotionOptions());
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
    window.addEventListener('authReady', loadClonedVoices);
    loadClonedVoices();
  }

  function renderLibrary() {
    const grid = $('library-grid'); if (!grid) return;
    const query = $('library-search').value; const category = state.libraryCategory;
    const list = state.voices.filter((voice) => voiceMatches(voice, query, category)
      && libraryVoiceSupportsModel(voice, state.libraryModel));
    $('library-count').textContent = i18n?.getLocale?.() === 'en' ? `${list.length} voices` : `${list.length} 个音色`;
    grid.innerHTML = list.map((voice) => voiceCardHtml(voice, false, true)).join('') || `<div class="empty-state">${t('没有匹配的音色')}</div>`;
  }

  function initVoicesPage() {
    $('library-search').addEventListener('input', renderLibrary);
    $('library-model').addEventListener('change', () => {
      state.libraryModel = $('library-model').value;
      state.libraryCategory = 'all';
      state.languageFiltersExpanded.library = false;
      $('library-filters').innerHTML = languageFilterHtml(
        state.libraryModel,
        false,
        'all',
        libraryVoiceSupportsModel
      );
      renderLibrary();
    });
    bindFilterChips($('library-filters'), (category) => {
      state.libraryCategory = category;
      renderLibrary();
    }, () => {
      state.languageFiltersExpanded.library = !state.languageFiltersExpanded.library;
      $('library-filters').innerHTML = languageFilterHtml(
        state.libraryModel,
        state.languageFiltersExpanded.library,
        state.libraryCategory,
        libraryVoiceSupportsModel
      );
    });
    bindVoiceCards($('library-grid'), (voiceId) => {
      const voice = state.voiceById.get(voiceId);
      const model = state.libraryModel === 'all' ? effectiveVoiceModel(voice) : state.libraryModel;
      location.href = `tts.html?voice=${encodeURIComponent(voiceId)}&model=${encodeURIComponent(model)}`;
    });
    loadVoices(true).then(() => {
      $('library-filters').innerHTML = languageFilterHtml('all', false, 'all', libraryVoiceSupportsModel);
      renderLibrary();
    }).catch((error) => { $('library-grid').innerHTML = `<div class="empty-state">${escapeHtml(t(`音色加载失败：${error.message}`))}</div>`; });
  }

  async function saveHistory(type, meta, audio) {
    if (!getSession()?.access_token) return;
    const format = meta.format || audioExtension(audio);
    try {
      const data = await apiFetch('/api/history', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          type,
          text: meta.text || '',
          voiceName: meta.voiceName || '',
          voiceId: meta.voiceId || '',
          language: meta.language || '',
          model: meta.model || '',
          processingTime: meta.processingTime || 0,
          sampleRate: meta.sampleRate || 24000,
          bitrate: meta.bitrate || 0,
          format,
          size: meta.size || audio?.size || 0,
          audio: await audioPayload(audio, format),
          playbackAudio: meta.playbackAudio && meta.playbackAudio !== audio
            ? await audioPayload(meta.playbackAudio, audioExtension(meta.playbackAudio))
            : null
        })
      });
      const userId = getSession()?.user?.id;
      if (userId && data.item) {
        updateHistoryCache(userId, (items) => [data.item, ...items.filter((item) => item.id !== data.item.id)]);
      }
    } catch (error) {
      console.warn('[History] Failed to save cloud history:', error);
    }
  }

  async function getHistoryItems(userId) {
    const data = await apiFetch('/api/history', { headers: authHeaders() });
    if (getSession()?.user?.id !== userId) return [];
    state.historyItems = data.items || [];
    state.historyUserId = userId;
    state.historyLoaded = true;
    writeHistoryCache(userId, state.historyItems);
    return state.historyItems;
  }

  function renderHistoryPage() {
    const list = $('history-list'); if (!list) return;
    const session = getSession();
    const clearButton = $('history-clear');
    if (!session?.access_token) {
      list.innerHTML = `<div class="empty-state">${t('登录后可查看账号历史记录')}</div>`;
      if (clearButton) clearButton.disabled = true;
      return;
    }
    if (!state.historyLoaded || state.historyUserId !== session.user?.id) {
      list.innerHTML = `<div class="empty-state">${t('正在读取云端历史...')}</div>`;
      if (clearButton) clearButton.disabled = true;
      return;
    }
    const all = state.historyItems;
    if (clearButton) clearButton.disabled = !all.length;
    const items = state.historyFilter === 'all' ? all : all.filter((item) => state.historyFilter === 'cloning' ? item.type.startsWith('clone') : item.type === state.historyFilter);
    if (!items.length) { list.innerHTML = `<div class="empty-state">${t('暂无历史记录。完成文本转语音、流式合成、克隆音色或克隆试听后会自动保存在这里。')}</div>`; return; }
    list.innerHTML = items.map((item) => {
      const url = item.audioUrl || ''; const label = item.type === 'tts' ? 'Text-to-Speech' : item.type === 'streaming' ? 'Streaming' : item.type === 'clone-create' ? 'Cloned Voice' : 'Cloning';
      const title = item.type === 'clone-create' ? item.voiceName || item.voiceId : item.text || '';
      return `<div class="history-row"><div class="history-main"><div class="history-title">${escapeHtml(title)}</div><div class="history-meta">${escapeHtml(item.voiceId || '')} · ${item.type === 'clone-create' ? 'Cloning' : label} · ${formatDateTime(item.createdAt)}</div></div>${url ? `<button class="history-audio-button" type="button" data-id="${item.id}" data-audio-url="${escapeHtml(url)}" data-state="idle" title="${t('播放音频')}" aria-label="${t('播放音频')}"><svg class="history-audio-play" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5z"/></svg><svg class="history-audio-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7v10M15 7v10"/></svg><span class="history-audio-loading" aria-hidden="true"></span></button>` : ''}<div class="row-actions">${item.type !== 'clone-create' ? `<button class="small-button history-reuse" data-id="${item.id}">${t('复用')}</button>` : ''}${item.downloadUrl ? `<button class="small-button history-download" data-id="${item.id}">${t('下载')}</button>` : ''}<button class="small-button danger history-delete" data-id="${item.id}">${t('删除')}</button></div></div>`;
    }).join('');
    updateHistoryAudioButtons();
  }

  function updateHistoryAudioButtons() {
    qsa('.history-audio-button').forEach((button) => {
      const isActive = button.dataset.id === state.historyAudioItemId;
      const status = isActive ? state.historyAudioStatus : 'idle';
      const label = status === 'playing' ? t('暂停音频') : status === 'loading' ? t('正在加载音频') : t('播放音频');
      button.dataset.state = status;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-busy', String(status === 'loading'));
    });
  }

  function setHistoryAudioStatus(status) {
    state.historyAudioStatus = status;
    updateHistoryAudioButtons();
  }

  function stopHistoryAudio(itemId = '') {
    if (itemId && state.historyAudioItemId !== itemId) return;
    const audio = state.historyAudio;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    state.historyAudioItemId = '';
    state.historyAudioStatus = 'idle';
    updateHistoryAudioButtons();
  }

  function toggleHistoryAudio(button) {
    const itemId = button.dataset.id;
    const url = button.dataset.audioUrl;
    if (!itemId || !url) return;

    if (state.historyAudioItemId === itemId) {
      if (state.historyAudioStatus === 'loading') return;
      if (state.historyAudioStatus === 'playing') {
        state.historyAudio.pause();
        return;
      }
      setHistoryAudioStatus('loading');
      state.historyAudio.play().catch(() => setHistoryAudioStatus('idle'));
      return;
    }

    state.historyAudio.pause();
    state.historyAudioItemId = itemId;
    setHistoryAudioStatus('loading');
    state.historyAudio.src = url;
    state.historyAudio.play().catch(() => {
      if (state.historyAudioItemId === itemId) setHistoryAudioStatus('idle');
    });
  }

  function bindHistoryAudio() {
    const audio = state.historyAudio;
    audio.addEventListener('loadstart', () => {
      if (state.historyAudioItemId) setHistoryAudioStatus('loading');
    });
    audio.addEventListener('waiting', () => {
      if (state.historyAudioItemId) setHistoryAudioStatus('loading');
    });
    audio.addEventListener('playing', () => setHistoryAudioStatus('playing'));
    audio.addEventListener('pause', () => {
      if (state.historyAudioItemId && !audio.ended && state.historyAudioStatus !== 'loading') setHistoryAudioStatus('paused');
    });
    audio.addEventListener('ended', () => {
      audio.currentTime = 0;
      setHistoryAudioStatus('idle');
    });
    audio.addEventListener('error', () => {
      if (state.historyAudioItemId) setHistoryAudioStatus('idle');
    });
  }

  async function loadHistoryPage({ force = false } = {}) {
    const list = $('history-list'); if (!list) return;
    const session = getSession();
    const userId = session?.user?.id;
    if (!session?.access_token || !userId) {
      if (!window.SupabaseAuthInject?.getState?.()?.resolved) {
        list.innerHTML = `<div class="empty-state">${t('正在恢复登录状态...')}</div>`;
        if ($('history-clear')) $('history-clear').disabled = true;
        return;
      }
      resetHistoryState();
      renderHistoryPage();
      return;
    }

    if (state.historyUserId !== userId) {
      state.historyItems = [];
      state.historyUserId = userId;
      state.historyLoaded = false;
      state.historyLoading = null;
    }

    if (!force && state.historyLoaded) {
      renderHistoryPage();
      return;
    }

    if (!force) {
      const cachedItems = readHistoryCache(userId);
      if (cachedItems) {
        state.historyItems = cachedItems;
        state.historyLoaded = true;
        renderHistoryPage();
        return;
      }
    }

    if (state.historyLoading) {
      await state.historyLoading;
      renderHistoryPage();
      return;
    }

    renderHistoryPage();
    const request = getHistoryItems(userId);
    state.historyLoading = request;
    try {
      await request;
      renderHistoryPage();
    } catch (error) {
      if (getSession()?.user?.id === userId) {
        list.innerHTML = `<div class="empty-state">${escapeHtml(t(`历史记录加载失败：${error.message}`))}</div>`;
        if ($('history-clear')) $('history-clear').disabled = true;
      }
    } finally {
      if (state.historyLoading === request) state.historyLoading = null;
    }
  }

  function getHistoryItem(id) {
    return state.historyItems.find((item) => item.id === id) || null;
  }

  async function deleteHistory(id) {
    try {
      await apiFetch(`/api/history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      stopHistoryAudio(id);
      state.historyItems = state.historyItems.filter((item) => item.id !== id);
      writeHistoryCache(state.historyUserId, state.historyItems);
      renderHistoryPage();
    } catch (error) {
      alert(t(`删除失败：${error.message}`));
    }
  }

  async function clearHistory() {
    if (!confirm(t('确认清空全部历史记录吗？'))) return;
    try {
      await apiFetch('/api/history', { method: 'DELETE', headers: authHeaders() });
      stopHistoryAudio();
      state.historyItems = [];
      state.historyLoaded = true;
      writeHistoryCache(state.historyUserId, state.historyItems);
      renderHistoryPage();
    } catch (error) {
      alert(t(`清空失败：${error.message}`));
    }
  }

  async function reuseHistory(id) {
    const item = getHistoryItem(id); if (!item) return;
    const params = new URLSearchParams({ text: item.text || '', voice: item.voiceId || '', mode: item.type === 'streaming' ? 'streaming' : 'tts' });
    if (item.type === 'clone-tts' || item.type === 'clone-create') location.href = `voice-clone.html?text=${encodeURIComponent(item.text || '')}&voice=${encodeURIComponent(item.voiceId || '')}`;
    else location.href = `tts.html?${params.toString()}`;
  }

  async function downloadHistory(id, button) {
    const item = getHistoryItem(id);
    if (!item?.downloadUrl) return;
    button.disabled = true;
    try {
      const data = await apiFetch(`/api/history/${encodeURIComponent(id)}/download`, {
        headers: authHeaders()
      });
      if (!data.url) throw new Error(t('服务端未返回下载地址'));
      const anchor = document.createElement('a');
      anchor.href = data.url;
      anchor.download = data.filename || '';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      alert(t(`下载失败：${error.message}`));
    } finally {
      button.disabled = false;
    }
  }

  async function initHistoryPage() {
    bindHistoryAudio();
    qsa('.history-filter').forEach((button) => button.addEventListener('click', () => {
      state.historyFilter = button.dataset.filter; qsa('.history-filter').forEach((item) => item.classList.remove('on')); button.classList.add('on'); renderHistoryPage();
    }));
    $('history-clear').addEventListener('click', clearHistory);
    $('history-list').addEventListener('click', async (event) => {
      const button = event.target.closest('button'); if (!button) return; const id = button.dataset.id;
      if (button.classList.contains('history-audio-button')) {
        toggleHistoryAudio(button);
        return;
      }
      if (button.classList.contains('history-reuse')) reuseHistory(id);
      if (button.classList.contains('history-delete')) deleteHistory(id);
      if (button.classList.contains('history-download')) {
        await downloadHistory(id, button);
      }
    });
    loadHistoryPage();
  }

  function applyUrlState() {
    const params = new URLSearchParams(location.search);
    if (PAGE === 'tts' || PAGE === 'home') {
      const hasScene = Boolean(params.get('scene') && SCENE_PRESETS[params.get('scene')]);
      if (!hasScene && params.get('text')) { $('studio-text').value = params.get('text'); $('studio-text').dataset.userEdited = '1'; }
      if (!hasScene && params.get('voice')) { $('studio-custom-voice').value = params.get('voice'); state.selectedVoice = params.get('voice'); }
      updateCharCount();
    }
    if (PAGE === 'clone') {
      if (params.get('text')) $('clone-text').value = params.get('text');
      if (params.get('voice')) { $('clone-use-voice-id').value = params.get('voice'); state.clonedVoiceId = params.get('voice'); }
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initShell();
    if (PAGE === 'home' || PAGE === 'tts') initTtsPage();
    if (PAGE === 'clone') initClonePage();
    if (PAGE === 'voices') initVoicesPage();
    if (PAGE === 'history') initHistoryPage();
    applyUrlState();
  });

  window.addEventListener('beforeunload', () => {
    state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.mediaStream?.getTracks().forEach((track) => track.stop());
  });
})();
