/**
 * Supabase Auth 自动注入脚本 - 非侵入式邮箱登录
 *
 * @description
 * 无需修改现有代码，自动处理邮箱登录
 *
 * @usage
 * 1. 在 Supabase 创建项目，获取 URL 和 Publishable Key
 * 2. 后端通过 /api/config 暴露公开配置
 * 3. 在页面 <head> 中添加：
 *    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *    <script src="supabase-auth-inject.js"></script>
 *
 * @features
 * - 浮动登录按钮，独立于现有 UI
 * - 任意邮箱确认链接无密码登录/注册
 * - 登录状态持久化（localStorage）
 * - 自动刷新 Session
 * - 完全不侵入现有代码
 *
 * @version 2.0.0
 * @date 2025-11-04
 */

(function() {
    'use strict';

    // ==================== 应用配置 ====================

    const APP_CONFIG = {
        // API Server URL - 前后端同源，自动适配任意环境
        API_BASE: window.location.origin,

        // Supabase 公开配置由后端 /api/config 加载
        SUPABASE_URL: '',
        SUPABASE_PUBLISHABLE_KEY: '',

        // 配额设置
        QUOTA: {
            DAILY_LIMIT: 10000,
            WARNING_THRESHOLD: 500
        },

        // 版本信息
        VERSION: '2.0.0',

        // 调试模式
        DEBUG: window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1'
    };

    const i18n = window.TTSI18n;
    const t = (text, variables) => i18n?.t(text, variables) || text;

    // ==================== 全局状态 ====================

    const authState = {
        supabase: null,
        session: null,
        user: null,
        quota: null  // 配额信息 { daily, used, remaining }
    };

    // ==================== 工具函数 ====================

    function log(msg, type = 'info') {
        const styles = {
            info: 'color: #0072a8ff; font-weight: 600',      // 蓝色
            success: 'color: #22c55e; font-weight: 600',    // 绿色
            warn: 'color: #f59e0b; font-weight: 600',       // 黄色
            error: 'color: #ef4444; font-weight: 700'       // 红色
        };

        const style = styles[type] || styles.info;

        if (type === 'error') {
            console.error('%c[Supabase Auth]%s', 'color: #ef4444; font-weight: 700', msg);
        } else if (type === 'warn') {
            console.warn('%c[Supabase Auth]%s', 'color: #f59e0b; font-weight: 600', msg);
        } else {
            console.log('%c[Supabase Auth]%s', style, msg);
        }
    }

    function isEmailUser(user) {
        const provider = user?.app_metadata?.provider || user?.identities?.[0]?.provider || '';
        return provider === 'email';
    }

    // ==================== Supabase 初始化 ====================
    
    async function loadPublicConfig() {
        const response = await fetch(`${APP_CONFIG.API_BASE}/api/config`, {
            headers: { Accept: 'application/json' },
            cache: 'no-cache'
        });
        if (!response.ok) {
            const raw = await response.text();
            let message = raw;
            try { message = JSON.parse(raw).message || raw; } catch (_) {}
            throw new Error(message || `HTTP ${response.status}`);
        }
        const config = await response.json();
        if (!config.supabaseUrl || !config.supabasePublishableKey) {
            throw new Error('Supabase public configuration is incomplete');
        }
        APP_CONFIG.SUPABASE_URL = config.supabaseUrl;
        APP_CONFIG.SUPABASE_PUBLISHABLE_KEY = config.supabasePublishableKey;
    }

    function initSupabase() {
        // 检查 Supabase SDK 是否已加载
        if (!window.supabase || !window.supabase.createClient) {
            log('未找到 Supabase SDK，请先引入脚本', 'error');
            return false;
        }

        try {
            authState.supabase = window.supabase.createClient(
                APP_CONFIG.SUPABASE_URL,
                APP_CONFIG.SUPABASE_PUBLISHABLE_KEY,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,
                        storage: window.localStorage,
                        storageKey: `flowtts-auth-${new URL(APP_CONFIG.SUPABASE_URL).hostname.split('.')[0]}`
                    }
                }
            );
            log('初始化成功');
            return true;
        } catch (error) {
            log('初始化失败: ' + error.message, 'error');
            return false;
        }
    }

    // ==================== UI 注入 ====================
    
    function injectLoginUI() {
        // 注入样式
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --supabase-primary: #1f6feb;
                --supabase-primary-dark: #1158c7;
                --supabase-success: #2da44e;
                --supabase-danger: #dc2626;
                --supabase-surface: #ffffff;
                --supabase-border: rgba(15, 23, 42, 0.08);
                --supabase-text: #0f172a;
                --supabase-text-muted: #64748b;
            }
            body.dark {
                --supabase-surface: rgba(28, 31, 38, 0.98);
                --supabase-border: rgba(148, 163, 184, 0.18);
                --supabase-text: #e2e8f0;
                --supabase-text-muted: #a5b4fc;
            }
            body.supabase-modal-open {
                overflow: hidden;
            }
            #supabase-login-modal {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: rgba(15, 23, 42, 0.45);
                backdrop-filter: blur(5px);
                z-index: 10000;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
            }
            #supabase-login-modal.show {
                opacity: 1;
                pointer-events: auto;
            }
            .supabase-modal-content {
                width: min(420px, 100%);
                background: var(--supabase-surface);
                color: var(--supabase-text);
                border-radius: 18px;
                padding: 28px 28px 32px;
                box-shadow: 0 30px 60px rgba(15, 23, 42, 0.28);
                transform: translateY(18px);
                transition: transform 0.2s ease;
                position: relative;
            }
            #supabase-login-modal.show .supabase-modal-content {
                transform: translateY(0);
            }
            body.dark .supabase-modal-content {
                box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55);
            }
            .supabase-modal-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
            }
            .supabase-modal-header h2 {
                margin: 4px 0 6px;
                font-size: 22px;
                font-weight: 700;
                letter-spacing: -0.2px;
            }
            .supabase-modal-desc {
                margin: 0;
                font-size: 13px;
                color: var(--supabase-text-muted);
                line-height: 1.6;
            }
            .supabase-modal-tag {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 1px;
                text-transform: uppercase;
                color: var(--supabase-primary);
                background: rgba(31, 111, 235, 0.12);
                padding: 4px 10px;
                border-radius: 999px;
            }
            body.dark .supabase-modal-tag {
                background: rgba(37, 115, 255, 0.2);
                color: #93c5fd;
            }
            .supabase-close-btn {
                border: none;
                background: rgba(15, 23, 42, 0.05);
                color: var(--supabase-text);
                width: 32px;
                height: 32px;
                border-radius: 50%;
                font-size: 18px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: background 0.2s ease, transform 0.2s ease;
            }
            .supabase-close-btn:hover {
                background: rgba(31, 111, 235, 0.12);
                transform: rotate(90deg);
            }
            body.dark .supabase-close-btn {
                background: rgba(148, 163, 184, 0.1);
            }
            .supabase-stepper {
                margin-top: 18px;
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }
            .supabase-step {
                min-width: 0;
                display: grid;
                grid-template-columns: 26px minmax(0, 1fr);
                align-items: center;
                column-gap: 8px;
                position: relative;
                color: var(--supabase-text-muted);
                isolation: isolate;
            }
            .supabase-step::after {
                content: '';
                position: absolute;
                z-index: 0;
                top: 13px;
                left: 13px;
                width: 100%;
                height: 2px;
                background: rgba(148, 163, 184, 0.2);
                pointer-events: none;
            }
            .supabase-step:last-child::after {
                display: none;
            }
            .supabase-step .dot {
                position: relative;
                z-index: 1;
                width: 26px;
                height: 26px;
                box-sizing: border-box;
                border-radius: 50%;
                border: 2px solid rgba(148, 163, 184, 0.4);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s ease;
                background: var(--supabase-surface);
            }
            .supabase-step .label {
                position: relative;
                z-index: 1;
                width: max-content;
                max-width: 100%;
                padding: 2px 6px 2px 0;
                background: var(--supabase-surface);
                font-size: 12px;
                font-weight: 600;
                line-height: 1.35;
                white-space: nowrap;
            }
            .supabase-step[data-state="active"] {
                color: var(--supabase-text);
            }
            .supabase-step[data-state="active"] .dot {
                border-color: var(--supabase-primary);
                background: var(--supabase-primary);
                color: #ffffff;
                box-shadow: 0 4px 10px rgba(31, 111, 235, 0.2);
            }
            .supabase-step[data-state="active"]::after {
                background: rgba(31, 111, 235, 0.35);
            }
            .supabase-step[data-state="done"] {
                color: var(--supabase-success);
            }
            .supabase-step[data-state="done"] .dot {
                border-color: var(--supabase-success);
                background: var(--supabase-success);
                color: #ffffff;
                box-shadow: 0 4px 10px rgba(45, 164, 78, 0.25);
            }
            .supabase-step[data-state="done"]::after {
                background: rgba(45, 164, 78, 0.45);
            }
            .supabase-modal-body {
                margin-top: 26px;
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            .supabase-form-step {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .supabase-input-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .supabase-input-group label {
                font-size: 13px;
                font-weight: 600;
                color: var(--supabase-text-muted);
            }
            .supabase-input-group label .optional {
                font-weight: 400;
                font-size: 12px;
                margin-left: 6px;
                color: rgba(148, 163, 184, 0.8);
            }
            .supabase-input-group input {
                width: 100%;
                padding: 14px 16px;
                border: 1.5px solid var(--supabase-border);
                border-radius: 12px;
                font-size: 15px;
                background: rgba(15, 23, 42, 0.02);
                color: var(--supabase-text);
                transition: border 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
            }
            body.dark .supabase-input-group input {
                background: rgba(148, 163, 184, 0.08);
            }
            .supabase-input-group input:focus {
                outline: none;
                border-color: var(--supabase-primary);
                box-shadow: 0 0 0 4px rgba(31, 111, 235, 0.15);
                background: #ffffff;
            }
            body.dark .supabase-input-group input:focus {
                background: rgba(15, 23, 42, 0.6);
            }
            .supabase-btn {
                width: 100%;
                padding: 11px 16px;
                border-radius: 12px;
                border: 1px solid var(--supabase-border);
                font-size: 15px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                cursor: pointer;
                background: var(--supabase-surface);
                color: var(--supabase-text);
                transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
            }
            .supabase-btn:disabled {
                opacity: 0.55;
                cursor: not-allowed;
                transform: none;
            }
            .supabase-btn.primary {
                background: var(--supabase-primary);
                border-color: var(--supabase-primary);
                color: #ffffff;
                box-shadow: none;
            }
            .supabase-btn.primary:hover:not(:disabled) {
                background: var(--supabase-primary-dark);
                border-color: var(--supabase-primary-dark);
                transform: translateY(-1px);
            }
            body.dark .supabase-btn.primary {
                box-shadow: 0 8px 18px rgba(31, 111, 235, 0.28);
            }
            .supabase-helper {
                margin: 0;
                font-size: 13px;
                color: var(--supabase-text-muted);
                line-height: 1.6;
            }
            .supabase-helper strong {
                color: var(--supabase-text);
                font-weight: 700;
            }
            .supabase-status {
                display: none;
                padding: 12px 14px;
                border-radius: 12px;
                font-size: 13px;
                line-height: 1.6;
            }
            .supabase-status.success {
                display: block;
                background: rgba(209, 250, 229, 0.6);
                color: #047857;
            }
            .supabase-status.error {
                display: block;
                background: rgba(254, 226, 226, 0.7);
                color: #b91c1c;
            }
            body.dark .supabase-status.success {
                background: rgba(34, 197, 94, 0.16);
                color: #4ade80;
            }
            body.dark .supabase-status.error {
                background: rgba(248, 113, 113, 0.18);
                color: #f87171;
            }
            .supabase-user-info {
                display: flex;
                gap: 14px;
                padding: 16px;
                border-radius: 14px;
                background: rgba(15, 23, 42, 0.04);
                border: 1px solid var(--supabase-border);
            }
            body.dark .supabase-user-info {
                background: rgba(148, 163, 184, 0.08);
            }
            .supabase-user-info .avatar {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: linear-gradient(135deg, #2573ff 0%, #1f6feb 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                color: #ffffff;
            }
            .supabase-user-info .meta {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .supabase-user-info .title {
                margin: 0;
                font-size: 13px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                color: var(--supabase-text-muted);
            }
            .supabase-user-info .email {
                margin: 0;
                font-size: 15px;
                font-weight: 600;
                color: var(--supabase-text);
            }
            .supabase-user-info .company {
                margin: 0;
                font-size: 13px;
                color: var(--supabase-text-muted);
            }
            .supabase-account-settings {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 14px;
                border: 1px solid var(--supabase-border);
                border-radius: 14px;
                background: rgba(15, 23, 42, 0.025);
            }
            body.dark .supabase-account-settings {
                background: rgba(148, 163, 184, 0.06);
            }
            .supabase-account-settings .supabase-btn {
                padding-block: 9px;
                font-size: 13px;
            }
            .user-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .supabase-tier-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.3px;
                text-transform: uppercase;
                margin-left: 4px;
                white-space: nowrap;
            }
            .supabase-tier-badge.free {
                background: rgba(100, 116, 139, 0.15);
                color: #64748b;
            }
            .supabase-tier-badge.pro {
                background: rgba(31, 111, 235, 0.15);
                color: #1f6feb;
            }
            .supabase-tier-badge.max {
                background: rgba(245, 158, 11, 0.15);
                color: #f59e0b;
            }
            body.dark .supabase-tier-badge.free {
                background: rgba(148, 163, 184, 0.2);
                color: #cbd5e1;
            }
            body.dark .supabase-tier-badge.pro {
                background: rgba(37, 115, 255, 0.25);
                color: #93c5fd;
            }
            body.dark .supabase-tier-badge.max {
                background: rgba(251, 191, 36, 0.25);
                color: #fde68a;
            }
            .supabase-quota-section {
                margin-top: 16px;
                padding: 16px;
                border-radius: 12px;
                background: rgba(15, 23, 42, 0.04);
                border: 1px solid var(--supabase-border);
            }
            body.dark .supabase-quota-section {
                background: rgba(148, 163, 184, 0.08);
            }
            .quota-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .quota-title {
                font-size: 13px;
                font-weight: 600;
                color: var(--supabase-text-muted);
            }
            .quota-count {
                font-size: 13px;
                font-weight: 700;
                color: var(--supabase-text);
            }
            .quota-progress {
                width: 100%;
                height: 8px;
                background: rgba(148, 163, 184, 0.2);
                border-radius: 999px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            .quota-bar {
                height: 100%;
                background: linear-gradient(90deg, #2da44e 0%, #1f6feb 100%);
                border-radius: 999px;
                transition: width 0.3s ease;
            }
            .quota-bar.warning {
                background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);
            }
            .quota-bar.danger {
                background: linear-gradient(90deg, #dc2626 0%, #ef4444 100%);
            }
            .quota-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .quota-remaining {
                font-size: 12px;
                color: var(--supabase-text-muted);
            }
            .supabase-upgrade-btn {
                padding: 6px 12px;
                border-radius: 8px;
                border: 1px solid var(--supabase-primary);
                background: var(--supabase-primary);
                color: #ffffff;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .supabase-upgrade-btn:hover {
                background: var(--supabase-primary-dark);
                border-color: var(--supabase-primary-dark);
                transform: translateY(-1px);
            }
            .pricing-plans {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-top: 8px;
            }
            .plan-card {
                position: relative;
                border: 1.5px solid var(--supabase-border);
                border-radius: 14px;
                padding: 20px;
                background: var(--supabase-surface);
                transition: all 0.2s ease;
            }
            .plan-card:hover {
                border-color: var(--supabase-primary);
                box-shadow: 0 8px 16px rgba(31, 111, 235, 0.12);
                transform: translateY(-2px);
            }
            .plan-badge {
                position: absolute;
                top: -10px;
                left: 20px;
                background: var(--supabase-primary);
                color: #ffffff;
                padding: 4px 12px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.5px;
            }
            .plan-badge.enterprise {
                background: #f59e0b;
            }
            .plan-header {
                margin-top: 4px;
                margin-bottom: 16px;
            }
            .plan-header h3 {
                margin: 0 0 12px 0;
                font-size: 18px;
                font-weight: 700;
                color: var(--supabase-text);
            }
            .plan-price {
                display: flex;
                align-items: baseline;
                gap: 4px;
            }
            .plan-price .price {
                font-size: 28px;
                font-weight: 700;
                color: var(--supabase-primary);
            }
            .plan-price .period {
                font-size: 13px;
                color: var(--supabase-text-muted);
            }
            .plan-features {
                list-style: none;
                padding: 0;
                margin: 0 0 20px 0;
            }
            .plan-features li {
                padding: 8px 0;
                font-size: 13px;
                color: var(--supabase-text);
                border-bottom: 1px solid rgba(148, 163, 184, 0.1);
            }
            .plan-features li:last-child {
                border-bottom: none;
            }
            .plan-select-btn {
                width: 100%;
                margin-top: 8px;
            }
            .supabase-upgrade-status {
                margin-top: 16px;
                padding: 12px;
                border-radius: 8px;
                font-size: 13px;
                display: none;
            }
            .supabase-upgrade-status.show {
                display: block;
            }
            .supabase-upgrade-status.success {
                background: rgba(45, 164, 78, 0.1);
                color: #047857;
                border: 1px solid rgba(45, 164, 78, 0.3);
            }
            .supabase-upgrade-status.error {
                background: rgba(220, 38, 38, 0.1);
                color: #b91c1c;
                border: 1px solid rgba(220, 38, 38, 0.3);
            }
            #supabase-upgrade-modal {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: rgba(15, 23, 42, 0.45);
                backdrop-filter: blur(5px);
                z-index: 10001;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
            }
            #supabase-upgrade-modal.show {
                opacity: 1;
                pointer-events: auto;
            }
            @media (max-width: 640px) {
                #supabase-login-modal {
                    align-items: flex-start;
                    padding: 14px;
                    overflow-y: auto;
                }
                .supabase-modal-content {
                    margin: auto 0;
                    padding: 24px 20px 28px;
                }
                .supabase-modal-header h2 {
                    font-size: 20px;
                }
                .supabase-stepper {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
                .supabase-step {
                    grid-template-columns: 24px minmax(0, 1fr);
                    column-gap: 5px;
                }
                .supabase-step .dot {
                    width: 24px;
                    height: 24px;
                    font-size: 11px;
                }
                .supabase-step::after {
                    top: 12px;
                    left: 12px;
                }
                .supabase-step .label {
                    padding-right: 3px;
                    font-size: 11px;
                    letter-spacing: 0;
                }
                .pricing-plans {
                    grid-template-columns: 1fr;
                    gap: 12px;
                }
                .plan-card {
                    padding: 16px;
                }
            }
            
        `;
        document.head.appendChild(style);

        // 登录弹窗
        const modal = document.createElement('div');
        modal.id = 'supabase-login-modal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="supabase-modal-content" role="dialog" aria-modal="true" aria-labelledby="supabase-modal-title">
                <div class="supabase-modal-header">
                    <div>
                        <span class="supabase-modal-tag">账户登录</span>
                        <h2 id="supabase-modal-title">登录账户</h2>
                        <p class="supabase-modal-desc">使用邮箱确认链接安全登录，个人配置将与账号保持同步。</p>
                    </div>
                    <button type="button" class="supabase-close-btn" id="supabase-close-modal" aria-label="关闭登录窗口">✕</button>
                </div>
                <div class="supabase-stepper" id="supabase-stepper">
                    <div class="supabase-step" data-step="1" data-state="active">
                        <span class="dot">1</span>
                        <span class="label">填写邮箱</span>
                    </div>
                    <div class="supabase-step" data-step="2" data-state="pending">
                        <span class="dot">2</span>
                        <span class="label">查收邮件</span>
                    </div>
                    <div class="supabase-step" data-step="3" data-state="pending">
                        <span class="dot">3</span>
                        <span class="label">完成登录</span>
                    </div>
                </div>
                <div class="supabase-modal-body">
                    <div id="email-form" class="supabase-form-step">
                        <div class="supabase-input-group">
                            <label for="supabase-email">邮箱地址</label>
                            <input type="email" id="supabase-email" placeholder="name@example.com" autocomplete="email" />
                        </div>
                        <div class="supabase-input-group">
                            <label for="supabase-company">公司名称 <span class="optional">可选</span></label>
                            <input type="text" id="supabase-company" maxlength="100" placeholder="仅首次注册时保存，登录后可在账户中修改" autocomplete="organization" />
                        </div>
                        <button class="supabase-btn primary" id="supabase-send-link">发送登录链接</button>
                        <p class="supabase-helper">同一邮箱会进入同一账户。公司名称仅在首次注册时保存，已有账户不会因再次填写而被覆盖。</p>
                        <p class="supabase-helper">请在希望保持登录的设备上打开邮件链接。登录状态会保存在该设备，除非主动退出或清除浏览器数据。</p>
                        <div class="supabase-status" id="supabase-status"></div>
                    </div>
                    <div id="logout-form" class="supabase-form-step" style="display:none;">
                        <div class="supabase-user-info">
                            <div class="avatar">👋</div>
                            <div class="meta">
                                <p class="title">已登录</p>
                                <div class="user-row">
                                    <p class="email" id="user-email"></p>
                                    <span class="supabase-tier-badge" id="user-tier">免费版</span>
                                </div>
                                <p class="company" id="user-company"></p>
                            </div>
                        </div>
                        <div class="supabase-account-settings">
                            <div class="supabase-input-group">
                                <label for="supabase-account-company">公司名称</label>
                                <input type="text" id="supabase-account-company" maxlength="100" placeholder="填写或修改公司名称" autocomplete="organization" />
                            </div>
                            <button class="supabase-btn" id="supabase-save-company" type="button">保存公司名称</button>
                            <div class="supabase-status" id="supabase-company-status"></div>
                        </div>
                        <div class="supabase-quota-section" id="quota-section">
                            <div class="quota-header">
                                <span class="quota-title">今日配额</span>
                                <span class="quota-count" id="quota-count">0 / 10000</span>
                            </div>
                            <div class="quota-progress">
                                <div class="quota-bar" id="quota-bar" style="width: 0%"></div>
                            </div>
                            <div class="quota-footer">
                                <span class="quota-remaining" id="quota-remaining">剩余 10000</span>
                                <button class="supabase-upgrade-btn" id="upgrade-btn">升级</button>
                            </div>
                            <div class="subscription-timing" id="subscription-timing" style="margin-top: 10px; font-size: 12px; color: var(--supabase-text-muted); display: none;">
                                <div class="timing-row" id="subscription-end" style="margin-top: 4px;">
                                    <span class="timing-label">到期时间：</span>
                                    <span class="timing-value" id="end-date">-</span>
                                </div>
                            </div>
                        </div>
                        <button class="supabase-btn primary" id="supabase-logout">退出登录</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // 升级模态框
        const upgradeModal = document.createElement('div');
        upgradeModal.id = 'supabase-upgrade-modal';
        upgradeModal.setAttribute('aria-hidden', 'true');
        upgradeModal.innerHTML = `
            <div class="supabase-modal-content" role="dialog" aria-modal="true" aria-labelledby="supabase-upgrade-title" style="max-width: 560px;">
                <div class="supabase-modal-header">
                    <div>
                        <span class="supabase-modal-tag">升级账户</span>
                        <h2 id="supabase-upgrade-title">申请升级</h2>
                        <p class="supabase-modal-desc">选择套餐并发送邮件申请，审核通过后开通</p>
                    </div>
                    <button type="button" class="supabase-close-btn" id="supabase-close-upgrade" aria-label="关闭升级窗口">✕</button>
                </div>
                <div class="supabase-modal-body">
                    <div class="pricing-plans">
                        <div class="plan-card" data-plan="pro">
                            <div class="plan-badge">推荐</div>
                            <div class="plan-header">
                                <h3>专业版</h3>
                                <div class="plan-price">
                                    <span class="price">¥20</span>
                                    <span class="period">/月</span>
                                </div>
                            </div>
                            <ul class="plan-features">
                                <li>✅ 每日 300 次配额</li>
                                <li>✅ 优先技术支持</li>
                                <li>✅ 高级音色库访问</li>
                                <li>✅ 无限次声音克隆</li>
                            </ul>
                            <button class="supabase-btn primary plan-select-btn" data-plan="pro">选择专业版</button>
                        </div>
                        <div class="plan-card" data-plan="max">
                            <div class="plan-badge enterprise">企业</div>
                            <div class="plan-header">
                                <h3>企业版</h3>
                                <div class="plan-price">
                                    <span class="price">¥100</span>
                                    <span class="period">/月</span>
                                </div>
                            </div>
                            <ul class="plan-features">
                                <li>✅ 每日 1000 次配额</li>
                                <li>✅ 专属客服支持</li>
                                <li>✅ 定制开发服务</li>
                                <li>✅ 优先新功能体验</li>
                            </ul>
                            <button class="supabase-btn primary plan-select-btn" data-plan="max">选择企业版</button>
                        </div>
                    </div>

                    <div class="supabase-upgrade-status" id="supabase-upgrade-status"></div>
                </div>
            </div>
        `;
        document.body.appendChild(upgradeModal);

        const accountButton = document.getElementById('studio-account-button');
        accountButton?.addEventListener('click', () => toggleModal(true));

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) toggleModal(false);
        });

        document.getElementById('supabase-close-modal').addEventListener('click', () => toggleModal(false));

        // 绑定事件
        document.getElementById('supabase-send-link').addEventListener('click', sendLoginLink);
        document.getElementById('supabase-logout').addEventListener('click', logout);
        document.getElementById('supabase-save-company').addEventListener('click', saveCompany);
        document.getElementById('supabase-email').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendLoginLink();
        });

        // 升级相关事件
        document.getElementById('supabase-close-upgrade').addEventListener('click', () => toggleUpgradeModal(false));
        document.getElementById('upgrade-btn').addEventListener('click', () => toggleUpgradeModal(true));
        document.getElementById('supabase-upgrade-modal').addEventListener('click', (e) => {
            if (e.target.id === 'supabase-upgrade-modal') toggleUpgradeModal(false);
        });

        // 套餐选择事件（使用事件委托）
        document.querySelectorAll('.plan-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const plan = e.target.dataset.plan;
                handlePlanSelection(plan);
            });
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (modal.classList.contains('show')) {
                    toggleModal(false);
                } else if (upgradeModal.classList.contains('show')) {
                    toggleUpgradeModal(false);
                }
            }
        });

        setLoginStep(1);
        i18n?.apply?.(document);
        log('UI 已注入');
    }

    function toggleModal(force) {
        const modal = document.getElementById('supabase-login-modal');
        if (!modal) return;

        const shouldShow = typeof force === 'boolean' ? force : !modal.classList.contains('show');
        const loginBtn = document.getElementById('studio-account-button');

        if (shouldShow) {
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('supabase-modal-open');
            if (loginBtn) {
                loginBtn.setAttribute('aria-expanded', 'true');
            }
            setTimeout(() => {
                focusLoginField();
            }, 120);
        } else {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('supabase-modal-open');
            if (loginBtn) {
                loginBtn.setAttribute('aria-expanded', 'false');
            }
        }
    }

    function showStatus(message, type = 'success') {
        const status = document.getElementById('supabase-status');
        status.textContent = message;
        status.className = `supabase-status ${type}`;
    }

    function showCompanyStatus(message, type = 'success') {
        const status = document.getElementById('supabase-company-status');
        if (!status) return;
        status.textContent = message;
        status.className = `supabase-status ${type}`;
    }

    function setLoginStep(step) {
        const steps = document.querySelectorAll('.supabase-step');
        steps.forEach(el => {
            const value = Number(el.dataset.step);
            let state = 'pending';
            if (value < step) state = 'done';
            else if (value === step) state = 'active';
            el.dataset.state = state;
        });
    }

    function focusLoginField() {
        const logoutForm = document.getElementById('logout-form');
        if (logoutForm && logoutForm.style.display !== 'none') {
            document.getElementById('supabase-logout')?.focus();
            return;
        }

        document.getElementById('supabase-email')?.focus();
    }

    // ==================== 登录逻辑 ====================

    // 发送确认/登录链接
    async function sendLoginLink() {
        const emailInput = document.getElementById('supabase-email');
        const companyInput = document.getElementById('supabase-company');
        const btn = document.getElementById('supabase-send-link');
        const email = emailInput.value.trim();
        const company = companyInput?.value.trim() || '';

        if (!email) {
            showStatus('请输入邮箱地址', 'error');
            return;
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showStatus('邮箱格式不正确', 'error');
            return;
        }

        try {
            btn.disabled = true;
            btn.textContent = '发送中...';

            const { error } = await authState.supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo: `${window.location.origin}/app/index.html`,
                    data: {
                        company: company,
                        full_name: company,  // 同步到 Display name
                        registered_at: new Date().toISOString()
                    }
                }
            });

            if (error) throw error;

            setLoginStep(2);
            showStatus(`登录链接已发送至 ${email}，请前往邮箱点击链接完成登录。`, 'success');
            log('登录链接已发送到: ' + email);
        } catch (error) {
            showStatus('❌ 发送失败: ' + error.message, 'error');
            log('发送登录链接失败: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = t('发送登录链接');
        }
    }

    async function saveCompany() {
        const input = document.getElementById('supabase-account-company');
        const button = document.getElementById('supabase-save-company');
        const company = input?.value.trim() || '';
        if (company.length > 100) {
            showCompanyStatus(t('公司名称最多 100 个字符'), 'error');
            return;
        }
        if (!authState.session?.access_token) {
            showCompanyStatus(t('登录状态已失效，请重新登录'), 'error');
            return;
        }

        try {
            button.disabled = true;
            button.textContent = t('保存中...');
            const response = await fetch(`${APP_CONFIG.API_BASE}/api/user/profile`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authState.session.access_token}`
                },
                body: JSON.stringify({ company })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);

            const { data: userData, error: userError } = await authState.supabase.auth.updateUser({
                data: {
                    company,
                    full_name: company,
                    updated_at: new Date().toISOString()
                }
            });
            if (userError) throw userError;
            authState.user = userData.user || authState.user;
            updateLoginStatus(authState.user);
            showCompanyStatus(t('公司名称已保存'), 'success');
        } catch (error) {
            showCompanyStatus(`${t('保存失败')}：${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = t('保存公司名称');
        }
    }

    // 重置表单
    function resetForms() {
        const emailInput = document.getElementById('supabase-email');
        const companyInput = document.getElementById('supabase-company');
        const status = document.getElementById('supabase-status');

        if (emailInput) emailInput.value = '';
        if (companyInput) companyInput.value = '';
        if (status) {
            status.className = 'supabase-status';
            status.textContent = '';
        }
    }

    async function logout() {
        try {
            await authState.supabase.auth.signOut();
            authState.session = null;
            authState.user = null;

            updateLoginStatus(null);
            toggleModal();
            showStatus('已退出登录', 'success');

            log('已退出登录');

            // 刷新页面
            setTimeout(() => window.location.reload(), 500);
        } catch (error) {
            showStatus('退出失败: ' + error.message, 'error');
            log('退出失败: ' + error.message, 'error');
        }
    }

    /**
     * 格式化日期显示
     * @param {string} dateStr - ISO 日期字符串
     * @returns {string} 格式化后的日期
     */
    function formatDate(dateStr) {
        if (!dateStr) return t('无');
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffTime = date - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                return t('已过期');
            } else if (diffDays === 0) {
                return t('今天到期');
            } else if (diffDays === 1) {
                return t('明天到期');
            } else if (diffDays <= 7) {
                return i18n?.getLocale?.() === 'en' ? `Expires in ${diffDays} days` : `${diffDays}天后到期`;
            } else {
                return date.toLocaleDateString(i18n?.getLocale?.() || 'zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            }
        } catch (error) {
            return t('无效日期');
        }
    }

    /**
     * 更新配额信息（从 API 响应中提取）
     * 前端在调用 API 后，从响应的 quota 字段更新配额
     * @param {Object} quotaData - API 响应中的 quota 对象 { daily, used, remaining, subscription_tier, subscription_end }
     */
    function updateQuota(quotaData) {
        if (!quotaData) return;

        authState.quota = quotaData;
        log('配额已更新: ' + JSON.stringify(quotaData));

        // 更新 UI 显示
        updateQuotaDisplay(quotaData);

        // 触发自定义事件，通知页面配额已更新
        window.dispatchEvent(new CustomEvent('quotaUpdated', {
            detail: quotaData
        }));
    }

    /**
     * 更新配额显示 UI
     * @param {Object} quota - 配额对象 { daily, used, remaining, subscription_tier, subscription_end }
     */
    function updateQuotaDisplay(quota) {
        const { daily, used, remaining, subscription_tier, subscription_end } = quota;
        const percentage = daily > 0 ? (used / daily) * 100 : 0;

        // 更新计数
        const countEl = document.getElementById('quota-count');
        if (countEl) {
            countEl.textContent = `${used} / ${daily}`;
        }

        // 更新进度条
        const barEl = document.getElementById('quota-bar');
        if (barEl) {
            barEl.style.width = `${Math.min(percentage, 100)}%`;
            barEl.classList.remove('warning', 'danger');
            if (percentage >= 90) {
                barEl.classList.add('danger');
            } else if (percentage >= 70) {
                barEl.classList.add('warning');
            }
        }

        // 更新剩余
        const remainingEl = document.getElementById('quota-remaining');
        if (remainingEl) {
            remainingEl.textContent = i18n?.getLocale?.() === 'en' ? `${remaining} remaining` : `剩余 ${remaining}`;
        }

        // 更新订阅等级徽章
        const tierBadge = document.getElementById('user-tier');
        if (tierBadge && subscription_tier) {
            tierBadge.textContent = getTierDisplayName(subscription_tier);
            tierBadge.className = `supabase-tier-badge ${subscription_tier}`;
        }

        // 显示升级按钮（所有等级都显示，但文字不同）
        const upgradeBtn = document.getElementById('upgrade-btn');
        if (upgradeBtn) {
            if (subscription_tier === 'free') {
                upgradeBtn.style.display = 'inline-flex';
                upgradeBtn.textContent = t('升级');
            } else if (subscription_tier === 'pro') {
                // 专业版用户可以升级到企业版
                upgradeBtn.style.display = 'inline-flex';
                upgradeBtn.textContent = t('升级到企业版');
            } else if (subscription_tier === 'max') {
                // 企业版用户显示续费或隐藏
                const endDate = subscription_end ? new Date(subscription_end) : null;
                const now = new Date();
                const daysLeft = endDate ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)) : null;

                if (daysLeft !== null && daysLeft <= 7) {
                    upgradeBtn.style.display = 'inline-flex';
                    upgradeBtn.textContent = t(daysLeft <= 0 ? '重新订阅' : '申请续费');
                } else {
                    upgradeBtn.style.display = 'inline-flex';
                    upgradeBtn.textContent = t('当前为企业版');
                    upgradeBtn.disabled = true;
                }
            }
        }

        // 显示订阅过期时间（仅付费用户显示）
        const timingEl = document.getElementById('subscription-timing');
        const endDateEl = document.getElementById('end-date');
        if (timingEl && endDateEl) {
            if (subscription_tier && subscription_tier !== 'free' && subscription_end) {
                const formattedDate = formatDate(subscription_end);
                const endDate = new Date(subscription_end);
                const now = new Date();
                const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

                endDateEl.textContent = formattedDate;

                // 根据剩余天数设置颜色
                if (daysLeft <= 0) {
                    endDateEl.style.color = 'var(--supabase-danger)';
                } else if (daysLeft <= 3) {
                    endDateEl.style.color = '#f59e0b';
                } else {
                    endDateEl.style.color = 'var(--supabase-text-muted)';
                }

                timingEl.style.display = 'block';
            } else {
                timingEl.style.display = 'none';
            }
        }
    }

    /**
     * 获取订阅等级的显示名称
     * @param {string} tier - 订阅等级
     * @returns {string} 显示名称
     */
    function getTierDisplayName(tier) {
        const names = {
            'free': t('免费版'),
            'pro': t('专业版'),
            'max': t('企业版')
        };
        return names[tier] || t('免费版');
    }

    /**
     * 获取用户配额信息（只在登录时调用，或强制刷新）
     * @param {boolean} force - 是否强制刷新（忽略缓存）
     */
    async function fetchUserQuota(force = false) {
        if (!authState.session) {
            log('未登录，跳过获取配额', 'warn');
            return;
        }

        // 检查本地缓存
        const now = Date.now();
        const cacheKey = `quota_cache_${authState.session.user.id}`;
        const cacheData = sessionStorage.getItem(cacheKey);

        // 如果不是强制刷新，且有缓存且未过期（30秒），则使用缓存
        if (!force && cacheData) {
            try {
                const { quota, timestamp } = JSON.parse(cacheData);
                if (now - timestamp < 30000) { // 30秒缓存
                    updateQuota(quota);
                    log('使用缓存的配额信息', 'info');
                    return;
                }
            } catch (e) {
                // 忽略缓存解析错误，继续获取新数据
            }
        }

        try {
            const headers = {
                'Authorization': `Bearer ${authState.session.access_token}`
            };

            // 添加 If-None-Match 头（如果本地有 ETag）
            if (cacheData) {
                try {
                    const { etag } = JSON.parse(cacheData);
                    if (etag) {
                        headers['If-None-Match'] = etag;
                    }
                } catch (e) {
                    // 忽略
                }
            }

            const response = await fetch(`${APP_CONFIG.API_BASE}/api/user/quota`, {
                method: 'GET',
                headers
            });

            // 304 Not Modified - 使用缓存
            if (response.status === 304) {
                if (cacheData) {
                    const { quota } = JSON.parse(cacheData);
                    updateQuota(quota);
                    log('配额未变化，使用缓存', 'info');
                }
                return;
            }

            if (!response.ok) {
                throw new Error(`获取配额失败: ${response.status}`);
            }

            // 获取 ETag
            const etag = response.headers.get('ETag');

            const data = await response.json();

            if (data.quota) {
                if (data.user && authState.user) {
                    authState.user = {
                        ...authState.user,
                        user_metadata: {
                            ...(authState.user.user_metadata || {}),
                            company: data.user.company || authState.user.user_metadata?.company || ''
                        }
                    };
                    updateLoginStatus(authState.user);
                }
                // 包含 subscription_tier, subscription_start, subscription_end, auto_renew 字段
                updateQuota({
                    daily: data.quota.daily || 0,
                    used: data.quota.used || 0,
                    remaining: data.quota.remaining || 0,
                    subscription_tier: data.quota.subscription_tier || 'free',
                    subscription_start: data.quota.subscription_start || null,
                    subscription_end: data.quota.subscription_end || null,
                    auto_renew: data.quota.auto_renew || false
                });

                // 缓存配额数据
                const cacheToStore = {
                    quota: {
                        daily: data.quota.daily || 0,
                        used: data.quota.used || 0,
                        remaining: data.quota.remaining || 0,
                        subscription_tier: data.quota.subscription_tier || 'free',
                        subscription_start: data.quota.subscription_start || null,
                        subscription_end: data.quota.subscription_end || null,
                        auto_renew: data.quota.auto_renew || false
                    },
                    timestamp: now,
                    etag
                };
                sessionStorage.setItem(cacheKey, JSON.stringify(cacheToStore));

                log('配额信息获取成功', 'success');
            } else {
                log('配额数据格式错误', 'warn');
            }
        } catch (error) {
            log('获取配额失败: ' + error.message, 'error');
        }
    }

    /**
     * 从 API 响应中更新配额（由各页面调用）
     * @param {Object} quotaData - API 响应中的配额数据
     */
    function updateQuotaFromResponse(quotaData) {
        if (quotaData && typeof quotaData === 'object') {
            // 更新 UI
            updateQuota(quotaData);

            // 更新缓存
            const cacheKey = `quota_cache_${authState.session?.user?.id}`;
            if (cacheKey && authState.session) {
                const now = Date.now();
                const existingCache = sessionStorage.getItem(cacheKey);
                let etag = null;

                if (existingCache) {
                    try {
                        const parsed = JSON.parse(existingCache);
                        etag = parsed.etag;
                    } catch (e) {
                        // 忽略
                    }
                }

                const cacheToStore = {
                    quota: {
                        daily: quotaData.daily || 0,
                        used: quotaData.used || 0,
                        remaining: quotaData.remaining || 0,
                        subscription_tier: quotaData.subscription_tier || 'free',
                        subscription_start: quotaData.subscription_start || null,
                        subscription_end: quotaData.subscription_end || null,
                        auto_renew: quotaData.auto_renew || false
                    },
                    timestamp: now,
                    etag
                };
                sessionStorage.setItem(cacheKey, JSON.stringify(cacheToStore));
            }
        }
    }

    // ==================== 状态管理 ====================

    function updateLoginStatus(user) {
        const btn = document.getElementById('studio-account-button');
        const avatar = document.getElementById('studio-account-avatar');
        const accountLabel = document.getElementById('studio-account-label');
        const loginForm = document.getElementById('email-form');
        const logoutForm = document.getElementById('logout-form');

        if (user) {
            btn?.classList.add('logged-in');
            if (avatar) avatar.textContent = (user.email?.[0] || 'U').toUpperCase();
            if (accountLabel) accountLabel.textContent = user.email || t('账户');
            if (btn) {
                btn.title = i18n?.getLocale?.() === 'en' ? `Signed in: ${user.email}` : `已登录: ${user.email}`;
                btn.setAttribute('aria-label', t('查看账户状态'));
            }
            if (loginForm) loginForm.style.display = 'none';
            if (logoutForm) logoutForm.style.display = 'flex';
            document.getElementById('user-email').textContent = user.email;

            // 显示公司信息
            const companyEl = document.getElementById('user-company');
            const company = user.user_metadata?.company;
            const companyInput = document.getElementById('supabase-account-company');
            if (companyInput && document.activeElement !== companyInput) companyInput.value = company || '';
            if (company && companyEl) {
                companyEl.textContent = i18n?.getLocale?.() === 'en' ? `Company: ${company}` : `公司：${company}`;
                companyEl.style.display = 'block';
            } else if (companyEl) {
                companyEl.style.display = 'none';
            }

            // 初始化订阅等级徽章（如果已有配额数据则使用配额中的等级，否则使用默认）
            if (authState.quota && authState.quota.subscription_tier) {
                const tierBadge = document.getElementById('user-tier');
                if (tierBadge) {
                    tierBadge.textContent = getTierDisplayName(authState.quota.subscription_tier);
                    tierBadge.className = `supabase-tier-badge ${authState.quota.subscription_tier}`;
                }
            } else {
                // 默认显示免费版，直到获取到实际配额数据
                const tierBadge = document.getElementById('user-tier');
                if (tierBadge) {
                    tierBadge.textContent = t('免费版');
                    tierBadge.className = 'supabase-tier-badge free';
                }
            }

            setLoginStep(3);

            log('已登录: ' + user.email + (company ? ` (${company})` : ''));

            // 触发自定义事件，通知页面更新按钮状态
            window.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: { isLoggedIn: true, user }
            }));
        } else {
            btn?.classList.remove('logged-in');
            if (avatar) avatar.textContent = '👤';
            if (accountLabel) accountLabel.textContent = `${t('登录')} / ${t('注册')}`;
            if (btn) {
                btn.title = t('邮箱登录');
                btn.setAttribute('aria-label', t('打开登录窗口'));
            }
            if (loginForm) loginForm.style.display = 'block';
            if (logoutForm) logoutForm.style.display = 'none';
            setLoginStep(1);
            resetForms();

            log('未登录');

            // 触发自定义事件，通知页面更新按钮状态
            window.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: { isLoggedIn: false, user: null }
            }));
        }
    }

    /**
     * 切换升级模态框显示状态
     * @param {boolean} show - 是否显示
     */
    function toggleUpgradeModal(show) {
        const modal = document.getElementById('supabase-upgrade-modal');
        if (!modal) return;

        if (show) {
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('supabase-modal-open');
        } else {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('supabase-modal-open');

            // 清除状态提示
            const statusEl = document.getElementById('supabase-upgrade-status');
            if (statusEl) {
                statusEl.className = 'supabase-upgrade-status';
                statusEl.textContent = '';
            }
        }
    }

    /**
     * 处理套餐选择 - 发送邮件申请
     * @param {string} plan - 选择的套餐 (pro 或 max)
     */
    function handlePlanSelection(plan) {
        if (!authState.session || !authState.user) {
            alert('请先登录');
            return;
        }

        const userEmail = authState.user.email;
        const userId = authState.user.id;
        const tierName = getTierDisplayName(plan);
        const adminEmail = 'chicogong@tencent.com';
        // 获取用户已有的公司信息
        const company = authState.user.user_metadata?.company || '未填写';
        // 添加默认申请缘由
        const reason = '个人使用升级需求';
        // 获取当前等级
        const currentTier = authState.quota?.subscription_tier || 'free';
        const currentTierName = getTierDisplayName(currentTier);

        // 构建邮件内容
        const subject = `[升级申请] ${userEmail} 申请升级到 ${tierName}`;
        const body = `请帮忙升级我的账户：

用户ID：${userId}
用户邮箱：${userEmail}
公司名称：${company}
当前等级：${currentTierName}
申请等级：${tierName}
申请缘由：${reason}
申请时间：${new Date().toLocaleString()}

请帮我升级，谢谢！

此邮件由系统自动生成`;

        // 使用 mailto 打开邮件客户端
        const mailtoLink = `mailto:${adminEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        // 打开邮件应用
        window.location.href = mailtoLink;

        // 显示提示
        alert(`已为您打开邮件应用，请发送邮件到 ${adminEmail}\n\n发送后请等待审核，审核通过后会收到确认邮件。`);

        // 关闭模态框
        setTimeout(() => {
            toggleUpgradeModal(false);
        }, 500);
    }

    // ==================== 初始化 ====================

    async function init() {
        log('正在初始化...');

        try {
            await loadPublicConfig();
        } catch (error) {
            log('加载 Supabase 公开配置失败: ' + error.message, 'error');
            return;
        }

        if (!initSupabase()) {
            log('Supabase 初始化失败', 'error');
            return;
        }

        injectLoginUI();

        // 监听 Auth 状态变化
        authState.supabase.auth.onAuthStateChange(async (event, session) => {
            log(`状态变化: ${event}`);

            if (session?.user && !isEmailUser(session.user)) {
                log('检测到非邮箱账号，已拒绝该会话', 'warn');
                authState.session = null;
                authState.user = null;
                updateLoginStatus(null);
                await authState.supabase.auth.signOut({ scope: 'local' });
                showStatus('当前仅支持邮箱登录，请使用邮箱重新登录。', 'error');
                return;
            }

            authState.session = session;
            authState.user = session?.user || null;

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                updateLoginStatus(authState.user || session.user);

                // 获取用户配额信息
                fetchUserQuota();

                // 注意：authReady 事件将在 getSession() 检查后统一触发（避免重复）
            } else if (event === 'SIGNED_OUT') {
                updateLoginStatus(null);
            }
        });

        // 检查当前登录状态
        const { data: { session } } = await authState.supabase.auth.getSession();
        if (session?.user && !isEmailUser(session.user)) {
            await authState.supabase.auth.signOut({ scope: 'local' });
            authState.session = null;
            authState.user = null;
            updateLoginStatus(null);
        } else if (session?.user) {
            authState.session = session;
            authState.user = session.user;
            updateLoginStatus(session.user);

            // 获取用户配额信息
            fetchUserQuota();

            // 触发自定义事件，通知页面用户已登录
            window.dispatchEvent(new CustomEvent('authReady', {
                detail: { user: session.user }
            }));
        }

        log('初始化完成');
    }

    /**
     * 禁用/启用功能按钮（根据登录状态）
     * @param {Array<string>} buttonIds - 按钮 ID 数组
     * @param {boolean} isLoggedIn - 是否已登录
     */
    function updateFunctionButtonsState(buttonIds, isLoggedIn) {
        buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                if (!isLoggedIn) {
                    btn.disabled = true;
                    btn.title = t('请先登录以使用此功能');
                    btn.style.cursor = 'not-allowed';
                    btn.style.opacity = '0.6';
                } else {
                    btn.disabled = false;
                    btn.title = '';
                    btn.style.cursor = 'pointer';
                    btn.style.opacity = '1';
                }
            }
        });
    }

    window.addEventListener('localeChanged', () => {
        i18n?.apply?.(document);
        updateLoginStatus(authState.user);
        if (authState.quota) updateQuotaDisplay(authState.quota);
    });

    // ==================== 启动 ====================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 暴露全局接口（用于调试和页面集成）
    window.SupabaseAuthInject = {
        getState: () => authState,
        getSession: () => authState.session,
        getUser: () => authState.user,
        getQuota: () => authState.quota,               // 获取配额信息
        updateQuota: updateQuota,                     // 更新配额信息（从 API 响应）
        updateQuotaFromResponse: updateQuotaFromResponse, // 从 API 响应更新配额
        config: APP_CONFIG,                           // 暴露配置
        getSupabaseClient: () => authState.supabase,
        logout: logout,
        updateFunctionButtonsState: updateFunctionButtonsState // 功能按钮状态管理
    };

})();
