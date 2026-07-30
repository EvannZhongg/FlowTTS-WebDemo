/**
 * Supabase Auth 自动注入脚本 - 非侵入式邮箱登录
 *
 * @description
 * 无需修改现有代码，自动处理邮箱登录
 *
 * @usage
 * 1. 在 Supabase 创建项目，获取 URL 和 ANON_KEY
 * 2. 修改下方配置（SUPABASE_URL 和 SUPABASE_ANON_KEY）
 * 3. 在页面 <head> 中添加：
 *    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *    <script src="supabase-auth-inject.js"></script>
 *
 * @features
 * - 浮动登录按钮，独立于现有 UI
 * - Magic Link 无密码登录
 * - 登录状态持久化（localStorage）
 * - 自动刷新 Session
 * - 完全不侵入现有代码
 *
 * @version 2.0.0
 * @date 2025-11-04
 */

(function() {
    'use strict';

    // ==================== 配置（请修改为你的 Supabase 项目信息）====================

    const SUPABASE_URL = 'https://qcbmusynjrhkxvnosxab.supabase.co';  // Supabase 项目 URL
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjYm11c3luanJoa3h2bm9zeGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NDM2MzksImV4cCI6MjA3NDExOTYzOX0.8FTaqLib0DyFB-xU1vafXjTSsAE4svfrxNSNrA-tYaM';  // Supabase 匿名密钥


    // ==================== 应用配置 ====================

    const APP_CONFIG = {
        // API Server URL - 前后端同源，自动适配任意环境
        API_BASE: window.location.origin,

        // Supabase 配置
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,

        // 配额设置
        QUOTA: {
            DAILY_LIMIT: 10000,
            WARNING_THRESHOLD: 500
        },

        // 版本信息
        VERSION: '2.0.0',

        // 调试模式
        DEBUG: window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1',
        
        // Google OAuth Client ID (Required for One Tap)
        // TODO: Replace with your actual Client ID from Google Cloud Console
        GOOGLE_CLIENT_ID: '747933587228-0h677sv7suersloc2clu5grkg5bkf198.apps.googleusercontent.com' 
    };

    const LOGIN_BTN_POSITION_KEY = 'supabase_login_btn_position';
    const FIRST_TIME_GUIDE_SESSION_KEY = 'trtc_ai_first_time_guide_shown';

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

    // ==================== Supabase 初始化 ====================
    
    function initSupabase() {
        // 检查 Supabase SDK 是否已加载
        if (!window.supabase || !window.supabase.createClient) {
            log('未找到 Supabase SDK，请先引入脚本', 'error');
            return false;
        }

        try {
            authState.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            log('初始化成功');
            return true;
        } catch (error) {
            log('初始化失败: ' + error.message, 'error');
            return false;
        }
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    // 恢复上次拖拽位置
    function applySavedButtonPosition(btn) {
        const saved = localStorage.getItem(LOGIN_BTN_POSITION_KEY);
        if (!saved) return;

        try {
            const { left, top } = JSON.parse(saved);
            if (Number.isFinite(left) && Number.isFinite(top)) {
                const margin = 8;
                const maxLeft = Math.max(margin, window.innerWidth - btn.offsetWidth - margin);
                const maxTop = Math.max(margin, window.innerHeight - btn.offsetHeight - margin);
                const boundedLeft = clamp(left, margin, maxLeft);
                const boundedTop = clamp(top, margin, maxTop);

                btn.style.left = `${boundedLeft}px`;
                btn.style.top = `${boundedTop}px`;
                btn.style.right = 'auto';
                btn.style.bottom = 'auto';
            }
        } catch (e) {
            // 忽略无效数据
        }
    }

    // 允许拖拽浮动按钮
    function enableLoginButtonDrag(btn) {
        let dragging = false;
        let moved = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        const margin = 8;
        const touchMoveOpts = { passive: false };

        function onPointerDown(event) {
            const point = event.touches ? event.touches[0] : event;
            if (!point) return;
            dragging = true;
            moved = false;
            const rect = btn.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            startX = point.clientX;
            startY = point.clientY;

            btn.dataset.dragging = 'true';
            btn.style.left = `${rect.left}px`;
            btn.style.top = `${rect.top}px`;
            btn.style.right = 'auto';
            btn.style.bottom = 'auto';

            document.addEventListener('mousemove', onPointerMove);
            document.addEventListener('touchmove', onPointerMove, touchMoveOpts);
            document.addEventListener('mouseup', onPointerUp);
            document.addEventListener('touchend', onPointerUp);
        }

        function onPointerMove(event) {
            if (!dragging) return;
            const point = event.touches ? event.touches[0] : event;
            if (!point) return;
            event.preventDefault();

            const deltaX = point.clientX - startX;
            const deltaY = point.clientY - startY;
            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                moved = true;
            }

            const maxLeft = Math.max(margin, window.innerWidth - btn.offsetWidth - margin);
            const maxTop = Math.max(margin, window.innerHeight - btn.offsetHeight - margin);
            const nextLeft = clamp(startLeft + deltaX, margin, maxLeft);
            const nextTop = clamp(startTop + deltaY, margin, maxTop);

            btn.style.left = `${nextLeft}px`;
            btn.style.top = `${nextTop}px`;
        }

        function onPointerUp() {
            if (!dragging) return;
            dragging = false;

            document.removeEventListener('mousemove', onPointerMove);
            document.removeEventListener('touchmove', onPointerMove, touchMoveOpts);
            document.removeEventListener('mouseup', onPointerUp);
            document.removeEventListener('touchend', onPointerUp);

            const rect = btn.getBoundingClientRect();
            localStorage.setItem(LOGIN_BTN_POSITION_KEY, JSON.stringify({
                left: rect.left,
                top: rect.top
            }));

            if (moved) {
                btn.dataset.dragBlocked = '1';
                // 确保拖拽后不会误触发点击
                setTimeout(() => {
                    delete btn.dataset.dragBlocked;
                }, 0);
            }

            delete btn.dataset.dragging;
        }

        btn.addEventListener('mousedown', onPointerDown);
        btn.addEventListener('touchstart', onPointerDown);
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
            #supabase-login-btn {
                position: fixed;
                bottom: 24px;
                right: 24px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 0 12px;
                height: 42px;
                min-width: 96px;  /* 确保按钮有最小宽度 */
                border-radius: 12px;
                background: var(--supabase-surface);
                color: var(--supabase-text);
                border: 1px solid var(--supabase-border);
                font-size: 14px;
                font-weight: 600;
                letter-spacing: 0.1px;
                box-shadow: 0 12px 20px rgba(15, 23, 42, 0.12);
                cursor: grab;
                user-select: none;
                z-index: 9999;
                transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
                backdrop-filter: blur(6px);
            }
            #supabase-login-btn:active {
                cursor: grabbing;
            }
            #supabase-login-btn.compact {
                gap: 6px;
                padding: 0 10px;
                min-width: 88px;
                height: 40px;
                border-radius: 11px;
            }
            #supabase-login-btn .quota-chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 5px 9px;
                border-radius: 999px;
                background: rgba(45, 164, 78, 0.14);
                color: #1b7d34;
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                letter-spacing: 0.2px;
            }
            #supabase-login-btn.logged-in {
                background: rgba(45, 164, 78, 0.12);
                border-color: rgba(45, 164, 78, 0.35);
                color: #1b7d34;
                box-shadow: 0 12px 20px rgba(45, 164, 78, 0.15);
            }
            #supabase-login-btn:hover {
                transform: translateY(-2px);
                background: rgba(15, 23, 42, 0.04);
                border-color: rgba(15, 23, 42, 0.18);
                box-shadow: 0 16px 24px rgba(15, 23, 42, 0.16);
            }
            body.dark #supabase-login-btn {
                background: rgba(30, 41, 59, 0.85);
                color: #e2e8f0;
                border-color: rgba(148, 163, 184, 0.18);
                box-shadow: 0 12px 22px rgba(0, 0, 0, 0.35);
            }
            body.dark #supabase-login-btn:hover {
                background: rgba(51, 65, 85, 0.9);
                border-color: rgba(148, 163, 184, 0.28);
            }
            /* 呼吸动画（未登录时） */
            @keyframes breathe {
                0%, 100% {
                    box-shadow: 0 12px 20px rgba(15, 23, 42, 0.12), 0 0 0 0 rgba(31, 111, 235, 0.4);
                }
                50% {
                    box-shadow: 0 12px 20px rgba(15, 23, 42, 0.12), 0 0 0 10px rgba(31, 111, 235, 0);
                }
            }
            #supabase-login-btn:not(.logged-in) {
                animation: breathe 2s ease-in-out infinite;
            }
            #supabase-login-btn .supabase-login-icon {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #dff8ed 0%, #9be6c4 100%);
                color: #166534;
                font-size: 16px;
                line-height: 1;
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2), 0 6px 14px rgba(34, 197, 94, 0.16);
            }
            #supabase-login-btn .btn-label {
                font-size: 14px;
                font-weight: 600;
                white-space: nowrap;
            }
            body.dark #supabase-login-btn.logged-in {
                background: rgba(34, 197, 94, 0.18);
                border-color: rgba(34, 197, 94, 0.4);
                color: #bbf7d0;
            }
            body.dark #supabase-login-btn .supabase-login-icon {
                background: linear-gradient(135deg, #0c3b2d 0%, #19935f 100%);
                color: #bbf7d0;
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 6px 14px rgba(34, 197, 94, 0.22);
            }
            body.dark #supabase-login-btn .quota-chip {
                background: rgba(34, 197, 94, 0.16);
                color: #bbf7d0;
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
                display: flex;
                align-items: center;
                gap: 0;
            }
            .supabase-step {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 10px;
                position: relative;
                padding-right: 18px;
                color: var(--supabase-text-muted);
                font-size: 12px;
                letter-spacing: 0.5px;
            }
            .supabase-step:last-child {
                padding-right: 0;
            }
            .supabase-step::after {
                content: '';
                position: absolute;
                top: 50%;
                right: 0;
                width: calc(100% - 44px);
                height: 2px;
                background: rgba(148, 163, 184, 0.2);
                transform: translateY(-50%);
            }
            .supabase-step:last-child::after {
                display: none;
            }
            .supabase-step .dot {
                width: 26px;
                height: 26px;
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
                font-size: 12px;
                font-weight: 600;
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
                margin-top: 28px;
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
            #supabase-otp {
                text-align: center;
                letter-spacing: 6px;
                font-size: 22px;
                font-weight: 700;
                font-family: "SFMono-Regular", Menlo, Consolas, "Courier New", monospace;
            }
            .supabase-input-group input.error-border {
                border: 2px solid rgba(220, 38, 38, 0.7) !important;
                background: rgba(254, 226, 226, 0.6);
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
            .supabase-btn.subtle {
                background: rgba(15, 23, 42, 0.04);
                color: var(--supabase-text);
            }
            .supabase-btn.subtle:hover:not(:disabled) {
                background: rgba(15, 23, 42, 0.08);
                border-color: rgba(15, 23, 42, 0.15);
            }
            body.dark .supabase-btn.subtle {
                background: rgba(148, 163, 184, 0.08);
                border-color: rgba(148, 163, 184, 0.18);
                color: #e2e8f0;
            }
            body.dark .supabase-btn.subtle:hover:not(:disabled) {
                background: rgba(148, 163, 184, 0.16);
                border-color: rgba(148, 163, 184, 0.3);
            }
            .supabase-btn.danger {
                background: rgba(220, 38, 38, 0.08);
                border-color: rgba(220, 38, 38, 0.24);
                color: #b91c1c;
            }
            .supabase-btn.danger:hover:not(:disabled) {
                background: rgba(220, 38, 38, 0.15);
                border-color: rgba(220, 38, 38, 0.35);
            }
            body.dark .supabase-btn.danger {
                background: rgba(248, 113, 113, 0.14);
                border-color: rgba(248, 113, 113, 0.32);
                color: #fca5a5;
            }
            body.dark .supabase-btn.danger:hover:not(:disabled) {
                background: rgba(248, 113, 113, 0.24);
                border-color: rgba(248, 113, 113, 0.45);
            }
            .supabase-inline-actions {
                display: flex;
                gap: 12px;
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
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                20%, 60% { transform: translateX(-6px); }
                40%, 80% { transform: translateX(6px); }
            }
            .shake {
                animation: shake 0.4s;
            }
            /* 未登录横幅提示 */
            .auth-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                border-bottom: 1px solid #90caf9;
                padding: 12px 24px;
                z-index: 9998;
                animation: slideDown 0.3s ease;
                box-shadow: 0 2px 8px rgba(31, 111, 235, 0.1);
            }
            body.dark .auth-banner {
                background: linear-gradient(135deg, rgba(31, 111, 235, 0.15) 0%, rgba(31, 111, 235, 0.25) 100%);
                border-bottom-color: rgba(31, 111, 235, 0.3);
            }
            .banner-content {
                display: flex;
                align-items: center;
                gap: 12px;
                max-width: 1120px;
                margin: 0 auto;
            }
            .banner-icon {
                font-size: 20px;
                flex-shrink: 0;
            }
            .banner-text {
                flex: 1;
                font-size: 14px;
                color: #1565c0;
                line-height: 1.5;
            }
            body.dark .banner-text {
                color: #93c5fd;
            }
            .banner-text strong {
                font-weight: 700;
                color: #0d47a1;
            }
            body.dark .banner-text strong {
                color: #bfdbfe;
            }
            .banner-close {
                background: transparent;
                border: none;
                color: #1565c0;
                cursor: pointer;
                font-size: 18px;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s ease;
                flex-shrink: 0;
            }
            .banner-close:hover {
                background: rgba(31, 111, 235, 0.15);
            }
            body.dark .banner-close {
                color: #93c5fd;
            }
            body.dark .banner-close:hover {
                background: rgba(31, 111, 235, 0.3);
            }
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            /* 首次访问引导遮罩 */
            #guide-overlay {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.75);
                backdrop-filter: blur(3px);
                z-index: 10002;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .guide-content {
                position: relative;
                background: var(--supabase-surface);
                border-radius: 18px;
                padding: 32px;
                max-width: 420px;
                text-align: center;
                box-shadow: 0 30px 60px rgba(15, 23, 42, 0.3);
                animation: scaleIn 0.3s ease;
            }
            @keyframes scaleIn {
                from {
                    transform: scale(0.9);
                    opacity: 0;
                }
                to {
                    transform: scale(1);
                    opacity: 1;
                }
            }
            .guide-content h3 {
                margin: 0 0 16px;
                font-size: 24px;
                font-weight: 700;
                color: var(--supabase-text);
            }
            .guide-content p {
                margin: 0 0 12px;
                font-size: 15px;
                color: var(--supabase-text-muted);
                line-height: 1.6;
            }
            .guide-content p:last-of-type {
                margin-bottom: 24px;
            }
            .guide-content button {
                width: 100%;
                padding: 12px 24px;
                background: var(--supabase-primary);
                border: none;
                border-radius: 12px;
                color: #ffffff;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .guide-content button:hover {
                background: var(--supabase-primary-dark);
                transform: translateY(-1px);
            }
            #supabase-login-btn.guide-highlight {
                z-index: 10003;
                box-shadow: 0 0 0 4px rgba(31, 111, 235, 0.4), 0 12px 24px rgba(31, 111, 235, 0.3);
                animation: pulse 1.5s ease-in-out infinite;
            }
            @keyframes pulse {
                0%, 100% {
                    transform: scale(1);
                    box-shadow: 0 0 0 4px rgba(31, 111, 235, 0.4), 0 12px 24px rgba(31, 111, 235, 0.3);
                }
                50% {
                    transform: scale(1.05);
                    box-shadow: 0 0 0 8px rgba(31, 111, 235, 0.2), 0 16px 32px rgba(31, 111, 235, 0.4);
                }
            }
            @media (max-width: 640px) {
                #supabase-login-btn {
                    height: 52px;
                    padding: 0 10px;
                    gap: 8px;
                    min-width: 120px;
                }
                #supabase-login-btn .supabase-login-icon {
                    width: 26px;
                    height: 26px;
                }
                #supabase-login-btn .quota-chip {
                    display: inline-flex;
                    font-size: 12px;
                    padding: 5px 8px;
                    gap: 6px;
                }
                .supabase-modal-content {
                    padding: 24px 20px 28px;
                }
                .supabase-modal-header h2 {
                    font-size: 20px;
                }
                .supabase-stepper {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                .supabase-step {
                    padding-right: 0;
                }
                .supabase-step::after {
                    display: none;
                }
                .supabase-inline-actions {
                    flex-direction: column;
                }
                .pricing-plans {
                    grid-template-columns: 1fr;
                    gap: 12px;
                }
                .plan-card {
                    padding: 16px;
                }
            }
            
            /* Google OAuth UI */
            .supabase-divider {
                display: flex;
                align-items: center;
                text-align: center;
                margin: 20px 0;
                color: var(--supabase-text-muted);
                font-size: 13px;
            }
            .supabase-divider::before,
            .supabase-divider::after {
                content: '';
                flex: 1;
                border-bottom: 1px solid var(--supabase-border);
            }
            .supabase-divider span {
                padding: 0 10px;
            }
            .supabase-google-btn {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                background: #ffffff;
                color: #3c4043;
                border: 1px solid #dadce0;
                border-radius: 12px;
                padding: 10px 16px;
                font-size: 15px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                margin-top: 0; 
                position: relative;
            }
            body.dark .supabase-google-btn {
                background: #1e293b;
                color: #e2e8f0;
                border-color: #475569;
            }
            .supabase-google-btn:hover {
                background: #f8fafb;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                border-color: #d2e3fc;
                transform: translateY(-1px);
            }
            body.dark .supabase-google-btn:hover {
                 background: #334155;
                 border-color: #64748b;
            }
            .supabase-google-btn svg {
                width: 20px;
                height: 20px;
            }
        `;
        document.head.appendChild(style);

        // 未登录横幅提示
        const banner = document.createElement('div');
        banner.className = 'auth-banner';
        banner.id = 'auth-banner';
        banner.style.display = 'none'; // 默认隐藏，由 updateLoginStatus 控制
        banner.innerHTML = `
            <div class="banner-content">
                <span class="banner-icon">ℹ️</span>
                <span class="banner-text">
                    您当前未登录，请点击右下角 <strong>👤 登录</strong> 按钮，立即获取 100 次免费配额
                </span>
                <button class="banner-close" id="banner-close" aria-label="关闭提示">✕</button>
            </div>
        `;
        document.body.insertBefore(banner, document.body.firstChild);

        // 横幅关闭事件
        document.getElementById('banner-close').addEventListener('click', () => {
            banner.style.display = 'none';
            // 记录用户已关闭横幅（可选：设置过期时间，例如1天后再显示）
            sessionStorage.setItem('auth_banner_closed', Date.now());
        });

        // 登录按钮
        const btn = document.createElement('div');
        btn.id = 'supabase-login-btn';
        btn.innerHTML = `
            <span class="supabase-login-icon" aria-hidden="true">👤</span>
            <span class="btn-label">登录</span>
        `;
        btn.title = '邮箱登录';
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.setAttribute('aria-label', '打开登录窗口');
        btn.setAttribute('aria-haspopup', 'dialog');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', 'supabase-login-modal');
        btn.addEventListener('click', (event) => {
            if (btn.dataset.dragBlocked === '1') {
                event.preventDefault();
                return;
            }
            const modalEl = document.getElementById('supabase-login-modal');
            if (modalEl?.classList.contains('show')) {
                toggleModal(false);
            } else {
                toggleModal(true);
            }
        });
        btn.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const modalEl = document.getElementById('supabase-login-modal');
                if (modalEl?.classList.contains('show')) {
                    toggleModal(false);
                } else {
                    toggleModal(true);
                }
            }
        });
        document.body.appendChild(btn);

        // 恢复位置并开启拖拽
        applySavedButtonPosition(btn);
        enableLoginButtonDrag(btn);

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
                        <p class="supabase-modal-desc">使用邮箱验证码安全登录，个人配置将与账号保持同步。</p>
                    </div>
                    <button type="button" class="supabase-close-btn" id="supabase-close-modal" aria-label="关闭登录窗口">✕</button>
                </div>
                <div class="supabase-stepper" id="supabase-stepper">
                    <div class="supabase-step" data-step="1" data-state="active">
                        <span class="dot">1</span>
                        <span class="label">验证邮箱</span>
                    </div>
                    <div class="supabase-step" data-step="2" data-state="pending">
                        <span class="dot">2</span>
                        <span class="label">输入验证码</span>
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
                            <input type="text" id="supabase-company" placeholder="方便我们更好地为你服务" autocomplete="organization" />
                        </div>
                        <button class="supabase-btn primary" id="supabase-send-otp">发送验证码</button>
                        
                        <!-- Google OAuth -->
                        <div class="supabase-divider"><span>或者</span></div>
                        <button class="supabase-google-btn" id="supabase-google-login">
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span>Google 账号登录</span>
                        </button>

                        <div class="supabase-status" id="supabase-status"></div>
                    </div>
                    <div id="otp-form" class="supabase-form-step" style="display:none;">
                        <p class="supabase-helper">验证码已发送至 <strong id="verify-email"></strong></p>
                        <div class="supabase-input-group">
                            <label for="supabase-otp">验证码</label>
                            <input type="text" id="supabase-otp" placeholder="123456" maxlength="6" inputmode="numeric" autocomplete="one-time-code" />
                        </div>
                        <button class="supabase-btn primary" id="supabase-verify-otp">验证并登录</button>
                        <div class="supabase-inline-actions">
                            <button class="supabase-btn subtle" id="supabase-resend-otp" disabled>60 秒后可重发</button>
                            <button class="supabase-btn danger" id="supabase-cancel-otp">取消</button>
                        </div>
                        <div class="supabase-status" id="supabase-otp-status"></div>
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
                        <div class="supabase-quota-section" id="quota-section">
                            <div class="quota-header">
                                <span class="quota-title">今日配额</span>
                                <span class="quota-count" id="quota-count">0 / 100</span>
                            </div>
                            <div class="quota-progress">
                                <div class="quota-bar" id="quota-bar" style="width: 0%"></div>
                            </div>
                            <div class="quota-footer">
                                <span class="quota-remaining" id="quota-remaining">剩余 100</span>
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

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) toggleModal(false);
        });

        document.getElementById('supabase-close-modal').addEventListener('click', () => toggleModal(false));

        // 绑定事件
        document.getElementById('supabase-send-otp').addEventListener('click', sendOtp);
        document.getElementById('supabase-google-login').addEventListener('click', signInWithGoogle); // Google Login Binding
        document.getElementById('supabase-verify-otp').addEventListener('click', verifyOtp);
        document.getElementById('supabase-resend-otp').addEventListener('click', sendOtp);
        document.getElementById('supabase-cancel-otp').addEventListener('click', cancelVerification);
        document.getElementById('supabase-logout').addEventListener('click', logout);
        document.getElementById('supabase-email').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendOtp();
        });
        document.getElementById('supabase-otp').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') verifyOtp();
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
        
        // Initialize Google One Tap if Client ID is configured
        if (APP_CONFIG.GOOGLE_CLIENT_ID) {
            initGoogleOneTap();
        }
        
        log('UI 已注入');
    }

    // ==================== Google One Tap ====================

    // Nonce for Google One Tap ↔ Supabase signInWithIdToken pairing
    let _googleOneTapNonce = null;

    // Generate a random nonce string
    function generateNonce() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }

    // SHA-256 hash (Google One Tap expects hashed nonce)
    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
    }

    function initGoogleOneTap() {
        if (!authState.supabase) return;

        // Check if user is already logged in
        authState.supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session) return; // User already logged in

            // Generate nonce pair: raw for Supabase, hashed for Google
            _googleOneTapNonce = generateNonce();
            const hashedNonce = await sha256(_googleOneTapNonce);

            // Load Google Script
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                try {
                    // Initialize One Tap with hashed nonce
                    window.google.accounts.id.initialize({
                        client_id: APP_CONFIG.GOOGLE_CLIENT_ID,
                        callback: handleGoogleCredentialResponse,
                        nonce: hashedNonce,
                        cancel_on_tap_outside: false,
                        context: 'signin',
                        ux_mode: 'popup',
                        use_fedcm_for_prompt: false // Revert to false to fix localhost "unknown_reason" skip
                    });

                    // Prompt
                    window.google.accounts.id.prompt((notification) => {
                        if (notification.isNotDisplayed()) {
                            console.warn('[Supabase Auth] Google One Tap not displayed. Reason:', notification.getNotDisplayedReason());
                            log('Google One Tap hidden: ' + notification.getNotDisplayedReason(), 'warn');
                        } else if (notification.isSkippedMoment()) {
                            console.warn('[Supabase Auth] Google One Tap authentication skipped. Reason:', notification.getSkippedReason());
                            log('Google One Tap skipped: ' + notification.getSkippedReason(), 'warn');
                        }
                    });
                } catch (e) {
                    log('Google One Tap initialization failed: ' + e.message, 'error');
                }
            };
            document.head.appendChild(script);
        });
    }

    async function handleGoogleCredentialResponse(response) {
        log('Google One Tap credential received');
        
        try {
            // Pass the raw nonce to Supabase for verification against the hashed nonce in id_token
            const { data, error } = await authState.supabase.auth.signInWithIdToken({
                provider: 'google',
                token: response.credential,
                nonce: _googleOneTapNonce,
            });

            if (error) throw error;

            log('Google One Tap login successful');
            showStatus('登录成功！正在跳转...', 'success');
            
            // Auto-refresh state will handle the UI update via onAuthStateChange
            
        } catch (error) {
            log('Google One Tap login error: ' + error.message, 'error');
            showStatus('Google 登录失败: ' + error.message, 'error');
        }
    }

    function toggleModal(force) {
        const modal = document.getElementById('supabase-login-modal');
        if (!modal) return;

        const shouldShow = typeof force === 'boolean' ? force : !modal.classList.contains('show');
        const loginBtn = document.getElementById('supabase-login-btn');

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

        const otpForm = document.getElementById('otp-form');
        if (otpForm && otpForm.style.display !== 'none') {
            document.getElementById('supabase-otp')?.focus();
            return;
        }

        document.getElementById('supabase-email')?.focus();
    }

    // ==================== 登录逻辑 ====================

    let verificationEmail = null;  // 记录正在验证的邮箱
    let countdownTimer = null;     // 倒计时定时器

    // Google OAuth 登录
    async function signInWithGoogle() {
        const btn = document.getElementById('supabase-google-login');
        if (!btn) return;
        
        const originalContent = btn.innerHTML;
        
        try {
            btn.disabled = true;
            btn.innerHTML = `
                <span style="display:inline-block; animation:spin 1s linear infinite; margin-right:8px">⏳</span> 
                正在跳转...
            `;
            // 添加简单的旋转动画样式
            if (!document.getElementById('spin-style')) {
                const s = document.createElement('style');
                s.id = 'spin-style';
                s.textContent = '@keyframes spin { 100% { transform: rotate(360deg); } }';
                document.head.appendChild(s);
            }
            
            // 获取当前完整 URL 用于回调（保留 query 参数，如 cli-auth 的 state/callback_port）
            const redirectTo = window.location.origin + window.location.pathname + window.location.search;
            
            const { data, error } = await authState.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectTo,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                }
            });

            if (error) throw error;
            
            // OAuth 会重定向页面
            
        } catch (error) {
            showStatus('Google 登录失败: ' + error.message, 'error');
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }

    // 发送验证码
    async function sendOtp() {
        const emailInput = document.getElementById('supabase-email');
        const companyInput = document.getElementById('supabase-company');
        const btn = document.getElementById('supabase-send-otp');
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
                    data: {
                        company: company,
                        full_name: company,  // 同步到 Display name
                        registered_at: new Date().toISOString()
                    }
                }
            });

            if (error) throw error;

            // 保存邮箱和公司信息
            verificationEmail = email;
            if (company) {
                sessionStorage.setItem('pending_company_update', company);
            }

            // 切换到验证码输入界面
            document.getElementById('email-form').style.display = 'none';
            document.getElementById('otp-form').style.display = 'block';
            document.getElementById('verify-email').textContent = email;
            setLoginStep(2);
            showOtpStatus('验证码已发送，请查收邮箱。', 'success');

            // 自动聚焦到验证码输入框
            setTimeout(() => {
                document.getElementById('supabase-otp').focus();
            }, 100);

            // 开始倒计时
            startCountdown(60);

            log('验证码已发送到: ' + email);
        } catch (error) {
            showStatus('❌ 发送失败: ' + error.message, 'error');
            log('发送验证码失败: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '发送验证码';
        }
    }

    // 验证验证码并登录
    async function verifyOtp() {
        const otpInput = document.getElementById('supabase-otp');
        const btn = document.getElementById('supabase-verify-otp');
        const token = otpInput.value.trim();

        if (token.length !== 6) {
            showOtpStatus('请输入 6 位验证码', 'error');
            return;
        }

        if (!verificationEmail) {
            showOtpStatus('错误：未找到邮箱信息', 'error');
            return;
        }

        try {
            btn.disabled = true;
            btn.textContent = '验证中...';

            const { data, error } = await authState.supabase.auth.verifyOtp({
                email: verificationEmail,
                token: token,
                type: 'email'
            });

            if (error) throw error;

            if (data.session) {
                showOtpStatus('✅ 登录成功！', 'success');
                log('登录成功: ' + verificationEmail);
                setLoginStep(3);

                // 延迟关闭弹窗，让用户看到成功提示
                setTimeout(() => {
                    toggleModal();
                    // 重置表单
                    resetForms();
                    btn.disabled = false;
                    btn.textContent = '验证并登录';
                }, 1000);
            } else {
                throw new Error('登录失败：未返回会话信息');
            }
        } catch (error) {
            const errorStr = error.message.toLowerCase();
            let errorMsg = '验证失败';

            // 调试日志：记录原始错误消息
            console.log('[Supabase Auth] 原始错误:', error.message);
            log('验证失败原因: ' + error.message, 'error');

            // 精确匹配错误类型
            if (errorStr.includes('invalid') || errorStr.includes('incorrect')) {
                errorMsg = '❌ 验证码错误，请检查后重新输入';
            } else if (errorStr.includes('expired') || errorStr.includes('expire')) {
                errorMsg = '⏰ 验证码已过期，请点击"重新发送"';
            } else if (errorStr.includes('too many') || errorStr.includes('rate limit')) {
                errorMsg = '⚠️ 尝试次数过多，请稍后再试';
            } else if (errorStr.includes('not found')) {
                errorMsg = '❌ 验证码不存在或已使用';
            } else {
                // 其他错误显示简化消息
                errorMsg = '❌ 验证失败，请重试';
            }

            showOtpStatus(errorMsg, 'error');

            // 添加抖动动画和红色边框
            const otpInput = document.getElementById('supabase-otp');
            otpInput.classList.add('shake', 'error-border');
            setTimeout(() => {
                otpInput.classList.remove('shake', 'error-border');
            }, 500);

            btn.disabled = false;
            btn.textContent = '验证并登录';
        }
    }

    // 倒计时功能
    function startCountdown(seconds) {
        const btn = document.getElementById('supabase-resend-otp');
        if (!btn) return;

        btn.disabled = true;

        let remaining = seconds;

        // 清除之前的定时器
        if (countdownTimer) {
            clearInterval(countdownTimer);
        }

        countdownTimer = setInterval(() => {
            btn.textContent = `${remaining} 秒后可重发`;
            remaining--;

            if (remaining < 0) {
                clearInterval(countdownTimer);
                btn.disabled = false;
                btn.textContent = '重新发送';
            }
        }, 1000);
    }

    // 取消验证
    function cancelVerification() {
        resetForms();
        const emailForm = document.getElementById('email-form');
        const otpForm = document.getElementById('otp-form');
        if (emailForm) emailForm.style.display = 'block';
        if (otpForm) otpForm.style.display = 'none';
        setLoginStep(1);

        // 清除倒计时
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }

        const resendBtn = document.getElementById('supabase-resend-otp');
        if (resendBtn) {
            resendBtn.disabled = true;
            resendBtn.textContent = '60 秒后可重发';
        }

        verificationEmail = null;
        log('取消验证');
        focusLoginField();
    }

    // 重置表单
    function resetForms() {
        const emailInput = document.getElementById('supabase-email');
        const companyInput = document.getElementById('supabase-company');
        const otpInput = document.getElementById('supabase-otp');
        const status = document.getElementById('supabase-status');
        const otpStatus = document.getElementById('supabase-otp-status');
        const verifyEmailLabel = document.getElementById('verify-email');

        if (emailInput) emailInput.value = '';
        if (companyInput) companyInput.value = '';
        if (otpInput) {
            otpInput.value = '';
            otpInput.classList.remove('shake', 'error-border');
        }
        if (status) {
            status.className = 'supabase-status';
            status.textContent = '';
        }
        if (otpStatus) {
            otpStatus.className = 'supabase-status';
            otpStatus.textContent = '';
        }
        if (verifyEmailLabel) {
            verifyEmailLabel.textContent = '';
        }
        const resendBtn = document.getElementById('supabase-resend-otp');
        if (resendBtn) {
            resendBtn.disabled = true;
            resendBtn.textContent = '60 秒后可重发';
        }
    }

    // 显示验证码状态
    function showOtpStatus(message, type = 'success') {
        const status = document.getElementById('supabase-otp-status');
        status.textContent = message;
        status.className = `supabase-status ${type}`;
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
        if (!dateStr) return '无';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffTime = date - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                return '已过期';
            } else if (diffDays === 0) {
                return '今天到期';
            } else if (diffDays === 1) {
                return '明天到期';
            } else if (diffDays <= 7) {
                return `${diffDays}天后到期`;
            } else {
                return date.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            }
        } catch (error) {
            return '无效日期';
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

        // 更新登录按钮文字（显示配额）
        const btn = document.getElementById('supabase-login-btn');
        if (btn && authState.user) {
            const labelHtml = getLoginButtonLabel(authState.user, quotaData);
            btn.classList.add('compact');
            btn.innerHTML = `
                <span class="supabase-login-icon" aria-hidden="true">👤</span>
                <span class="quota-chip">${labelHtml}</span>
            `;
        }

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
            remainingEl.textContent = `剩余 ${remaining}`;
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
                upgradeBtn.textContent = '升级';
            } else if (subscription_tier === 'pro') {
                // 专业版用户可以升级到企业版
                upgradeBtn.style.display = 'inline-flex';
                upgradeBtn.textContent = '升级到企业版';
            } else if (subscription_tier === 'max') {
                // 企业版用户显示续费或隐藏
                const endDate = subscription_end ? new Date(subscription_end) : null;
                const now = new Date();
                const daysLeft = endDate ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)) : null;

                if (daysLeft !== null && daysLeft <= 7) {
                    upgradeBtn.style.display = 'inline-flex';
                    upgradeBtn.textContent = daysLeft <= 0 ? '重新订阅' : '申请续费';
                } else {
                    upgradeBtn.style.display = 'inline-flex';
                    upgradeBtn.textContent = '当前为企业版';
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
            'free': '免费版',
            'pro': '专业版',
            'max': '企业版'
        };
        return names[tier] || '免费版';
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

    /**
     * 获取登录按钮的标签文本（包含配额）
     * @param {Object} user - 用户信息
     * @param {Object} quota - 配额信息
     * @returns {string} 格式化的按钮标签
     */
    function getLoginButtonLabel(user, quota) {
        if (!user) {
            return '登录';
        }

        if (quota && quota.daily > 0) {
            const { used, daily } = quota;
            return `${used}/${daily}`;
        }

        return '账户';
    }

    function updateLoginStatus(user) {
        const btn = document.getElementById('supabase-login-btn');
        const loginForm = document.getElementById('email-form');
        const otpForm = document.getElementById('otp-form');
        const logoutForm = document.getElementById('logout-form');
        const banner = document.getElementById('auth-banner');

        if (user) {
            // 已登录：隐藏横幅
            if (banner) {
                banner.style.display = 'none';
            }
            btn.classList.add('logged-in', 'compact');
            const labelHtml = getLoginButtonLabel(user, authState.quota);
            btn.innerHTML = `
                <span class="supabase-login-icon" aria-hidden="true">👤</span>
                <span class="quota-chip">${labelHtml}</span>
            `;
            btn.title = `已登录: ${user.email}`;
            btn.setAttribute('aria-label', '查看账户状态');
            if (loginForm) loginForm.style.display = 'none';
            if (otpForm) otpForm.style.display = 'none';
            if (logoutForm) logoutForm.style.display = 'flex';
            document.getElementById('user-email').textContent = user.email;

            // 显示公司信息
            const companyEl = document.getElementById('user-company');
            const company = user.user_metadata?.company;
            if (company && companyEl) {
                companyEl.textContent = `公司：${company}`;
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
                    tierBadge.textContent = '免费版';
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
            // 未登录：显示横幅（检查用户是否手动关闭过）
            if (banner) {
                const bannerClosed = sessionStorage.getItem('auth_banner_closed');
                const now = Date.now();
                // 如果用户关闭横幅后超过1小时（3600000ms），重新显示
                if (!bannerClosed || (now - parseInt(bannerClosed)) > 3600000) {
                    banner.style.display = 'block';
                }
            }

            btn.classList.remove('logged-in');
            btn.classList.remove('compact');
            btn.innerHTML = `
                <span class="supabase-login-icon" aria-hidden="true">👤</span>
                <span class="btn-label" style="margin-left: 8px;">登录</span>
            `;
            btn.title = '邮箱登录';
            btn.setAttribute('aria-label', '打开登录窗口');
            if (loginForm) loginForm.style.display = 'block';
            if (otpForm) otpForm.style.display = 'none';
            if (logoutForm) logoutForm.style.display = 'none';
            setLoginStep(1);
            verificationEmail = null;
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

        // 检查配置
        if (SUPABASE_URL.includes('your-project') || SUPABASE_ANON_KEY.includes('your-anon-key')) {
            log('请先配置 SUPABASE_URL 和 SUPABASE_ANON_KEY', 'error');
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

            authState.session = session;
            authState.user = session?.user || null;

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                // 如果有待更新的公司信息，更新 user_metadata
                const pendingCompany = sessionStorage.getItem('pending_company_update');

                if (pendingCompany && session?.user) {
                    const currentCompany = session.user.user_metadata?.company;

                    // 如果公司信息不存在或不同，则更新
                    if (!currentCompany || currentCompany !== pendingCompany) {
                        try {
                            const { error } = await authState.supabase.auth.updateUser({
                                data: {
                                    company: pendingCompany,
                                    full_name: pendingCompany,  // 同步到 Display name，便于 Dashboard 查看
                                    updated_at: new Date().toISOString()
                                }
                            });

                            if (error) {
                                log('更新公司信息失败: ' + error.message, 'error');
                            } else {
                                log(`公司信息已更新: ${pendingCompany}`);
                                // 刷新用户信息以获取最新的 metadata
                                const { data: { user } } = await authState.supabase.auth.getUser();
                                authState.user = user;
                            }
                        } catch (err) {
                            log('更新公司信息异常: ' + err.message, 'warn');
                        }
                    }
                    // 无论成功或失败，都清除 pending 状态
                    sessionStorage.removeItem('pending_company_update');
                }

                updateLoginStatus(authState.user || session.user);

                // 获取用户配额信息
                fetchUserQuota();

                // 注意：authReady 事件将在 getSession() 检查后统一触发（避免重复）
            } else if (event === 'SIGNED_OUT') {
                updateLoginStatus(null);
                sessionStorage.removeItem('pending_company_update');
            }
        });

        // 检查当前登录状态
        const { data: { session } } = await authState.supabase.auth.getSession();
        if (session?.user) {
            authState.session = session;
            authState.user = session.user;
            updateLoginStatus(session.user);

            // 获取用户配额信息
            fetchUserQuota();

            // 触发自定义事件，通知页面用户已登录
            window.dispatchEvent(new CustomEvent('authReady', {
                detail: { user: session.user }
            }));
        } else {
            // 未登录时，仅在本次浏览会话首次进入首页时显示引导。
            showFirstTimeGuide();
        }

        log('初始化完成');
    }

    // ==================== 首次访问引导 ====================

    /**
     * 显示登录引导遮罩。
     * 仅在首页显示，并且同一浏览器标签页会话中最多显示一次，
     * 避免用户切换到 TTS、声音克隆、音色库等页面时重复弹出。
     */
    function showFirstTimeGuide() {
        const session = window.SupabaseAuthInject?.getSession();
        if (session) return; // 已登录用户不显示

        const isHomePage = document.body?.dataset?.page === 'home';
        if (!isHomePage) return;

        if (sessionStorage.getItem(FIRST_TIME_GUIDE_SESSION_KEY) === '1') {
            return;
        }

        // 在安排弹窗时立即记录，避免初始化流程重复触发。
        sessionStorage.setItem(FIRST_TIME_GUIDE_SESSION_KEY, '1');

        // 延迟显示（等待页面加载完成）
        setTimeout(() => {
            // 延迟期间如果用户已登录或页面已有引导，则不再重复创建。
            if (window.SupabaseAuthInject?.getSession() || document.getElementById('guide-overlay')) {
                return;
            }

            // 显示遮罩引导
            const overlay = document.createElement('div');
            overlay.id = 'guide-overlay';
            overlay.innerHTML = `
                <div class="guide-content">
                    <h3>👋 欢迎使用 TRTC AI</h3>
                    <p>点击右下角 <strong>👤 登录</strong> 按钮</p>
                    <p>立即获取 <strong>100 次免费配额</strong></p>
                    <button onclick="window.closeGuide()">知道了</button>
                </div>
            `;
            document.body.appendChild(overlay);

            // 高亮登录按钮
            const loginBtn = document.getElementById('supabase-login-btn');
            if (loginBtn) {
                loginBtn.classList.add('guide-highlight');
            }
        }, 1000); // 延迟1秒显示
    }

    /**
     * 关闭登录引导
     */
    function closeGuide() {
        const overlay = document.getElementById('guide-overlay');
        if (overlay) {
            overlay.remove();
        }

        const loginBtn = document.getElementById('supabase-login-btn');
        if (loginBtn) {
            loginBtn.classList.remove('guide-highlight');
        }

        log('登录引导已关闭');
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
                    btn.title = '请先登录以使用此功能';
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
        cancelVerification: cancelVerification,
        updateFunctionButtonsState: updateFunctionButtonsState // 功能按钮状态管理
    };

    // 暴露首次访问引导关闭函数
    window.closeGuide = closeGuide;

})();
