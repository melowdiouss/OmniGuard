const DEFAULT_API_ROOT = window.location.origin;
const STORAGE_KEYS = {
  settings: 'omniguard.frontend.settings',
  session: 'omniguard.frontend.session',
  log: 'omniguard.frontend.log',
};

const endpointCatalog = [
  {
    id: 'health',
    group: 'System',
    title: 'Health check',
    method: 'GET',
    path: '/health',
    auth: false,
    csrf: false,
    description: 'Verifies the API process is reachable.',
    sampleBody: null,
    samplePathParams: {},
  },
  {
    id: 'csrf',
    group: 'Auth',
    title: 'Sync CSRF token',
    method: 'GET',
    path: '/api/v1/auth/csrf',
    auth: false,
    csrf: false,
    description: 'Bootstraps a readable CSRF token cookie for the browser.',
    sampleBody: null,
    samplePathParams: {},
  },
  {
    id: 'register',
    group: 'Auth',
    title: 'Register user',
    method: 'POST',
    path: '/api/v1/auth/register',
    auth: false,
    csrf: true,
    description: 'Creates a new user and returns access and refresh tokens.',
    sampleBody: {
      email: 'brand@example.com',
      password: 'Str0ngP@ssword!',
      role: 'BRAND',
      orgId: 'org_123',
    },
    samplePathParams: {},
  },
  {
    id: 'login',
    group: 'Auth',
    title: 'Login',
    method: 'POST',
    path: '/api/v1/auth/login',
    auth: false,
    csrf: true,
    description: 'Authenticates the session and returns fresh tokens.',
    sampleBody: {
      email: 'brand@example.com',
      password: 'Str0ngP@ssword!',
    },
    samplePathParams: {},
  },
  {
    id: 'refresh',
    group: 'Auth',
    title: 'Rotate tokens',
    method: 'POST',
    path: '/api/v1/auth/refresh',
    auth: false,
    csrf: true,
    description: 'Exchanges a refresh token for a new pair.',
    sampleBody: {
      refreshToken: '{{refreshToken}}',
    },
    samplePathParams: {},
  },
  {
    id: 'me',
    group: 'Auth',
    title: 'Current user',
    method: 'GET',
    path: '/api/v1/auth/me',
    auth: true,
    csrf: false,
    description: 'Returns the authenticated user profile.',
    sampleBody: null,
    samplePathParams: {},
  },
  {
    id: 'request-reset',
    group: 'Auth',
    title: 'Request password reset',
    method: 'POST',
    path: '/api/v1/auth/request-password-reset',
    auth: false,
    csrf: true,
    description: 'Starts the password reset flow without revealing account existence.',
    sampleBody: {
      email: 'brand@example.com',
    },
    samplePathParams: {},
  },
  {
    id: 'reset-password',
    group: 'Auth',
    title: 'Reset password',
    method: 'POST',
    path: '/api/v1/auth/reset-password',
    auth: false,
    csrf: true,
    description: 'Finishes the reset flow using the emailed token.',
    sampleBody: {
      email: 'brand@example.com',
      token: 'reset-token',
      newPassword: 'N3wP@ssword!2026',
    },
    samplePathParams: {},
  },
  {
    id: 'verify-email',
    group: 'Auth',
    title: 'Verify email',
    method: 'POST',
    path: '/api/v1/auth/verify-email',
    auth: true,
    csrf: true,
    description: 'Marks the authenticated account as verified.',
    sampleBody: {
      email: 'brand@example.com',
      token: 'verification-token',
    },
    samplePathParams: {},
  },
  {
    id: 'logout',
    group: 'Auth',
    title: 'Logout',
    method: 'POST',
    path: '/api/v1/auth/logout',
    auth: true,
    csrf: true,
    description: 'Revokes the current access token immediately.',
    sampleBody: {},
    samplePathParams: {},
  },
  {
    id: 'admin-users',
    group: 'Auth',
    title: 'Admin users',
    method: 'GET',
    path: '/api/v1/auth/admin/users',
    auth: true,
    csrf: false,
    description: 'Admin-only user listing endpoint.',
    sampleBody: null,
    samplePathParams: {},
  },
  {
    id: 'admin-audit',
    group: 'Auth',
    title: 'Admin audit logs',
    method: 'GET',
    path: '/api/v1/auth/admin/audit-logs',
    auth: true,
    csrf: false,
    description: 'Admin-only audit trail endpoint.',
    sampleBody: null,
    samplePathParams: {},
  },
  {
    id: 'order',
    group: 'Tracking',
    title: 'View order',
    method: 'GET',
    path: '/api/v1/customer/orders/:orderId',
    auth: true,
    csrf: false,
    description: 'Returns the order summary for the current customer.',
    sampleBody: null,
    samplePathParams: {
      orderId: 'order_1001',
    },
  },
  {
    id: 'timeline',
    group: 'Tracking',
    title: 'Tracking timeline',
    method: 'GET',
    path: '/api/v1/customer/orders/:orderId/tracking',
    auth: true,
    csrf: false,
    description: 'Returns the shipment timeline for an order.',
    sampleBody: null,
    samplePathParams: {
      orderId: 'order_1001',
    },
  },
  {
    id: 'shipments',
    group: 'Tracking',
    title: 'Assigned shipments',
    method: 'GET',
    path: '/api/v1/logistics/shipments',
    auth: true,
    csrf: false,
    description: 'Lists shipments assigned to the current logistics user.',
    sampleBody: null,
    samplePathParams: {},
  },
  {
    id: 'scan-shipment',
    group: 'Tracking',
    title: 'Capture shipment scan',
    method: 'POST',
    path: '/api/v1/logistics/shipments/:shipmentId/scan',
    auth: true,
    csrf: true,
    description: 'Captures a logistics scan against a shipment.',
    sampleBody: {
      productId: 'product_1001',
      parcelId: 'parcel_1001',
      scanType: 'LOGISTICS_PACKAGE_SCAN',
      scanData: {
        barcode: 'PKG-1001',
        location: 'Warehouse A',
        status: 'IN_TRANSIT',
      },
      images: [
        {
          kind: 'label',
          data: 'https://example.com/label.jpg',
          mimeType: 'image/jpeg',
        },
      ],
    },
    samplePathParams: {
      shipmentId: 'shipment_1001',
    },
  },
  {
    id: 'create-product',
    group: 'Supply Chain',
    title: 'Create product',
    method: 'POST',
    path: '/api/v1/products',
    auth: true,
    csrf: true,
    description: 'Creates a product and parcel record with blockchain genesis payloads.',
    sampleBody: {
      name: 'Pilot Jacket',
      sku: 'PJ-001',
      description: 'Limited edition pilot jacket',
      brandId: 'brand_42',
      pufImage: 'https://example.com/puf.jpg',
      parcelImage: 'https://example.com/parcel.jpg',
      parcel: {
        parcelCode: 'PARCEL-001',
        trackingNumber: 'TRK-001',
        status: 'INITIALIZED',
      },
    },
    samplePathParams: {},
  },
  {
    id: 'capture-scan',
    group: 'Supply Chain',
    title: 'Capture scan',
    method: 'POST',
    path: '/api/v1/scans',
    auth: true,
    csrf: true,
    description: 'Queues a scan payload for validation and storage.',
    sampleBody: {
      productId: 'product_1001',
      parcelId: 'parcel_1001',
      scanType: 'GENERIC',
      scanData: {
        batch: 'B-1001',
        verifier: 'dock-7',
      },
      images: [
        {
          kind: 'front',
          data: 'https://example.com/front.jpg',
          mimeType: 'image/jpeg',
        },
      ],
    },
    samplePathParams: {},
  },
];

