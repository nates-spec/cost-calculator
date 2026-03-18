/**
 * Matador Log Viewer — In-App Debug Panel
 * Matador Fire — All Rights Reserved
 *
 * Hidden overlay toggled with Ctrl+Shift+L.
 * Requires matador-logger.js to be loaded first.
 *
 * Usage:
 *   <script src="matador-logger.js"></script>
 *   <script src="matador-log-viewer.js"></script>
 */

(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  /* ─── Brand Tokens ─── */
  const COLORS = {
    charcoal: '#0D0B09',
    surface: '#161210',
    surfaceHover: '#1E1A17',
    bone: '#F0E8DC',
    boneMuted: 'rgba(240, 232, 220, 0.5)',
    red: '#EC1B34',
    ember: '#C44A0A',
    orange: '#E8821A',
    ash: '#6D6F70',
    green: '#2ECC71',
    yellow: '#F39C12',
    border: 'rgba(240, 232, 220, 0.08)',
    borderActive: 'rgba(240, 232, 220, 0.15)',
  };

  const LEVEL_COLORS = {
    DEBUG: COLORS.ash,
    INFO: COLORS.bone,
    WARN: COLORS.orange,
    ERROR: COLORS.red,
    FATAL: '#FF4444',
    API: COLORS.green,
  };

  const CATEGORY_COLORS = {
    ACTION: COLORS.bone,
    API: COLORS.green,
    ERROR: COLORS.red,
    LIFECYCLE: COLORS.ember,
    STATE: COLORS.orange,
    PERF: COLORS.yellow,
    AUTH: '#9B59B6',
    STORAGE: '#3498DB',
  };

  let isVisible = false;
  let activeFilters = { level: null, search: '' };
  let panel = null;
  let logContainer = null;
  let autoScroll = true;

  /* ─── Styles ─── */
  function injectStyles() {
    if (document.getElementById('matador-log-viewer-styles')) return;
    const style = document.createElement('style');
    style.id = 'matador-log-viewer-styles';
    style.textContent = `
      #matador-log-viewer {
        position: fixed;
        top: 0;
        right: 0;
        width: 520px;
        height: 100vh;
        background: ${COLORS.charcoal};
        border-left: 1px solid ${COLORS.border};
        z-index: 999999;
        display: none;
        flex-direction: column;
        font-family: 'Cabinet Grotesk', 'DM Sans', system-ui, -apple-system, sans-serif;
        font-size: 12px;
        color: ${COLORS.bone};
        box-shadow: -4px 0 24px rgba(0,0,0,0.5);
      }
      #matador-log-viewer.mlv-visible {
        display: flex;
      }
      /* Responsive: full width on narrow screens */
      @media (max-width: 600px) {
        #matador-log-viewer { width: 100vw; }
      }

      /* Header */
      .mlv-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: ${COLORS.surface};
        border-bottom: 1px solid ${COLORS.border};
        flex-shrink: 0;
      }
      .mlv-title {
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: ${COLORS.bone};
      }
      .mlv-title span {
        color: ${COLORS.red};
      }
      .mlv-header-actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .mlv-btn {
        background: transparent;
        color: ${COLORS.boneMuted};
        border: 1px solid ${COLORS.border};
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-family: inherit;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: all 0.15s;
      }
      .mlv-btn:hover {
        border-color: ${COLORS.borderActive};
        color: ${COLORS.bone};
        background: ${COLORS.surfaceHover};
      }
      .mlv-btn-close {
        color: ${COLORS.ash};
        font-size: 18px;
        padding: 2px 6px;
        border: none;
        line-height: 1;
      }

      /* Toolbar */
      .mlv-toolbar {
        display: flex;
        gap: 4px;
        padding: 8px 14px;
        background: ${COLORS.surface};
        border-bottom: 1px solid ${COLORS.border};
        flex-wrap: wrap;
        flex-shrink: 0;
      }
      .mlv-filter {
        padding: 3px 8px;
        border-radius: 3px;
        font-size: 10px;
        font-family: inherit;
        cursor: pointer;
        border: 1px solid ${COLORS.border};
        background: transparent;
        color: ${COLORS.boneMuted};
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: all 0.15s;
      }
      .mlv-filter:hover {
        border-color: ${COLORS.borderActive};
        color: ${COLORS.bone};
      }
      .mlv-filter.mlv-active {
        border-color: ${COLORS.red};
        color: ${COLORS.red};
        background: rgba(236, 27, 52, 0.08);
      }

      /* Search */
      .mlv-search-row {
        padding: 8px 14px;
        border-bottom: 1px solid ${COLORS.border};
        flex-shrink: 0;
      }
      .mlv-search {
        width: 100%;
        background: ${COLORS.surface};
        border: 1px solid ${COLORS.border};
        border-radius: 4px;
        padding: 6px 10px;
        font-size: 12px;
        font-family: inherit;
        color: ${COLORS.bone};
        outline: none;
        box-sizing: border-box;
      }
      .mlv-search:focus {
        border-color: ${COLORS.borderActive};
      }
      .mlv-search::placeholder {
        color: ${COLORS.ash};
      }

      /* Log entries container */
      .mlv-logs {
        flex: 1;
        overflow-y: auto;
        padding: 4px 0;
      }
      .mlv-logs::-webkit-scrollbar { width: 6px; }
      .mlv-logs::-webkit-scrollbar-track { background: transparent; }
      .mlv-logs::-webkit-scrollbar-thumb { background: ${COLORS.ash}; border-radius: 3px; }

      /* Log entry */
      .mlv-entry {
        padding: 6px 14px;
        border-bottom: 1px solid ${COLORS.border};
        cursor: default;
        transition: background 0.1s;
        line-height: 1.5;
      }
      .mlv-entry:hover {
        background: ${COLORS.surfaceHover};
      }
      .mlv-entry-header {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .mlv-time {
        color: ${COLORS.ash};
        font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 10px;
        flex-shrink: 0;
      }
      .mlv-badge {
        font-size: 9px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 2px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        flex-shrink: 0;
      }
      .mlv-message {
        color: ${COLORS.bone};
        word-break: break-word;
        font-size: 11.5px;
      }

      /* Expandable data */
      .mlv-expandable {
        cursor: pointer;
      }
      .mlv-expandable:hover .mlv-message {
        text-decoration: underline;
        text-decoration-style: dotted;
      }
      .mlv-data {
        display: none;
        margin-top: 6px;
        padding: 8px;
        background: ${COLORS.surface};
        border-radius: 4px;
        border: 1px solid ${COLORS.border};
        font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
        font-size: 10.5px;
        color: ${COLORS.boneMuted};
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 300px;
        overflow-y: auto;
      }
      .mlv-data.mlv-expanded {
        display: block;
      }
      .mlv-stack {
        margin-top: 4px;
        padding: 6px 8px;
        background: rgba(236, 27, 52, 0.05);
        border-left: 2px solid ${COLORS.red};
        font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
        font-size: 10px;
        color: ${COLORS.boneMuted};
        white-space: pre-wrap;
        word-break: break-all;
      }

      /* Entry count badge */
      .mlv-count {
        font-size: 10px;
        color: ${COLORS.ash};
        padding: 8px 14px;
        border-top: 1px solid ${COLORS.border};
        background: ${COLORS.surface};
        flex-shrink: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .mlv-count-errors {
        color: ${COLORS.red};
        font-weight: 700;
      }

      /* Empty state */
      .mlv-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: ${COLORS.ash};
        font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }

  /* ─── Build DOM ─── */
  function createPanel() {
    if (panel) return;
    injectStyles();

    panel = document.createElement('div');
    panel.id = 'matador-log-viewer';
    panel.innerHTML = `
      <div class="mlv-header">
        <div class="mlv-title"><span>&#9679;</span> Log Viewer</div>
        <div class="mlv-header-actions">
          <button class="mlv-btn mlv-btn-export" title="Export logs as JSON">Export</button>
          <button class="mlv-btn mlv-btn-clear" title="Clear all logs">Clear</button>
          <button class="mlv-btn mlv-btn-close" title="Close (Ctrl+Shift+L)">&times;</button>
        </div>
      </div>
      <div class="mlv-toolbar">
        <button class="mlv-filter mlv-active" data-level="ALL">All</button>
        <button class="mlv-filter" data-level="DEBUG">Debug</button>
        <button class="mlv-filter" data-level="INFO">Info</button>
        <button class="mlv-filter" data-level="WARN">Warn</button>
        <button class="mlv-filter" data-level="ERROR">Error</button>
        <button class="mlv-filter" data-level="FATAL">Fatal</button>
        <button class="mlv-filter" data-level="API">API</button>
      </div>
      <div class="mlv-search-row">
        <input type="text" class="mlv-search" placeholder="Search logs..." />
      </div>
      <div class="mlv-logs"></div>
      <div class="mlv-count">
        <span class="mlv-count-total"></span>
        <span class="mlv-count-errors"></span>
      </div>
    `;

    document.body.appendChild(panel);
    logContainer = panel.querySelector('.mlv-logs');

    // Event handlers
    panel.querySelector('.mlv-btn-close').addEventListener('click', toggle);
    panel.querySelector('.mlv-btn-export').addEventListener('click', exportLogs);
    panel.querySelector('.mlv-btn-clear').addEventListener('click', clearLogs);
    panel.querySelector('.mlv-search').addEventListener('input', (e) => {
      activeFilters.search = e.target.value;
      renderLogs();
    });

    // Level filters
    panel.querySelectorAll('.mlv-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.mlv-filter').forEach(b => b.classList.remove('mlv-active'));
        btn.classList.add('mlv-active');
        const level = btn.dataset.level;
        activeFilters.level = level === 'ALL' ? null : level;
        renderLogs();
      });
    });

    // Auto-scroll detection
    logContainer.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = logContainer;
      autoScroll = (scrollHeight - scrollTop - clientHeight) < 40;
    });
  }

  /* ─── Render ─── */
  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        '.' + String(d.getMilliseconds()).padStart(3, '0');
    } catch {
      return iso;
    }
  }

  function renderEntry(entry) {
    const el = document.createElement('div');
    el.className = 'mlv-entry';

    const levelColor = LEVEL_COLORS[entry.level] || COLORS.bone;
    const catColor = CATEGORY_COLORS[entry.category] || COLORS.ash;
    const hasData = entry.data || entry.stack;

    if (hasData) el.classList.add('mlv-expandable');

    let html = `
      <div class="mlv-entry-header">
        <span class="mlv-time">${formatTime(entry.timestamp)}</span>
        <span class="mlv-badge" style="color:${levelColor};border:1px solid ${levelColor}30;background:${levelColor}10">${entry.level}</span>
        ${entry.category && entry.category !== entry.level ? `<span class="mlv-badge" style="color:${catColor};border:1px solid ${catColor}30;background:${catColor}10">${entry.category}</span>` : ''}
        <span class="mlv-message">${escapeHtml(entry.message)}</span>
      </div>
    `;

    if (entry.data) {
      html += `<div class="mlv-data">${escapeHtml(JSON.stringify(entry.data, null, 2))}</div>`;
    }
    if (entry.stack) {
      html += `<div class="mlv-stack">${escapeHtml(entry.stack)}</div>`;
    }

    el.innerHTML = html;

    if (hasData) {
      el.addEventListener('click', () => {
        const dataEl = el.querySelector('.mlv-data');
        if (dataEl) dataEl.classList.toggle('mlv-expanded');
        const stackEl = el.querySelector('.mlv-stack');
        if (stackEl) stackEl.classList.toggle('mlv-expanded');
      });
    }

    return el;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderLogs() {
    if (!logContainer || !window.logger) return;

    const entries = window.logger.getEntries({
      level: activeFilters.level || undefined,
      search: activeFilters.search || undefined,
    });

    logContainer.innerHTML = '';

    if (entries.length === 0) {
      logContainer.innerHTML = '<div class="mlv-empty">No matching log entries</div>';
    } else {
      const fragment = document.createDocumentFragment();
      for (const entry of entries) {
        fragment.appendChild(renderEntry(entry));
      }
      logContainer.appendChild(fragment);
    }

    updateCounts();

    if (autoScroll) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  function appendEntry(entry) {
    if (!logContainer || !isVisible) return;

    // Check if entry passes current filters
    if (activeFilters.level && entry.level !== activeFilters.level) return;
    if (activeFilters.search) {
      const q = activeFilters.search.toLowerCase();
      const matchMsg = entry.message.toLowerCase().includes(q);
      const matchData = entry.data && JSON.stringify(entry.data).toLowerCase().includes(q);
      if (!matchMsg && !matchData) return;
    }

    // Remove empty state if present
    const emptyEl = logContainer.querySelector('.mlv-empty');
    if (emptyEl) emptyEl.remove();

    logContainer.appendChild(renderEntry(entry));
    updateCounts();

    if (autoScroll) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  function updateCounts() {
    if (!panel || !window.logger) return;
    const all = window.logger.entries.length;
    const errors = window.logger.entries.filter(e => e.level === 'ERROR' || e.level === 'FATAL').length;
    const totalEl = panel.querySelector('.mlv-count-total');
    const errEl = panel.querySelector('.mlv-count-errors');
    if (totalEl) totalEl.textContent = `${all} entries`;
    if (errEl) errEl.textContent = errors > 0 ? `${errors} error${errors !== 1 ? 's' : ''}` : '';
  }

  /* ─── Actions ─── */
  function exportLogs() {
    if (!window.logger) return;
    const json = window.logger.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matador-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearLogs() {
    if (!window.logger) return;
    window.logger.clear();
    renderLogs();
  }

  function toggle() {
    if (!panel) createPanel();
    isVisible = !isVisible;
    if (isVisible) {
      panel.classList.add('mlv-visible');
      renderLogs();
    } else {
      panel.classList.remove('mlv-visible');
    }
  }

  /* ─── Keyboard Shortcut: Ctrl+Shift+L ─── */
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      toggle();
    }
  });

  /* ─── Live Updates ─── */
  function init() {
    if (window.logger && typeof window.logger.onEntry === 'function') {
      window.logger.onEntry((entry) => {
        if (isVisible) appendEntry(entry);
      });
    } else {
      // Retry if logger hasn't loaded yet
      setTimeout(init, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose toggle for programmatic use
  window.MatadorLogViewer = { toggle, show: () => { if (!isVisible) toggle(); }, hide: () => { if (isVisible) toggle(); } };
})();
