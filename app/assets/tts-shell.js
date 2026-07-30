(() => {
  const active = document.body.dataset.page || 'tts';
  const i18n = window.TTSI18n;
  const locale = i18n?.getLocale?.() || 'zh-CN';
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
        <span class="quota-badge" id="studio-quota-badge" title="体验额度"><span>体验额度</span><strong id="studio-quota-remaining">--</strong><span>/</span><span id="studio-quota-daily">--</span></span>
        <div class="locale-switch" aria-label="界面语言"><button class="${locale === 'zh-CN' ? 'on' : ''}" data-locale="zh-CN" aria-pressed="${locale === 'zh-CN'}" type="button">中文</button><button class="${locale === 'en' ? 'on' : ''}" data-locale="en" aria-pressed="${locale === 'en'}" type="button">EN</button></div>
        <button class="theme-button" id="theme-toggle" type="button" title="切换主题" aria-label="切换主题">◐</button>
      </div>
    </header>
    <aside class="sidebar">
      <div class="side-head"><span class="side-title">FEATURE EXPERIENCE</span><button class="side-toggle" id="side-toggle" type="button" aria-label="折叠侧栏"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg></button></div>
      <nav class="side-menu">${items.map(link).join('')}</nav>
    </aside>`);
})();
