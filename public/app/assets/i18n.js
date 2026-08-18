(() => {
  'use strict';

  const STORAGE_KEY = 'tts_locale';
  const DEFAULT_LOCALE = 'zh-CN';
  const SUPPORTED_LOCALES = ['zh-CN', 'en'];

  const EN = {
    'TTS Studio': 'TTS Studio',
    '首页': 'Home',
    '文本转语音': 'Text-to-Speech',
    '流式合成': 'Streaming',
    '声音克隆': 'Voice Cloning',
    '音色库': 'Voice Library',
    '历史记录': 'History',
    '体验额度': 'Trial credits',
    '剩余体验配额': 'Remaining credits',
    '可用额度': 'Available credits',
    '点可用': 'available',
    '已使用': 'Used',
    '点': 'credits',
    '额度使用进度': 'Credit usage',
    '界面语言': 'Interface language',
    '切换界面语言': 'Switch interface language',
    '切换主题': 'Toggle theme',
    '折叠侧栏': 'Collapse sidebar',
    '中文': '中文',

    '自然、低延迟、可克隆的语音工作台': 'Natural, low-latency, cloneable voice studio',
    '无需代码即可体验文本转语音、SSE 流式合成和声音克隆。选择场景，马上听见效果。': 'Try text-to-speech, SSE streaming, and voice cloning without writing code. Pick a scenario and hear the result instantly.',
    '个模型': 'models',
    '个可用音色': 'available voices',
    '声音克隆': 'voice cloning',
    '场景示例': 'Scenario examples',
    '课堂教育': 'Education',
    '客服场景': 'Customer service',
    '游戏': 'Gaming',
    '有声书': 'Audiobook',
    '同学们，今天我们来认识声音是怎样产生的。请把手轻轻放在喉咙上，读出一个长音，感受声带的振动。': 'Today, we are going to learn how sound is produced. Place your hand gently on your throat, hold a long note, and feel your vocal cords vibrate.',
    '您好，欢迎致电腾讯云智能客服中心。请问有什么可以帮您？': 'Hello, and welcome to Tencent Cloud Intelligent Customer Service. How may I help you?',
    '勇者，前方的迷雾森林危机四伏。握紧你的武器，真正的冒险现在才刚刚开始。': 'Hero, the misty forest ahead is filled with danger. Grip your weapon tightly—the real adventure is only beginning.',
    '夜色渐深，他站在旧城墙下，想起了那封迟到了十年的信。': 'As night deepened, he stood beneath the old city wall and remembered the letter that had arrived ten years too late.',
    '情绪与停顿由模型自动处理': 'Emotion and pauses are handled automatically',
    '模型': 'Model',
    '语言': 'Language',
    '推荐音色': 'Recommended voice',
    '自动检测': 'Auto-detect',
    '自动': 'Auto',
    '温柔女老师': 'Wenrou · Soft Female Teacher',
    '客服小美': 'Xiaomei · Customer Service',
    '深沉男评析': 'Shenchen · Resonant Male Narrator',
    '清晰女旁白': 'Qingxi · Clear Female Narrator',
    '温柔姐姐': 'Gentle Female Voice',
    '自然男声': 'Natural Male Voice',
    '带入体验台': 'Open in studio',
    '先浏览音色': 'Browse voices first',
    'SSE 流式合成': 'SSE streaming synthesis',
    '实时查看连接状态、已接收分块、首包时间和总大小；完成后可播放、下载并自动写入历史记录。': 'Monitor connection status, received chunks, time to first chunk, and total size in real time. Play, download, and save the result to history when complete.',
    '开始流式体验 · 消耗 100 点': 'Start streaming · Costs 100 credits',
    '6–180 秒，即刻克隆音色': 'Clone a voice from 6–180 seconds of audio',
    '上传清晰人声或直接在线录音。系统会转换为 16kHz 单声道 WAV，克隆完成即可用于语音合成。': 'Upload clear speech or record it online. Audio is converted to 16 kHz mono WAV and can be used for synthesis as soon as cloning is complete.',
    '上传 / 录音': 'Upload / Record',
    '创建音色': 'Create voice',
    '合成试听': 'Synthesize & preview',
    '开始克隆 · 消耗 50 点': 'Start cloning · Costs 50 credits',
    '从体验到接入，一条完整链路': 'A complete path from trial to integration',
    '所有成功合成和克隆试听都会保存在本机历史记录中，便于对比音色与复用配置。': 'Successful synthesis and clone previews are saved in local history, making it easy to compare voices and reuse settings.',
    '双模型、场景预设、音色筛选与基础参数调节。': 'Two models, scenario presets, voice filters, and core parameter controls.',
    '进入体验 →': 'Open studio →',
    '创建、管理并立即应用自己的专属 Voice ID。': 'Create, manage, and immediately use your own Voice ID.',
    '创建音色 →': 'Create voice →',
    '精品音色库': 'Curated voice library',
    '搜索、筛选并复制后端真实可用音色。': 'Search, filter, and copy voices available from the backend.',
    '浏览音色 →': 'Browse voices →',
    '播放、下载、复用与管理本次浏览器中的体验结果。': 'Play, download, reuse, and manage results stored in this browser.',
    '查看记录 →': 'View history →',

    '文本转语音 · TTS Studio': 'Text-to-Speech · TTS Studio',
    '输入文本，合成自然语音': 'Turn text into natural speech',
    '支持非流式与流式（SSE）两种模式、双模型与多语言精选音色。': 'Supports standard and SSE streaming modes, two models, and curated multilingual voices.',
    '示例': 'Examples',
    '清空': 'Clear',
    '音色选择': 'Choose a voice',
    '搜索音色 / Voice ID': 'Search voices / Voice ID',
    '全部': 'All',
    '收起': 'Collapse',
    '更多语言': 'more languages',
    '自定义 Voice ID（可选）': 'Custom Voice ID (optional)',
    '覆盖上方已选音色': 'Override the selected voice above',
    '情感风格': 'Emotion',
    '仅 flow_01_ex 支持情感风格': 'Emotion styles are available only with flow_01_ex',
    '语速': 'Speed',
    '音量': 'Volume',
    '音高': 'Pitch',
    '声音参数': 'Voice parameters',
    '重置': 'Reset',
    '高级设置（格式 / 采样率 / 比特率）': 'Advanced settings (format / sample rate / bitrate)',
    '音频格式': 'Audio format',
    '采样率': 'Sample rate',
    '比特率': 'Bitrate',
    '仅 MP3 生效': 'MP3 only',
    '当前后端未支持': 'Not supported by the current backend',
    '参考原型中的待接能力': 'Capabilities pending backend support',
    '本次合成将消耗 100 点配额': 'This synthesis will cost 100 credits',
    '本次流式合成将消耗 100 点配额': 'This streaming synthesis will cost 100 credits',
    '⌘ / Ctrl + Enter 快速合成': '⌘ / Ctrl + Enter to synthesize',
    '合成语音': 'Synthesize',
    '重置全部': 'Reset all',
    '正在请求语音服务...': 'Requesting the speech service...',
    '合成结果': 'Synthesis result',
    '待合成': 'Not started',
    '连接中': 'Connecting',
    '合成中': 'Synthesizing',
    '已完成': 'Completed',
    '失败': 'Failed',
    '下载音频': 'Download audio',
    '未连接': 'Disconnected',
    '已连接': 'Connected',
    '完成一次合成后，可在这里播放和下载真实音频。': 'After a synthesis completes, you can play and download the audio here.',
    '首包时间': 'Time to first chunk',
    '仅流式模式': 'Streaming only',
    '处理耗时': 'Processing time',
    '文件大小': 'File size',
    '文本字符': 'Text characters',
    '没有匹配的音色': 'No matching voices',
    '未命名音色': 'Unnamed voice',
    '预设音色': 'Preset voice',
    '试听': 'Preview',
    '复制 Voice ID': 'Copy Voice ID',
    'Voice ID 已复制': 'Voice ID copied',
    '已复制': 'Copied',
    '未登录或会话已过期，请先登录': 'Not signed in or session expired. Please sign in first.',
    '服务端未返回音频数据': 'The server did not return audio data.',
    '服务端未返回下载地址': 'The server did not return a download URL.',
    '流式响应异常结束': 'The streaming response ended unexpectedly.',
    '请输入要合成的文本': 'Enter text to synthesize.',
    '文本最多支持 1,000 个字符': 'Text is limited to 1,000 characters.',
    '请选择音色或填写 Voice ID': 'Select a voice or enter a Voice ID.',
    '流式合成完成': 'Streaming synthesis completed.',
    '语音合成完成': 'Speech synthesis completed.',
    '请输入合法的音色名称': 'Enter a valid voice name.',
    '请上传音频或先完成录音': 'Upload audio or finish a recording first.',
    '正在转换并检查音频...': 'Converting and validating audio...',
    '确认删除这个克隆音色吗？': 'Delete this cloned voice?',
    '请填写文本并选择 Voice ID': 'Enter text and select a Voice ID.',
    '克隆音色合成完成': 'Cloned-voice synthesis completed.',
    '暂无历史记录。完成文本转语音、流式合成、克隆音色或克隆试听后会自动保存在这里。': 'No history yet. Text-to-speech, streaming, cloned voices, and clone previews are saved here automatically.',
    '确认清空全部历史记录吗？': 'Clear all history?',
    '无（默认）': 'None (default)',
    '高兴': 'Happy',
    '悲伤': 'Sad',
    '愤怒': 'Angry',
    '恐惧': 'Fearful',
    '厌恶': 'Disgusted',
    '惊讶': 'Surprised',
    '平静': 'Calm',
    '流畅': 'Fluent',
    '低语': 'Whisper',

    '声音克隆 · TTS Studio': 'Voice Cloning · TTS Studio',
    '声音克隆': 'Voice cloning',
    '6-180秒参考音频即可复刻音色。限时免费，生成后即可用于合成': 'Clone a voice from 6–180 seconds of reference audio. Ready to use immediately.',
    '创建克隆音色': 'Create a cloned voice',
    '音色名称': 'Voice name',
    '仅限数字、英文字母和下划线，最多 36 位': 'Use up to 36 letters, numbers, or underscores',
    '名称格式不正确，请仅使用数字、字母和下划线': 'Invalid name. Use letters, numbers, and underscores only',
    '上传音频': 'Upload audio',
    '在线录音': 'Record online',
    '点击或拖拽上传音频': 'Click or drag audio here',
    '支持 WAV、MP3、M4A 等浏览器可解码的音频格式': 'Supports WAV, MP3, M4A, and other browser-decodable audio formats',
    '需为本人或已获授权声音，可随时请求删除': 'Use your own or an authorized voice; deletion can be requested at any time',
    '开始或停止录音': 'Start or stop recording',
    '点击开始录音': 'Click to start recording',
    '录音中，再次点击停止': 'Recording—click again to stop',
    '录音完成': 'Recording complete',
    '重新录音': 'Record again',
    '提交即表示您确认该声音属于本人或已获得合法授权，并知悉可随时请求删除。': 'By submitting, you confirm that the voice is yours or that you have legal authorization, and acknowledge that you may request deletion at any time.',
    '本次克隆将消耗 50 点配额': 'This clone will cost 50 credits',
    '音频要求：6–180 秒': 'Audio requirement: 6–180 seconds',
    '开始克隆': 'Start cloning',
    '正在转换音频并提交克隆...': 'Converting audio and submitting the clone...',
    '正在安全上传参考音频...': 'Securely uploading the reference audio...',
    '上传服务尚未就绪，请刷新页面后重试': 'The upload service is not ready. Refresh the page and try again.',
    '已保存的音色': 'Saved voices',
    '-- 个': '--',
    '正在加载...': 'Loading...',
    '合成并应用': 'Synthesize and apply',
    '从左侧选择，或手动填写': 'Select on the left or enter manually',
    '从上方选择，或手动填写': 'Select above or enter manually',
    '欢迎使用 TRTC-AI。您刚才克隆的声音，现在可以用来读出这段话了。': 'Welcome to TRTC-AI. The voice you just cloned can now read this message aloud.',
    '发音语言': 'Spoken language',
    '本次合成将消耗 50 点配额': 'This synthesis will cost 50 credits',
    '试听将计入声音克隆历史': 'This preview will be saved to voice-cloning history',
    '合成并试听': 'Synthesize and preview',
    '正在合成...': 'Synthesizing...',
    '下载 WAV': 'Download WAV',
    '可用': 'Available',
    '使用': 'Use',
    '复制': 'Copy',
    '删除': 'Delete',
    '未命名': 'Unnamed',
    '暂无克隆音色': 'No cloned voices yet',
    '登录后可查看已保存音色': 'Sign in to view saved voices',

    '音色库 · TTS Studio': 'Voice Library · TTS Studio',
    '精品音色，开箱即用': 'Curated voices, ready to use',
    '可用音色随模型能力变化。搜索、筛选、复制 Voice ID，点击卡片即可带入文本转语音。': 'Available voices vary by model. Search, filter, and copy a Voice ID, or click a card to open it in Text-to-Speech.',
    '全部可用音色': 'All available voices',
    '全部模型': 'All models',
    '正在加载音色...': 'Loading voices...',
    'flow_02_turbo 提供 101 个精选音色；flow_01_ex 提供 327 个音色。': 'flow_02_turbo provides 101 curated voices; flow_01_ex provides 327 voices.',

    '历史记录 · TTS Studio': 'History · TTS Studio',
    '所有历史记录': 'All history',
    '合成、克隆音色和克隆试听记录按登录账号保存在云端，可跨设备查看和播放。': 'Synthesis, cloned voices, and clone auditions are stored in the cloud per account and available across devices.',
    '记录': 'Records',
    '全部清空': 'Clear all',
    '流式': 'Streaming',
    '克隆': 'Cloning',
    '正在读取云端历史...': 'Loading cloud history...',
    '登录后可查看账号历史记录': 'Sign in to view your account history.',
    '播放音频': 'Play audio',
    '暂停音频': 'Pause audio',
    '正在加载音频': 'Loading audio',
    '复用': 'Reuse',
    '下载': 'Download',
    '音频已过期': 'Audio expired',
    '过期于': 'Expires',

    '英语': 'English',
    '日语': 'Japanese',
    '韩语': 'Korean',
    '粤语': 'Cantonese',
    '马来语': 'Malay',
    '泰语': 'Thai',
    '越南语': 'Vietnamese',
    '印尼语': 'Indonesian',
    '阿拉伯语': 'Arabic',
    '西班牙语': 'Spanish',
    '法语': 'French',
    '葡萄牙语': 'Portuguese',
    '德语': 'German',
    '俄语': 'Russian',
    '意大利语': 'Italian',
    '土耳其语': 'Turkish',
    '荷兰语': 'Dutch',
    '乌克兰语': 'Ukrainian',
    '波兰语': 'Polish',
    '罗马尼亚语': 'Romanian',
    '希腊语': 'Greek',
    '捷克语': 'Czech',
    '芬兰语': 'Finnish',
    '印地语': 'Hindi',
    '保加利亚语': 'Bulgarian',
    '丹麦语': 'Danish',
    '希伯来语': 'Hebrew',
    '波斯语': 'Persian',
    '斯洛伐克语': 'Slovak',
    '瑞典语': 'Swedish',
    '克罗地亚语': 'Croatian',
    '菲律宾语': 'Filipino',
    '匈牙利语': 'Hungarian',
    '挪威语': 'Norwegian',
    '斯洛文尼亚语': 'Slovenian',
    '加泰罗尼亚语': 'Catalan',
    '新挪威语': 'Norwegian Nynorsk',
    '泰米尔语': 'Tamil',
    '南非荷兰语': 'Afrikaans',

    '账户登录': 'Account sign-in',
    '登录账户': 'Sign in',
    '使用邮箱确认链接安全登录，个人配置将与账号保持同步。': 'Sign in securely with an email confirmation link. Your personal settings stay linked to your account.',
    '关闭登录窗口': 'Close sign-in dialog',
    '填写邮箱': 'Enter email',
    '查收邮件': 'Check email',
    '完成登录': 'Complete sign-in',
    '邮箱地址': 'Email address',
    '请输入邮箱地址': 'Enter your email address.',
    '邮箱格式不正确': 'Enter a valid email address.',
    '公司名称': 'Company',
    '可选': 'Optional',
    '公司名称说明': 'About company',
    '公司名称仅在首次注册时保存，已有账户不会被覆盖；登录后可在账户设置中修改。': 'Company is saved only when you first register. Existing accounts are not overwritten, and you can update it later in account settings.',
    '请输入公司名称': 'Enter company name',
    '请在当前设备打开邮件中的登录链接。': 'Open the sign-in link from your email on this device.',
    '仅首次注册时保存，登录后可在账户中修改': 'Saved only during first registration. You can update it from your account after signing in.',
    '发送登录链接': 'Send sign-in link',
    '同一邮箱会进入同一账户。公司名称仅在首次注册时保存，已有账户不会因再次填写而被覆盖。': 'The same email always opens the same account. Company is saved only at first registration and is not overwritten by later sign-in attempts.',
    '请在希望保持登录的设备上打开邮件链接。登录状态会保存在该设备，除非主动退出或清除浏览器数据。': 'Open the email link on the device you want to keep signed in. The session stays on that device until you sign out or clear browser data.',
    '填写或修改公司名称': 'Enter or update company name',
    '保存公司名称': 'Save company',
    '公司名称最多 100 个字符': 'Company name must be 100 characters or fewer.',
    '登录状态已失效，请重新登录': 'Your session has expired. Please sign in again.',
    '保存中...': 'Saving...',
    '公司名称已保存': 'Company name saved.',
    '保存失败': 'Save failed',
    '已登录': 'Signed in',
    '免费版': 'Free',
    '专业版': 'Pro',
    '企业版': 'Enterprise',
    '300 点额度': '300 credits',
    '✅ 300 点额度': '✅ 300 credits',
    '1,000 点额度': '1,000 credits',
    '✅ 1,000 点额度': '✅ 1,000 credits',
    '升级': 'Upgrade',
    '到期时间：': 'Expires: ',
    '退出登录': 'Sign out',
    '升级账户': 'Upgrade account',
    '申请升级': 'Request an upgrade',
    '选择套餐并发送邮件申请，审核通过后开通': 'Choose a plan and send an email request. Access is enabled after approval.',
    '推荐': 'Recommended',
    '/月': '/month',
    '优先技术支持': 'Priority technical support',
    '✅ 优先技术支持': '✅ Priority technical support',
    '高级音色库访问': 'Advanced voice library access',
    '✅ 高级音色库访问': '✅ Advanced voice library access',
    '无限次声音克隆': 'Unlimited voice cloning',
    '✅ 无限次声音克隆': '✅ Unlimited voice cloning',
    '选择专业版': 'Choose Pro',
    '企业': 'Enterprise',
    '专属客服支持': 'Dedicated customer support',
    '✅ 专属客服支持': '✅ Dedicated customer support',
    '定制开发服务': 'Custom development services',
    '✅ 定制开发服务': '✅ Custom development services',
    '优先新功能体验': 'Early access to new features',
    '✅ 优先新功能体验': '✅ Early access to new features',
    '选择企业版': 'Choose Enterprise',
    '关闭升级窗口': 'Close upgrade dialog',
    '登录': 'Sign in',
    '注册': 'Register',
    '登录 / 注册': 'Sign in / Register',
    '加载中': 'Loading',
    '正在恢复登录状态...': 'Restoring your session...',
    '邮箱登录': 'Email sign-in',
    '打开登录窗口': 'Open sign-in dialog',
    '查看账户状态': 'View account status',
    '账户': 'Account',
    '剩余': 'Credits remaining',
    '发送中...': 'Sending...',
    '已退出登录': 'Signed out.',
    '登录服务暂时不可用，请刷新页面后重试。': 'The sign-in service is temporarily unavailable. Refresh the page and try again.',
    '登录服务初始化失败，请刷新页面后重试。': 'The sign-in service could not be initialized. Refresh the page and try again.',
    '当前仅支持邮箱登录，请使用邮箱重新登录。': 'Only email sign-in is currently supported. Please sign in again with your email.',
    '升级到企业版': 'Upgrade to Enterprise',
    '重新订阅': 'Resubscribe',
    '申请续费': 'Request renewal',
    '当前为企业版': 'Enterprise plan active',
    '无': 'None',
    '已过期': 'Expired',
    '今天到期': 'Expires today',
    '明天到期': 'Expires tomorrow',
    '无效日期': 'Invalid date',
    '请先登录以使用此功能': 'Please sign in to use this feature'
  };

  Object.entries(EN).forEach(([source, translated]) => {
    if (source.startsWith('✅ ')) return;
    EN[`✅ ${source}`] ||= `✅ ${translated}`;
  });

  const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'data-example', 'data-text'];
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const valueSources = new WeakMap();
  const translatedSources = new Map();
  let applying = false;

  function normalizeLocale(locale) {
    return String(locale || '').toLowerCase().startsWith('en') ? 'en' : DEFAULT_LOCALE;
  }

  const requestedLocale = new URLSearchParams(window.location.search).get('locale');
  let currentLocale = normalizeLocale(requestedLocale || localStorage.getItem(STORAGE_KEY));
  if (requestedLocale) localStorage.setItem(STORAGE_KEY, currentLocale);
  document.documentElement.lang = currentLocale;

  function interpolate(value, variables = {}) {
    return String(value).replace(/\$\{(\w+)\}/g, (_, key) => variables[key] ?? '');
  }

  function translatePattern(source) {
    let match;
    if (source.startsWith('音色加载失败：')) return `Failed to load voices: ${source.slice('音色加载失败：'.length)}`;
    if (source.startsWith('历史记录加载失败：')) return `Failed to load history: ${source.slice('历史记录加载失败：'.length)}`;
    if ((match = source.match(/^\+(\d+) 更多语言$/))) return `+${match[1]} more languages`;
    if ((match = source.match(/^当前模型 (.+) · (\d+) 个可用音色$/))) return `Current model: ${match[1]} · ${match[2]} available voices`;
    if ((match = source.match(/^(\d+) 个音色$/))) return `${match[1]} voices`;
    if ((match = source.match(/^(\d+) 个$/))) return `${match[1]}`;
    if ((match = source.match(/^剩余 ([\d,]+)$/))) return `${match[1]} credits remaining`;
    if ((match = source.match(/^剩余 ([\d,]+) \/ ([\d,]+) 点体验配额$/))) return `${match[1]} / ${match[2]} credits remaining`;
    if ((match = source.match(/^(\d+) 秒后可重发$/))) return `Resend in ${match[1]}s`;
    if ((match = source.match(/^(\d+)天后到期$/))) return `Expires in ${match[1]} days`;
    if ((match = source.match(/^已登录: (.+)$/))) return `Signed in: ${match[1]}`;
    if ((match = source.match(/^公司：(.+)$/))) return `Company: ${match[1]}`;
    if ((match = source.match(/^登录链接已发送至 (.+)，请前往邮箱点击链接完成登录。$/))) return `A sign-in link was sent to ${match[1]}. Open the email and click the link to complete sign-in.`;
    if ((match = source.match(/^❌ 发送失败: (.+)$/))) return `❌ Failed to send: ${match[1]}`;
    if ((match = source.match(/^退出失败: (.+)$/))) return `Sign-out failed: ${match[1]}`;
    if ((match = source.match(/^请求失败（(\d+)）$/))) return `Request failed (${match[1]})`;
    if ((match = source.match(/^请求失败：(.+)$/))) return `Request failed: ${match[1]}`;
    if ((match = source.match(/^音色加载失败：(.+)$/))) return `Failed to load voices: ${match[1]}`;
    if ((match = source.match(/^加载失败：(.+)$/))) return `Loading failed: ${match[1]}`;
    if ((match = source.match(/^下载失败：(.+)$/))) return `Download failed: ${match[1]}`;
    if ((match = source.match(/^删除失败：(.+)$/))) return `Delete failed: ${match[1]}`;
    if ((match = source.match(/^清空失败：(.+)$/))) return `Clear failed: ${match[1]}`;
    if ((match = source.match(/^合成失败：(.+)$/))) return `Synthesis failed: ${match[1]}`;
    if ((match = source.match(/^克隆失败：(.+)$/))) return `Cloning failed: ${match[1]}`;
    if ((match = source.match(/^无法开始录音：(.+)$/))) return `Could not start recording: ${match[1]}`;
    if ((match = source.match(/^克隆成功，Voice ID：(.+)$/))) return `Clone created. Voice ID: ${match[1]}`;
    if ((match = source.match(/^音频时长为 (.+) 秒，请使用 6–180 秒音频$/))) return `Audio duration is ${match[1]} seconds. Please use audio between 6 and 180 seconds.`;
    if ((match = source.match(/^(.+) · 将转换为 16kHz 单声道 WAV$/))) return `${match[1]} · Will be converted to 16 kHz mono WAV`;
    return source;
  }

  function translate(source, variables = {}, locale = currentLocale) {
    const raw = interpolate(source, variables);
    if (normalizeLocale(locale) === DEFAULT_LOCALE) return raw;
    const result = EN[raw] ?? translatePattern(raw);
    if (result !== raw) translatedSources.set(result, raw);
    return result;
  }

  function preserveWhitespace(value, translated) {
    const leading = value.match(/^\s*/)?.[0] || '';
    const trailing = value.match(/\s*$/)?.[0] || '';
    return `${leading}${translated}${trailing}`;
  }

  function applyTextNode(node) {
    if (!node?.parentElement || node.parentElement.closest('script, style, noscript')) return;
    if (!textSources.has(node)) {
      const source = node.nodeValue;
      const trimmed = source.trim();
      const original = translatedSources.get(trimmed);
      textSources.set(node, original ? preserveWhitespace(source, original) : source);
    }
    const source = textSources.get(node);
    const trimmed = source.trim();
    if (!trimmed) return;
    const next = preserveWhitespace(source, translate(trimmed));
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function applyAttributes(element) {
    if (!(element instanceof Element)) return;
    const dynamicAttributes = new Set(
      String(element.dataset.i18nDynamicAttrs || '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    );
    let sources = attributeSources.get(element);
    if (!sources) {
      sources = {};
      attributeSources.set(element, sources);
    }
    ATTRIBUTES.forEach((name) => {
      if (dynamicAttributes.has(name)) return;
      if (!element.hasAttribute(name)) return;
      if (!(name in sources)) {
        const value = element.getAttribute(name);
        sources[name] = translatedSources.get(value) || value;
      }
      const next = translate(sources[name]);
      if (element.getAttribute(name) !== next) element.setAttribute(name, next);
    });

    if (element instanceof HTMLTextAreaElement && element.dataset.i18nUserEdited !== '1') {
      if (!valueSources.has(element)) valueSources.set(element, element.value);
      const source = valueSources.get(element);
      const next = translate(source);
      if (element.value !== next) element.value = next;
      element.defaultValue = next;
    }
  }

  function applyNode(root = document) {
    if (applying) return;
    applying = true;
    try {
      if (root.nodeType === Node.TEXT_NODE) {
        applyTextNode(root);
      } else {
        if (root instanceof Element) applyAttributes(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          if (node.nodeType === Node.TEXT_NODE) applyTextNode(node);
          else applyAttributes(node);
          node = walker.nextNode();
        }
      }
      document.documentElement.lang = currentLocale;
      document.querySelectorAll('[data-locale]').forEach((button) => {
        const active = normalizeLocale(button.dataset.locale) === currentLocale;
        button.classList.toggle('on', active);
        button.setAttribute('aria-pressed', String(active));
      });
    } finally {
      applying = false;
    }
  }

  function setLocale(locale) {
    const next = normalizeLocale(locale);
    if (!SUPPORTED_LOCALES.includes(next)) return;
    currentLocale = next;
    localStorage.setItem(STORAGE_KEY, next);
    applyNode(document);
    window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale: next } }));
  }

  function getLocale() {
    return currentLocale;
  }

  function formatDateTime(value, options) {
    return new Intl.DateTimeFormat(currentLocale, options || {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  const originalAlert = window.alert.bind(window);
  const originalConfirm = window.confirm.bind(window);
  window.alert = (message) => originalAlert(translate(String(message)));
  window.confirm = (message) => originalConfirm(translate(String(message)));

  window.TTSI18n = {
    t: translate,
    apply: applyNode,
    setLocale,
    getLocale,
    formatDateTime,
    supportedLocales: [...SUPPORTED_LOCALES]
  };

  document.addEventListener('input', (event) => {
    if (event.target instanceof HTMLTextAreaElement) event.target.dataset.i18nUserEdited = '1';
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-locale]');
    if (button) setLocale(button.dataset.locale);
  });

  const start = () => {
    applyNode(document);
    const observer = new MutationObserver((mutations) => {
      if (applying) return;
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') applyNode(mutation.target);
        if (mutation.type === 'attributes') applyNode(mutation.target);
        mutation.addedNodes?.forEach((node) => applyNode(node));
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
