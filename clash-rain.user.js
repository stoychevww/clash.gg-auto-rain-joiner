// ==UserScript==
// @name         Clash.GG Auto Rain Joiner
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Watches for the clash.gg rain pool Join button, auto-clicks it, and alerts you (sound + notification + overlay) to solve the captcha.
// @author       stoychevww
// @license      MIT
// @match        https://clash.gg/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=clash.gg
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ─── CONFIG ─────────────────────────────────────────────────────────────────
    const POLL_MS         = 3000;
    const COOLDOWN_MS     = 4 * 60 * 1000;
    const ALERT_MS        = 90 * 1000;
    const SOUND_REPEAT    = 3;
    // ─────────────────────────────────────────────────────────────────────────────

    let lastClickTime = GM_getValue('lastClickTime', 0);
    let audioCtx      = null;
    let statusEl      = null;
    let observerTimer = null;   // debounce handle for MutationObserver

    // ── Audio ─────────────────────────────────────────────────────────────────
    function getAudioCtx() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        return audioCtx;
    }

    function beep(freq, t, dur, ctx) {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'square';
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur);
    }

    function playAlert() {
        try {
            const ctx = getAudioCtx();
            const notes = [660, 880, 1100, 880, 1100], dur = 0.18, gap = 0.22;
            for (let r = 0; r < SOUND_REPEAT; r++)
                notes.forEach((f, i) => beep(f, ctx.currentTime + r * (notes.length * gap + 0.3) + i * gap, dur, ctx));
        } catch (e) { console.warn('[RainJoiner] audio:', e); }
    }

    // ── Title flash ───────────────────────────────────────────────────────────
    let flashTimer = null;
    function flashTitle() {
        const orig = document.title;
        let on = true;
        clearInterval(flashTimer);
        flashTimer = setInterval(() => { document.title = on ? '🌧️ RAIN! Solve captcha!' : orig; on = !on; }, 700);
        setTimeout(() => { clearInterval(flashTimer); document.title = orig; }, ALERT_MS);
    }

    // ── DOM elements (created once, never mutated by observer) ───────────────
    function ensureUI() {
        if (document.getElementById('rj-styles')) return;

        const s = document.createElement('style');
        s.id = 'rj-styles';
        s.textContent = `
            #rj-overlay {
                position: fixed; top: 80px; left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg,#f5a623,#e8820c);
                color: #fff; font-family: 'Segoe UI',sans-serif;
                font-size: 17px; font-weight: 700;
                padding: 14px 28px; border-radius: 12px;
                z-index: 2147483647; box-shadow: 0 6px 30px rgba(0,0,0,.5);
                cursor: pointer; white-space: nowrap; letter-spacing: .5px;
                animation: rj-pulse .9s ease-in-out infinite;
            }
            #rj-overlay span { font-size:13px; font-weight:400; display:block; text-align:center; opacity:.88; margin-top:3px; }
            @keyframes rj-pulse {
                0%,100% { box-shadow:0 6px 30px rgba(0,0,0,.5); transform:translateX(-50%) scale(1); }
                50%     { box-shadow:0 6px 40px rgba(245,166,35,.7); transform:translateX(-50%) scale(1.03); }
            }
            #rj-status {
                position: fixed; bottom: 12px; right: 14px;
                background: rgba(0,0,0,.65); color: #aaa;
                font-family: monospace; font-size: 11px;
                padding: 5px 9px; border-radius: 6px;
                z-index: 2147483646; pointer-events: none;
                transition: color .3s;
            }
        `;
        document.head.appendChild(s);

        statusEl = document.createElement('div');
        statusEl.id = 'rj-status';
        document.body.appendChild(statusEl);
    }

    function showOverlay() {
        let el = document.getElementById('rj-overlay');
        if (el) el.remove();
        el = document.createElement('div');
        el.id = 'rj-overlay';
        el.innerHTML = '🌧️ RAIN IS HERE — Solve the captcha!<span>Click to dismiss</span>';
        el.addEventListener('click', () => el.remove());
        document.body.appendChild(el);
        setTimeout(() => el?.remove(), ALERT_MS);
    }

    // statusEl is updated directly — NOT via innerHTML (avoids triggering observer)
    function setStatus(text, color) {
        if (!statusEl) return;
        statusEl.textContent = `☂ ${text}`;
        statusEl.style.color = color || '#aaa';
    }

    // ── Find the rain-pool Join button ────────────────────────────────────────
    function findJoinButton() {
        for (const btn of document.querySelectorAll('button, [role="button"]')) {
            if (!/^join$/i.test((btn.innerText || btn.textContent || '').trim())) continue;
            let node = btn.parentElement;
            for (let d = 0; d < 12; d++) {
                if (!node) break;
                if (/rain\s*pool/i.test(node.innerText || '')) return btn;
                node = node.parentElement;
            }
        }
        // Fallback: class-name substring
        for (const sel of ['[class*="rain"]', '[class*="Rain"]', '[data-testid*="rain"]']) {
            try {
                for (const c of document.querySelectorAll(sel)) {
                    if (!/rain\s*pool/i.test(c.innerText || '')) continue;
                    const btn = c.querySelector('button, [role="button"]');
                    if (btn && /^join$/i.test((btn.innerText || btn.textContent || '').trim())) return btn;
                }
            } catch (_) {}
        }
        return null;
    }

    // ── Notifications ─────────────────────────────────────────────────────────
    function sendNotification() {
        try {
            GM_notification({ title: '🌧️ Clash.GG Rain!', text: 'Solve the captcha to join!', timeout: 10000, onclick: () => window.focus() });
        } catch (_) {
            if (Notification?.permission === 'granted')
                new Notification('🌧️ Clash.GG Rain!', { body: 'Solve the captcha to join the rain pool!' });
        }
    }

    // ── Main check (called by interval AND debounced observer) ────────────────
    function check() {
        const now = Date.now();
        const elapsed = now - lastClickTime;

        if (elapsed < COOLDOWN_MS) {
            setStatus(`cooldown — ${Math.ceil((COOLDOWN_MS - elapsed) / 1000)}s left`);
            return;
        }

        const btn = findJoinButton();
        if (!btn) { setStatus('watching…'); return; }

        // Rain found — act
        lastClickTime = now;
        GM_setValue('lastClickTime', now);

        btn.click();
        playAlert();
        flashTitle();
        showOverlay();
        sendNotification();
        try { window.focus(); } catch (_) {}

        setStatus(`joined at ${new Date().toLocaleTimeString()}`, '#6fcf6f');
        console.log('[RainJoiner] Clicked Join at', new Date().toLocaleTimeString());
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    function init() {
        ensureUI();
        setStatus('starting…');

        if (Notification?.permission === 'default') Notification.requestPermission().catch(() => {});

        // Debounced MutationObserver — batches rapid React re-renders into one check.
        // Without debounce the observer would call check() thousands of times per second,
        // and updating statusEl inside check() would retrigger the observer endlessly.
        const observer = new MutationObserver(() => {
            clearTimeout(observerTimer);
            observerTimer = setTimeout(check, 600);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setInterval(check, POLL_MS);
        setTimeout(check, 2500);   // first check after React hydrates

        console.log('[RainJoiner] v1.4 active — polling every', POLL_MS / 1000, 's');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