const state = {
  apiRoot: DEFAULT_API_ROOT,
  csrfToken: '',
  session: null,
  selectedEndpointId: endpointCatalog[0].id,
  response: null,
  activity: [],
  lastEndpointStatus: new Map(),
};

const nodes = {
  apiRootDisplay: document.getElementById('api-root-display'),
  csrfStatus: document.getElementById('csrf-status'),
  sessionStatus: document.getElementById('session-status'),
  apiRootInput: document.getElementById('api-root-input'),
  csrfTokenInput: document.getElementById('csrf-token-input'),
  syncCsrfButton: document.getElementById('sync-csrf-button'),
  saveSettingsButton: document.getElementById('save-settings-button'),
  loadSessionButton: document.getElementById('load-session-button'),
  clearSessionButton: document.getElementById('clear-session-button'),
  refreshMeButton: document.getElementById('refresh-me-button'),
  copyResponseButton: document.getElementById('copy-response-button'),
  refreshCatalogButton: document.getElementById('refresh-catalog-button'),
  clearActivityButton: document.getElementById('clear-activity-button'),
  endpointSelect: document.getElementById('endpoint-select'),
  endpointPath: document.getElementById('endpoint-path'),
  pathParamsInput: document.getElementById('path-params-input'),
  requestBodyInput: document.getElementById('request-body-input'),
  endpointBadges: document.getElementById('endpoint-badges'),
  endpointCatalog: document.getElementById('endpoint-catalog'),
  endpointNav: document.getElementById('endpoint-nav'),
  sessionPreview: document.getElementById('session-preview'),
  userPreview: document.getElementById('user-preview'),
  responseOutput: document.getElementById('response-output'),
  activityLog: document.getElementById('activity-log'),
  sendRequestButton: document.getElementById('send-request-button'),
};

