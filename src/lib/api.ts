import urls from '../../backend/func2url.json';

const TOKEN_KEY = 'vf_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(base: string, path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export const auth = {
  register: (email: string, password: string, name: string) =>
    request(urls.auth, '/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request(urls.auth, '/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  profile: () => request(urls.auth, '/profile'),
  updateProfile: (data: { name?: string; avatar_url?: string }) =>
    request(urls.auth, '/profile', { method: 'PUT', body: JSON.stringify(data) }),
  logout: () => request(urls.auth, '/logout', { method: 'POST' }),
};

export const wallet = {
  balance: () => request(urls.wallet, '/balance'),
  topup: (amount: number) =>
    request(urls.wallet, '/topup', { method: 'POST', body: JSON.stringify({ amount }) }),
  purchase: (item: { item_type: string; item_id: string; item_name: string; price: number }) =>
    request(urls.wallet, '/purchase', { method: 'POST', body: JSON.stringify(item) }),
  transactions: (limit = 20, offset = 0) =>
    request(urls.wallet, `/transactions?limit=${limit}&offset=${offset}`),
  purchases: () => request(urls.wallet, '/purchases'),
};

export const projects = {
  list: () => request(urls.projects, '/list'),
  create: (name: string, description = '', project_data = {}) =>
    request(urls.projects, '/create', { method: 'POST', body: JSON.stringify({ name, description, project_data }) }),
  get: (id: number) => request(urls.projects, `/get?id=${id}`),
  save: (data: { id: number; name?: string; description?: string; project_data?: object }) =>
    request(urls.projects, '/save', { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request(urls.projects, '/delete', { method: 'POST', body: JSON.stringify({ id }) }),
};

export const admin = {
  stats: () => request(urls.admin, '/stats'),
  users: (limit = 20, offset = 0, search = '') =>
    request(urls.admin, `/users?limit=${limit}&offset=${offset}&search=${search}`),
  updateUser: (data: { user_id: number; role?: string; is_active?: boolean; name?: string }) =>
    request(urls.admin, '/users/update', { method: 'PUT', body: JSON.stringify(data) }),
  adjustBalance: (user_id: number, amount: number, reason: string) =>
    request(urls.admin, '/users/adjust-balance', { method: 'POST', body: JSON.stringify({ user_id, amount, reason }) }),
  transactions: (limit = 50, offset = 0) =>
    request(urls.admin, `/transactions?limit=${limit}&offset=${offset}`),
};

export default { auth, wallet, projects, admin };
