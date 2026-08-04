(() => {
  const active = document.body.dataset.page || 'tts';
  const i18n = window.TTSI18n;
  const locale = i18n?.getLocale?.() || 'zh-CN';
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
  const authSnapshot = (() => {
    const normalizeUser = (user) => {
      if (!user?.email) return null;
      const provider = user.app_metadata?.provider || user.identities?.[0]?.provider || 'email';
      if (provider !== 'email') return null;
      return {
        id: user.id || '',
        email: user.email,
        company: user.user_metadata?.company || ''
      };
    };

    try {
      const cached = JSON.parse(localStorage.getItem('flowtts-auth-ui-snapshot') || 'null');
      if (cached?.email) return cached;

      // Bootstrap existing users once from Supabase's persisted session. Only
      // non-sensitive display fields are returned; API authorization still
      // waits for Supabase to restore and validate the real session.
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || '';
        if (!key.startsWith('flowtts-auth-') || key.includes('code-verifier')) continue;
        const stored = JSON.parse(localStorage.getItem(key) || 'null');
        const user = normalizeUser(stored?.user);
        if (user) return user;
      }
    } catch (_) {}
    return null;
  })();
  const quotaSnapshot = (() => {
    try {
      if (!authSnapshot) return null;
      const snapshot = JSON.parse(localStorage.getItem('flowtts-quota-snapshot') || 'null');
      if (authSnapshot?.id && snapshot?.userId && snapshot.userId !== authSnapshot.id) return null;
      return snapshot?.quota && Number.isFinite(Number(snapshot.quota.remaining)) ? snapshot.quota : null;
    } catch (_) {
      return null;
    }
  })();
  const formatQuota = (value) => {
    const number = Number(value || 0);
    if (number >= 1000) {
      const compact = number / 1000;
      return `${compact >= 10 ? compact.toFixed(0) : compact.toFixed(1)}K`;
    }
    return String(number);
  };
  const quotaClass = quotaSnapshot
    ? Number(quotaSnapshot.remaining) < 500
      ? ' danger'
      : Number(quotaSnapshot.remaining) < 1500
        ? ' warning'
        : ''
    : '';
  const quotaTitle = quotaSnapshot
    ? `剩余 ${Number(quotaSnapshot.remaining).toLocaleString()} / ${Number(quotaSnapshot.daily || 0).toLocaleString()} 点体验配额`
    : '剩余体验配额';
  const accountInitial = (authSnapshot?.email?.[0] || '').toUpperCase();
  const accountClass = authSnapshot ? ' logged-in auth-cached' : ' auth-pending';
  const accountTitle = authSnapshot
    ? (i18n?.t?.(`已登录: ${authSnapshot.email}`) || `已登录: ${authSnapshot.email}`)
    : (i18n?.t?.('正在恢复登录状态...') || '正在恢复登录状态...');
  const accountLabel = authSnapshot?.email || (i18n?.t?.('加载中') || '加载中');
  const icons = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
    tts: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    clone: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M20 8v6M17 11h6"/>',
    voices: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  const items = [
    ['home', 'index.html', '首页'],
    ['tts', 'tts.html', '文本转语音'],
    ['clone', 'voice-clone.html', '声音克隆'],
    ['voices', 'voices.html', '音色库'],
    ['history', 'history.html', '历史记录']
  ];
  const link = ([page, href, label]) => `<a class="side-item ${active === page ? 'active' : ''}" data-page="${page}" href="${href}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[page]}</svg><span>${label}</span></a>`;
  document.write(`
    <header class="topbar">
      <a class="top-brand" href="index.html"><span class="brand-mark">T</span><span>TTS Studio</span></a>
      <div class="top-actions">
        <span class="quota-badge${quotaClass}" id="studio-quota-badge" title="${quotaTitle}" style="${quotaSnapshot ? 'display:inline-flex' : ''}"><span class="quota-lightning" aria-hidden="true">ϟ</span><strong id="studio-quota-remaining">${quotaSnapshot ? formatQuota(quotaSnapshot.remaining) : '--'}</strong></span>
        <div class="locale-switch" aria-label="界面语言"><button class="${locale === 'zh-CN' ? 'on' : ''}" data-locale="zh-CN" aria-pressed="${locale === 'zh-CN'}" type="button">中文</button><button class="${locale === 'en' ? 'on' : ''}" data-locale="en" aria-pressed="${locale === 'en'}" type="button">EN</button></div>
        <button class="theme-button" id="theme-toggle" type="button" title="切换主题" aria-label="切换主题">◐</button>
        <button class="account-button${accountClass}" id="studio-account-button" type="button" title="${escapeHtml(accountTitle)}" aria-label="${escapeHtml(accountTitle)}" aria-busy="${authSnapshot ? 'false' : 'true'}" aria-haspopup="dialog" aria-controls="supabase-login-modal" data-i18n-dynamic-attrs="title,aria-label">
          <span class="account-avatar" id="studio-account-avatar" aria-hidden="true">${escapeHtml(accountInitial || '…')}</span>
          <span class="account-label" id="studio-account-label">${escapeHtml(accountLabel)}</span>
        </button>
      </div>
    </header>
    <aside class="sidebar">
      <div class="side-head"><span class="side-title">FEATURE EXPERIENCE</span><button class="side-toggle" id="side-toggle" type="button" aria-label="折叠侧栏"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg></button></div>
      <nav class="side-menu">${items.map(link).join('')}</nav>
    </aside>`);
})();
