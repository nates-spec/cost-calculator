/**
 * Matador Logger — Universal Error/Activity Logger
 * Matador Fire — All Rights Reserved
 *
 * Drop-in logger for browser and Node.js environments.
 * Auto-captures: window errors, unhandled rejections, fetch/XMLHttpRequest calls.
 *
 * Usage (browser):
 *   <script src="matador-logger.js"></script>
 *   logger.info('App started');
 *
 * Usage (ES module):
 *   import { logger } from './matador-logger.js';
 *
 * Usage (Node.js / CommonJS):
 *   const { logger } = require('./matador-logger.js');
 */

(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod;                       // CommonJS / Node
  }
  if (typeof root !== 'undefined' && root !== null) {
    root.MatadorLogger = mod.MatadorLogger;     // Browser global
    root.logger = mod.logger;
  }
  if (typeof exports !== 'undefined') {
    exports.MatadorLogger = mod.MatadorLogger;  // Named export
    exports.logger = mod.logger;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : global), function () {

  /* ─── Constants ─── */
  const MAX_ENTRIES = 2000;
  const SLOW_THRESHOLD_MS = 3000;
  const TIMEOUT_RISK_MS = 10000;

  const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4, API: 5 };

  const SENSITIVE_KEYS = /^(authorization|password|passwd|token|apikey|api_key|api-key|secret|cookie|set-cookie|x-api-key|access_token|refresh_token)$/i;
  const customRedactions = [];

  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

  /* ─── Utilities ─── */
  function generateId() {
    return Math.random().toString(36).substring(2, 8);
  }

  function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substring(2, 10);
  }

  function now() {
    return new Date().toISOString();
  }

  function redactValue(key, value) {
    if (typeof key === 'string' && SENSITIVE_KEYS.test(key)) {
      return '[REDACTED]';
    }
    if (typeof value === 'string') {
      let redacted = value;
      for (const { name, pattern } of customRedactions) {
        redacted = redacted.replace(pattern, '[REDACTED:' + name + ']');
      }
      return redacted;
    }
    return value;
  }

  function redactObject(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
      let redacted = obj;
      for (const { name, pattern } of customRedactions) {
        redacted = redacted.replace(pattern, '[REDACTED:' + name + ']');
      }
      return redacted;
    }
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => redactObject(item));

    const redacted = {};
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.test(key)) {
        redacted[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        redacted[key] = redactObject(val);
      } else {
        redacted[key] = redactValue(key, val);
      }
    }
    return redacted;
  }

  function headersToObject(headers) {
    if (!headers) return {};
    if (typeof headers.entries === 'function') {
      const obj = {};
      for (const [k, v] of headers.entries()) {
        obj[k] = redactValue(k, v);
      }
      return obj;
    }
    if (typeof headers === 'object') return redactObject(headers);
    return {};
  }

  function safeStringify(obj, maxLen) {
    try {
      const str = JSON.stringify(obj);
      if (maxLen && str && str.length > maxLen) return str.substring(0, maxLen) + '...[truncated]';
      return str;
    } catch {
      return '[unserializable]';
    }
  }

  function safeParse(body) {
    if (!body) return null;
    if (typeof body === 'object') return redactObject(body);
    if (typeof body === 'string') {
      try {
        return redactObject(JSON.parse(body));
      } catch {
        return redactObject(body);
      }
    }
    return body;
  }

  function extractStack(err) {
    if (!err) return null;
    if (err instanceof Error) return err.stack || err.message;
    if (typeof err === 'string') return err;
    try { return JSON.stringify(err); } catch { return String(err); }
  }

  /* ─── Core Logger Class ─── */
  class MatadorLogger {
    constructor() {
      this.entries = [];
      this.sessionId = generateSessionId();
      this.minLevel = LEVELS.DEBUG;
      this._listeners = [];
      this._timers = {};
      this._originalFetch = null;
      this._installed = false;

      // Auto-install in browser
      if (isBrowser) {
        this._installBrowserHooks();
      }
    }

    /* ─── Configuration ─── */
    setMinLevel(level) {
      if (typeof level === 'string') level = LEVELS[level.toUpperCase()] ?? 0;
      this.minLevel = level;
    }

    addRedactionPattern(name, pattern) {
      customRedactions.push({ name, pattern });
    }

    onEntry(fn) {
      this._listeners.push(fn);
      return () => { this._listeners = this._listeners.filter(f => f !== fn); };
    }

    /* ─── Core Logging Methods ─── */
    _addEntry(level, message, opts = {}) {
      const levelCode = typeof level === 'string' ? (LEVELS[level] ?? 1) : level;
      const levelName = Object.keys(LEVELS).find(k => LEVELS[k] === levelCode) || 'INFO';

      if (levelCode < this.minLevel && levelName !== 'API') return null;

      const entry = {
        id: generateId(),
        timestamp: now(),
        level: levelName,
        category: opts.category || (levelName === 'API' ? 'API' : levelName === 'ERROR' || levelName === 'FATAL' ? 'ERROR' : 'ACTION'),
        message: typeof message === 'string' ? message : safeStringify(message, 500),
        sessionId: this.sessionId,
        data: opts.data ? redactObject(opts.data) : null,
        stack: opts.stack || null,
        source: opts.source || null,
      };

      this.entries.push(entry);
      if (this.entries.length > MAX_ENTRIES) {
        this.entries = this.entries.slice(-MAX_ENTRIES);
      }

      // Emit to listeners (log viewer uses this)
      for (const fn of this._listeners) {
        try { fn(entry); } catch (_) { /* don't let listener errors break logging */ }
      }

      // Console output
      this._consoleOutput(entry);

      return entry;
    }

    _consoleOutput(entry) {
      const prefix = `[${entry.timestamp}] [${entry.level}]${entry.category ? ' [' + entry.category + ']' : ''}`;
      const msg = `${prefix} ${entry.message}`;

      if (typeof console === 'undefined') return;

      switch (entry.level) {
        case 'DEBUG': console.debug(msg, entry.data || ''); break;
        case 'INFO': console.info(msg, entry.data || ''); break;
        case 'WARN': console.warn(msg, entry.data || ''); break;
        case 'ERROR':
        case 'FATAL': console.error(msg, entry.data || '', entry.stack || ''); break;
        case 'API': console.log(msg, entry.data || ''); break;
        default: console.log(msg, entry.data || '');
      }
    }

    /* ─── Public Logging API ─── */
    debug(message, opts) { return this._addEntry('DEBUG', message, opts); }
    info(message, opts) { return this._addEntry('INFO', message, opts); }
    warn(message, opts) { return this._addEntry('WARN', message, opts); }
    error(message, errorOrOpts, opts) {
      if (errorOrOpts instanceof Error) {
        return this._addEntry('ERROR', message, {
          ...opts,
          stack: extractStack(errorOrOpts),
          data: { ...(opts?.data || {}), errorMessage: errorOrOpts.message, errorName: errorOrOpts.name },
        });
      }
      return this._addEntry('ERROR', message, errorOrOpts);
    }
    fatal(message, errorOrOpts, opts) {
      if (errorOrOpts instanceof Error) {
        return this._addEntry('FATAL', message, {
          ...opts,
          stack: extractStack(errorOrOpts),
          data: { ...(opts?.data || {}), errorMessage: errorOrOpts.message, errorName: errorOrOpts.name },
        });
      }
      return this._addEntry('FATAL', message, errorOrOpts);
    }

    action(message, data) {
      return this._addEntry('INFO', message, { category: 'ACTION', data });
    }

    api(method, url, details = {}) {
      const duration = details.durationMs || details.duration_ms;
      let prefix = '';
      let level = 'API';
      if (duration > TIMEOUT_RISK_MS) {
        prefix = '[TIMEOUT_RISK] ';
        level = 'ERROR';
      } else if (duration > SLOW_THRESHOLD_MS) {
        prefix = '[SLOW] ';
        level = 'WARN';
      }

      const status = details.responseStatus || details.response_status || '???';
      const msg = `${prefix}${method} ${url} → ${status} (${duration || '?'}ms)`;

      return this._addEntry(level, msg, {
        category: 'API',
        source: details.source || 'manual',
        data: {
          method,
          url,
          requestHeaders: details.requestHeaders ? redactObject(details.requestHeaders) : null,
          requestBody: details.requestBody ? safeParse(details.requestBody) : null,
          responseStatus: status,
          responseHeaders: details.responseHeaders ? redactObject(details.responseHeaders) : null,
          responseBody: details.responseBody ? safeParse(details.responseBody) : null,
          durationMs: duration || null,
        },
      });
    }

    /* ─── Performance Timers ─── */
    startTimer(label) {
      const start = Date.now();
      this._timers[label] = start;
      this.debug(`Timer started: ${label}`, { category: 'PERF', source: 'timer' });

      return {
        end: (opts = {}) => {
          const elapsed = Date.now() - start;
          delete this._timers[label];
          const lvl = elapsed > TIMEOUT_RISK_MS ? 'ERROR' : elapsed > SLOW_THRESHOLD_MS ? 'WARN' : 'INFO';
          const prefix = elapsed > TIMEOUT_RISK_MS ? '[TIMEOUT_RISK] ' : elapsed > SLOW_THRESHOLD_MS ? '[SLOW] ' : '';
          this._addEntry(lvl, `${prefix}Timer ${label}: ${elapsed}ms`, {
            category: 'PERF',
            source: 'timer',
            data: { ...opts.data, label, durationMs: elapsed },
          });
          return elapsed;
        },
      };
    }

    /* ─── Query & Export ─── */
    getEntries(filter = {}) {
      let results = [...this.entries];
      if (filter.level) {
        const minCode = LEVELS[filter.level.toUpperCase()] ?? 0;
        results = results.filter(e => (LEVELS[e.level] ?? 0) >= minCode);
      }
      if (filter.category) {
        const cat = filter.category.toUpperCase();
        results = results.filter(e => e.category === cat);
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        results = results.filter(e =>
          e.message.toLowerCase().includes(q) ||
          (e.data && safeStringify(e.data, 2000).toLowerCase().includes(q))
        );
      }
      if (filter.since) {
        results = results.filter(e => e.timestamp >= filter.since);
      }
      if (filter.limit) {
        results = results.slice(-filter.limit);
      }
      return results;
    }

    clear() {
      this.entries = [];
      this.info('Logs cleared', { category: 'LIFECYCLE', source: 'logger' });
    }

    exportJSON() {
      return JSON.stringify({
        exported: now(),
        sessionId: this.sessionId,
        entryCount: this.entries.length,
        entries: this.entries,
      }, null, 2);
    }

    // Node.js: write logs to file
    exportToFile(filePath) {
      if (!isNode) {
        this.warn('exportToFile is only available in Node.js', { category: 'LIFECYCLE' });
        return false;
      }
      try {
        const fs = require('fs');
        fs.writeFileSync(filePath, this.exportJSON(), 'utf8');
        this.info(`Logs exported to ${filePath}`, { category: 'LIFECYCLE' });
        return true;
      } catch (err) {
        this.error('Failed to export logs to file', err);
        return false;
      }
    }

    /* ─── Browser Auto-Hooks ─── */
    _installBrowserHooks() {
      if (this._installed || !isBrowser) return;
      this._installed = true;

      // Global error handler
      const prevOnError = window.onerror;
      window.onerror = (msg, source, line, col, err) => {
        this._addEntry('ERROR', `Uncaught: ${msg}`, {
          category: 'ERROR',
          source: 'window.onerror',
          stack: extractStack(err),
          data: { source, line, col },
        });
        if (prevOnError) prevOnError(msg, source, line, col, err);
      };

      // Unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        this._addEntry('ERROR', `Unhandled rejection: ${reason?.message || reason}`, {
          category: 'ERROR',
          source: 'unhandledrejection',
          stack: extractStack(reason),
        });
      });

      // Fetch interceptor
      this._interceptFetch();

      // XMLHttpRequest interceptor
      this._interceptXHR();

      this._addEntry('INFO', 'MatadorLogger initialized (browser)', {
        category: 'LIFECYCLE',
        source: 'logger',
        data: { sessionId: this.sessionId, userAgent: navigator.userAgent, url: location.href },
      });
    }

    _interceptFetch() {
      if (typeof fetch === 'undefined') return;
      this._originalFetch = window.fetch.bind(window);
      const self = this;

      window.fetch = async function (input, init) {
        const method = (init?.method || 'GET').toUpperCase();
        const url = typeof input === 'string' ? input : (input?.url || String(input));
        const start = Date.now();
        let requestBody = init?.body || null;

        // Try to parse request body for logging
        if (requestBody && typeof requestBody === 'string') {
          requestBody = safeParse(requestBody);
        }

        try {
          const response = await self._originalFetch(input, init);
          const duration = Date.now() - start;

          // Clone response to read body without consuming it
          let responseBody = null;
          try {
            const clone = response.clone();
            const contentType = clone.headers.get('content-type') || '';
            if (contentType.includes('json')) {
              responseBody = await clone.json();
            } else if (contentType.includes('text')) {
              const text = await clone.text();
              responseBody = text.length > 5000 ? text.substring(0, 5000) + '...[truncated]' : text;
            } else {
              responseBody = `[${contentType || 'binary'} — not captured]`;
            }
          } catch (_) {
            responseBody = '[unable to read response body]';
          }

          self.api(method, url, {
            requestHeaders: init?.headers ? headersToObject(init.headers instanceof Headers ? init.headers : new Headers(init.headers)) : null,
            requestBody,
            responseStatus: response.status,
            responseHeaders: headersToObject(response.headers),
            responseBody,
            durationMs: duration,
            source: 'fetch-interceptor',
          });

          return response;
        } catch (err) {
          const duration = Date.now() - start;
          self._addEntry('ERROR', `Fetch failed: ${method} ${url} (${duration}ms)`, {
            category: 'API',
            source: 'fetch-interceptor',
            stack: extractStack(err),
            data: { method, url, requestBody, durationMs: duration, error: err.message },
          });
          throw err;
        }
      };
    }

    _interceptXHR() {
      if (typeof XMLHttpRequest === 'undefined') return;
      const self = this;
      const OrigXHR = XMLHttpRequest;
      const origOpen = OrigXHR.prototype.open;
      const origSend = OrigXHR.prototype.send;
      const origSetHeader = OrigXHR.prototype.setRequestHeader;

      OrigXHR.prototype.open = function (method, url) {
        this._matador = { method: method.toUpperCase(), url, headers: {} };
        return origOpen.apply(this, arguments);
      };

      OrigXHR.prototype.setRequestHeader = function (key, value) {
        if (this._matador) {
          this._matador.headers[key] = redactValue(key, value);
        }
        return origSetHeader.apply(this, arguments);
      };

      OrigXHR.prototype.send = function (body) {
        if (this._matador) {
          const meta = this._matador;
          meta.start = Date.now();
          meta.requestBody = safeParse(body);

          this.addEventListener('loadend', function () {
            const duration = Date.now() - meta.start;
            let responseBody = null;
            try {
              const ct = this.getResponseHeader('content-type') || '';
              if (ct.includes('json')) {
                responseBody = safeParse(this.responseText);
              } else if (ct.includes('text') || ct.includes('html')) {
                const text = this.responseText || '';
                responseBody = text.length > 5000 ? text.substring(0, 5000) + '...[truncated]' : text;
              } else {
                responseBody = `[${ct || 'binary'} — not captured]`;
              }
            } catch (_) {
              responseBody = '[unable to read XHR response]';
            }

            self.api(meta.method, meta.url, {
              requestHeaders: meta.headers,
              requestBody: meta.requestBody,
              responseStatus: this.status,
              responseBody,
              durationMs: duration,
              source: 'xhr-interceptor',
            });
          });
        }
        return origSend.apply(this, arguments);
      };
    }
  }

  /* ─── Singleton ─── */
  const logger = new MatadorLogger();

  return { MatadorLogger, logger };
});
