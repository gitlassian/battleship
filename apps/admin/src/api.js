// Client for the cat-shop API (contract v0 in plan.md on the agentbridge board).
// With VITE_USE_MOCK=1 every call goes to an in-memory mock instead, so the admin panel
// can be developed before apps/api exists.
import * as mock from './mock.js';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1';
const TOKEN_KEY = 'catshop_admin_token';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session simply won't survive a reload.
  }
}

// Fired when the API rejects the token, so the app can send the user back to the login page.
export const UNAUTHORIZED_EVENT = 'catshop:unauthorized';

function handleUnauthorized() {
  setToken(null);
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

async function request(method, path, body) {
  if (USE_MOCK) {
    try {
      return await mock.handle(method, path, body, getToken());
    } catch (err) {
      if (err.status === 401 && !path.endsWith('/login')) handleUnauthorized();
      throw new ApiError(err.status || 500, err.message);
    }
  }

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Сервер недоступен. Проверьте, что API запущен.');
  }

  if (res.status === 401 && !path.endsWith('/login')) handleUnauthorized();
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Ошибка ${res.status}`);
  }
  return data;
}

function query(params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const api = {
  login: (password) => request('POST', '/api/admin/login', { password }),
  stats: () => request('GET', '/api/admin/stats'),
  breeds: () => request('GET', '/api/breeds'),

  listCats: (params) => request('GET', `/api/admin/cats${query(params)}`),
  createCat: (cat) => request('POST', '/api/admin/cats', cat),
  updateCat: (id, patch) => request('PATCH', `/api/admin/cats/${id}`, patch),
  deleteCat: (id) => request('DELETE', `/api/admin/cats/${id}`),
  uploadPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return request('POST', '/api/admin/upload', form);
  },

  listOrders: (params) => request('GET', `/api/admin/orders${query(params)}`),
  setOrderStatus: (id, status) => request('PATCH', `/api/admin/orders/${id}`, { status }),
};

export const usingMock = USE_MOCK;
