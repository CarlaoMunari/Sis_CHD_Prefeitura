const API_URL = 'http://localhost:3000/api';

// Função auxiliar para fazer requisições
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro na requisição');
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Erro na API:', error);
    throw error;
  }
}

// API de toners
const API = {
  toners: {
    getAll: () => fetchAPI('/toners'),
    getById: (id) => fetchAPI(`/toners/${id}`),
    create: (data) => fetchAPI('/toners', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchAPI(`/toners/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => fetchAPI(`/toners/${id}`, { method: 'DELETE' }),
    getStats: () => fetchAPI('/toners/stats'),
  },
};