function getEndpoint(id) {
  return endpointCatalog.find((endpoint) => endpoint.id === id) || endpointCatalog[0];
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function normalizeApiRoot(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return DEFAULT_API_ROOT;
  }
  return trimmed.replace(/\/$/, '');
}

function resolveUrl(path) {
  const root = normalizeApiRoot(state.apiRoot);
  if (/^https?:\/\//i.test(root)) {
    return new URL(path, root).toString();
  }

  const prefix = root.startsWith('/') ? root : `/${root}`;
  return `${prefix}${path.startsWith('/') ? path : `/${path}`}`;
}

function parseJson(text, fallback = null) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return fallback;
  }

  return JSON.parse(trimmed);
}

function safeParseJson(text, fallback = null) {
  try {
    return parseJson(text, fallback);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

function replacePathParams(path, params) {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const value = params?.[key];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing path parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
}

function readCookie(name) {
  const needle = `${name}=`;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(needle))
    ?.slice(needle.length)
    ?.trim();
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.settings);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.apiRoot) {
      state.apiRoot = normalizeApiRoot(parsed.apiRoot);
    }
    if (parsed?.csrfToken) {
      state.csrfToken = String(parsed.csrfToken);
    }
  } catch (error) {
    console.warn('Failed to restore settings', error);
  }
}

function persistSettings() {
  localStorage.setItem(
    STORAGE_KEYS.settings,
    JSON.stringify({ apiRoot: state.apiRoot, csrfToken: state.csrfToken }),
  );
}

function loadSession() {
  const raw = localStorage.getItem(STORAGE_KEYS.session);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to restore session', error);
    return null;
  }
}

function persistSession(session) {
  state.session = session;
  if (session) {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEYS.session);
  }
}

function setActivity(entry) {
  const nextEntry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  state.activity = [nextEntry, ...state.activity].slice(0, 8);
  localStorage.setItem(STORAGE_KEYS.log, JSON.stringify(state.activity));
  renderActivity();
}

function restoreActivity() {
  const raw = localStorage.getItem(STORAGE_KEYS.log);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.activity = parsed;
    }
  } catch (error) {
    console.warn('Failed to restore activity log', error);
  }
}

function renderSettings() {
  nodes.apiRootInput.value = state.apiRoot;
  nodes.csrfTokenInput.value = state.csrfToken;
  nodes.apiRootDisplay.textContent = state.apiRoot || '/api/v1';
  nodes.csrfStatus.textContent = state.csrfToken ? 'ready' : 'pending';
  nodes.sessionStatus.textContent = state.session?.user ? state.session.user.role ?? 'authenticated' : 'anonymous';
}

function renderSession() {
  nodes.sessionPreview.textContent = state.session
    ? prettyJson({
        user: state.session.user,
        hasAccessToken: Boolean(state.session.accessToken),
        hasRefreshToken: Boolean(state.session.refreshToken),
        lastUpdated: state.session.updatedAt,
      })
    : 'No session saved yet.';

  nodes.userPreview.textContent = state.session?.user ? prettyJson(state.session.user) : 'No authenticated user loaded.';
}

function renderActivity() {
  if (state.activity.length === 0) {
    nodes.activityLog.innerHTML = '<li>No requests sent yet.</li>';
    return;
  }

  nodes.activityLog.innerHTML = state.activity
    .map(
      (entry) => `
        <li>
          <strong>${entry.method} ${entry.label}</strong><br />
          <span>${entry.createdAt}</span><br />
          <span>${entry.status}</span>
        </li>
      `,
    )
    .join('');
}

function renderEndpointCatalog() {
  const groups = endpointCatalog.reduce((accumulator, endpoint) => {
    if (!accumulator[endpoint.group]) {
      accumulator[endpoint.group] = [];
    }
    accumulator[endpoint.group].push(endpoint);
    return accumulator;
  }, {});

  nodes.endpointNav.innerHTML = Object.entries(groups)
    .map(
      ([groupName, endpoints]) => `
        <section class="endpoint-group">
          <h3>${groupName}</h3>
          <p>${endpoints.length} route${endpoints.length === 1 ? '' : 's'} wired</p>
          ${endpoints
            .map(
              (endpoint) => `
                <button class="endpoint-link" type="button" data-select-endpoint="${endpoint.id}">
                  <span>${endpoint.title}</span>
                  <small>${endpoint.method}</small>
                </button>
              `,
            )
            .join('')}
        </section>
      `,
    )
    .join('');

  nodes.endpointSelect.innerHTML = endpointCatalog
    .map((endpoint) => `<option value="${endpoint.id}">${endpoint.method} ${endpoint.path}</option>`)
    .join('');

  nodes.endpointCatalog.innerHTML = endpointCatalog
    .map((endpoint) => {
      const status = state.lastEndpointStatus.get(endpoint.id) || 'idle';
      const statusLabel =
        status === 'ok' ? 'checked' : status === 'error' ? 'failed' : 'not tested';

      return `
        <article class="endpoint-card" id="endpoint-${endpoint.id}">
          <div class="endpoint-card-head">
            <div>
              <h3>${endpoint.title}</h3>
              <div class="endpoint-path">${endpoint.method} ${endpoint.path}</div>
            </div>
            <span class="badge ${endpoint.method.toLowerCase()}">${statusLabel}</span>
          </div>
          <p>${endpoint.description}</p>
          <div class="endpoint-card-actions">
            <span class="badge ${endpoint.method.toLowerCase()}">${endpoint.method}</span>
            ${endpoint.auth ? '<span class="badge auth">auth</span>' : '<span class="badge">public</span>'}
            ${endpoint.csrf ? '<span class="badge csrf">csrf</span>' : '<span class="badge">no csrf</span>'}
            <button type="button" data-select-endpoint="${endpoint.id}">Load sample</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderBadges(endpoint) {
  nodes.endpointBadges.innerHTML = [
    `<span class="badge ${endpoint.method.toLowerCase()}">${endpoint.method}</span>`,
    `<span class="badge">${endpoint.auth ? 'requires auth' : 'public'}</span>`,
    `<span class="badge">${endpoint.csrf ? 'requires CSRF' : 'no CSRF'}</span>`,
  ].join('');
}

function loadEndpoint(endpointId) {
  const endpoint = getEndpoint(endpointId);
  state.selectedEndpointId = endpoint.id;
  nodes.endpointSelect.value = endpoint.id;
  nodes.endpointPath.value = endpoint.path;
  nodes.pathParamsInput.value = prettyJson(endpoint.samplePathParams || {});
  nodes.requestBodyInput.value = endpoint.sampleBody ? prettyJson(endpoint.sampleBody) : '';
  renderBadges(endpoint);
}

async function ensureCsrfToken(force = false) {
  if (!force) {
    const fromCookie = readCookie('csrf-token');
    if (fromCookie) {
      state.csrfToken = fromCookie;
      persistSettings();
      renderSettings();
      return fromCookie;
    }

    if (state.csrfToken) {
      return state.csrfToken;
    }
  }

  const response = await fetch(resolveUrl('/api/v1/auth/csrf'), {
    method: 'GET',
    credentials: 'include',
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Failed to sync CSRF token');
  }

  const token = payload?.data?.csrfToken || readCookie('csrf-token');
  if (!token) {
    throw new Error('CSRF sync completed but no token was returned');
  }

  state.csrfToken = token;
  nodes.csrfTokenInput.value = token;
  persistSettings();
  renderSettings();
  return token;
}

function createRequestOptions(endpoint, pathParamsText, bodyText) {
  const pathParams = safeParseJson(pathParamsText, {});
  const body = endpoint.method === 'GET' ? undefined : safeParseJson(bodyText, {});

  const path = replacePathParams(endpoint.path, pathParams);
  const url = resolveUrl(path);

  const headers = {
    Accept: 'application/json',
  };

  if (endpoint.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  if (endpoint.auth) {
    const accessToken = state.session?.accessToken;
    if (!accessToken) {
      throw new Error(`Endpoint ${endpoint.path} requires an access token`);
    }
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (endpoint.csrf) {
    if (!state.csrfToken) {
      throw new Error('CSRF token is required. Use Sync CSRF first.');
    }
    headers['X-CSRF-Token'] = state.csrfToken;
  }

  return {
    url,
    requestInit: {
      method: endpoint.method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    path,
    body,
    pathParams,
  };
}

async function sendSelectedRequest() {
  const endpoint = getEndpoint(state.selectedEndpointId);
  const requestOptions = createRequestOptions(
    endpoint,
    nodes.pathParamsInput.value,
    nodes.requestBodyInput.value,
  );

  nodes.sendRequestButton.disabled = true;
  nodes.sendRequestButton.textContent = 'Sending...';

  try {
    const response = await fetch(requestOptions.url, requestOptions.requestInit);
    const contentType = response.headers.get('content-type') || '';
    const responseBody = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const message = responseBody?.error?.message || responseBody?.message || 'Request failed';
      const errorPayload = {
        status: response.status,
        statusText: response.statusText,
        error: responseBody?.error || responseBody,
      };
      nodes.responseOutput.textContent = prettyJson(errorPayload);
      state.lastEndpointStatus.set(endpoint.id, 'error');
      setActivity({
        method: endpoint.method,
        label: endpoint.title,
        status: `${response.status} ${message}`,
      });
      renderEndpointCatalog();
      throw new Error(message);
    }

    nodes.responseOutput.textContent =
      typeof responseBody === 'string' ? responseBody : prettyJson(responseBody);

    state.lastEndpointStatus.set(endpoint.id, 'ok');
    setActivity({
      method: endpoint.method,
      label: endpoint.title,
      status: `${response.status} ${response.statusText}`,
    });
    applyResponseSideEffects(endpoint, responseBody);
    renderSession();
    renderEndpointCatalog();
    return responseBody;
  } catch (error) {
    nodes.responseOutput.textContent = prettyJson({ message: error.message });
    state.lastEndpointStatus.set(endpoint.id, 'error');
    renderEndpointCatalog();
    throw error;
  } finally {
    nodes.sendRequestButton.disabled = false;
    nodes.sendRequestButton.textContent = 'Send request';
  }
}

function applyResponseSideEffects(endpoint, payload) {
  const data = payload?.data ?? payload;

  if (endpoint.id === 'login' || endpoint.id === 'register' || endpoint.id === 'refresh') {
    if (data?.accessToken || data?.refreshToken || data?.user) {
      persistSession({
        accessToken: data.accessToken || state.session?.accessToken || '',
        refreshToken: data.refreshToken || state.session?.refreshToken || '',
        user: data.user || state.session?.user || null,
        updatedAt: new Date().toISOString(),
      });
      persistSettings();
      renderSettings();
    }
  }

  if (endpoint.id === 'me' && data) {
    if (state.session) {
      persistSession({
        ...state.session,
        user: data,
        updatedAt: new Date().toISOString(),
      });
      renderSettings();
    }
  }

  if (endpoint.id === 'csrf' && data?.csrfToken) {
    state.csrfToken = data.csrfToken;
    nodes.csrfTokenInput.value = data.csrfToken;
    persistSettings();
    renderSettings();
  }

  if (endpoint.id === 'logout') {
    persistSession(null);
    renderSettings();
  }
}

async function refreshCurrentUser() {
  const meEndpoint = getEndpoint('me');
  state.selectedEndpointId = meEndpoint.id;
  loadEndpoint(meEndpoint.id);
  try {
    await sendSelectedRequest();
  } catch (error) {
    console.warn(error);
  }
}

function renderAll() {
  renderSettings();
  renderSession();
  renderActivity();
  renderEndpointCatalog();
  loadEndpoint(state.selectedEndpointId);
}

function bindEvents() {
  nodes.apiRootInput.addEventListener('change', () => {
    state.apiRoot = normalizeApiRoot(nodes.apiRootInput.value);
    persistSettings();
    renderSettings();
  });

  nodes.csrfTokenInput.addEventListener('change', () => {
    state.csrfToken = nodes.csrfTokenInput.value.trim();
    persistSettings();
    renderSettings();
  });

  nodes.saveSettingsButton.addEventListener('click', () => {
    state.apiRoot = normalizeApiRoot(nodes.apiRootInput.value);
    state.csrfToken = nodes.csrfTokenInput.value.trim();
    persistSettings();
    renderSettings();
    setActivity({
      method: 'SET',
      label: 'Settings saved',
      status: 'OK',
    });
  });

  nodes.syncCsrfButton.addEventListener('click', async () => {
    nodes.syncCsrfButton.disabled = true;
    nodes.syncCsrfButton.textContent = 'Syncing...';
    try {
      await ensureCsrfToken(true);
      nodes.responseOutput.textContent = prettyJson({ csrfToken: state.csrfToken });
      setActivity({
        method: 'GET',
        label: 'Sync CSRF',
        status: '200 OK',
      });
    } catch (error) {
      nodes.responseOutput.textContent = prettyJson({ message: error.message });
      setActivity({
        method: 'GET',
        label: 'Sync CSRF',
        status: `ERROR: ${error.message}`,
      });
    } finally {
      nodes.syncCsrfButton.disabled = false;
      nodes.syncCsrfButton.textContent = 'Sync CSRF';
    }
  });

  nodes.loadSessionButton.addEventListener('click', () => {
    if (!state.session?.accessToken) {
      nodes.responseOutput.textContent = prettyJson({ message: 'No session access token stored.' });
      return;
    }

    const endpoint = getEndpoint(state.selectedEndpointId);
    if (endpoint.auth && !state.session.accessToken) {
      nodes.responseOutput.textContent = prettyJson({ message: 'Session tokens are required for this endpoint.' });
      return;
    }

    renderSettings();
    setActivity({
      method: 'SET',
      label: 'Session tokens applied',
      status: 'OK',
    });
  });

  nodes.clearSessionButton.addEventListener('click', () => {
    persistSession(null);
    renderSession();
    renderSettings();
    setActivity({
      method: 'SET',
      label: 'Session cleared',
      status: 'OK',
    });
  });

  nodes.refreshMeButton.addEventListener('click', () => {
    refreshCurrentUser();
  });

  nodes.copyResponseButton.addEventListener('click', async () => {
    await navigator.clipboard.writeText(nodes.responseOutput.textContent);
    setActivity({
      method: 'COPY',
      label: 'Response copied',
      status: 'OK',
    });
  });

  nodes.refreshCatalogButton.addEventListener('click', renderEndpointCatalog);

  nodes.clearActivityButton.addEventListener('click', () => {
    state.activity = [];
    localStorage.removeItem(STORAGE_KEYS.log);
    renderActivity();
  });

  nodes.endpointSelect.addEventListener('change', (event) => {
    loadEndpoint(event.target.value);
  });

  nodes.endpointCatalog.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-select-endpoint]');
    if (!trigger) {
      return;
    }
    loadEndpoint(trigger.dataset.selectEndpoint);
  });

  nodes.endpointNav.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-select-endpoint]');
    if (!trigger) {
      return;
    }
    loadEndpoint(trigger.dataset.selectEndpoint);
  });

  nodes.sendRequestButton.addEventListener('click', async () => {
    try {
      await sendSelectedRequest();
    } catch (error) {
      console.warn(error);
    }
  });
}

async function bootstrap() {
  loadSettings();
  state.session = loadSession();
  restoreActivity();
  renderAll();
  bindEvents();
  try {
    await ensureCsrfToken();
  } catch (error) {
    nodes.responseOutput.textContent = prettyJson({
      message: 'CSRF token not synced automatically. Use the Sync CSRF button before POST requests.',
      detail: error.message,
    });
  }
}

bootstrap().catch((error) => {
  nodes.responseOutput.textContent = prettyJson({ message: error.message });
  console.error(error);
});