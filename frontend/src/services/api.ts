import axios from 'axios';
import type {
  Farm, Disease, WeatherData, DashboardData, OfficerDashboardData,
  OfficerCase, ExpertProfile, Conversation, ChatMessage, NotificationItem,
  ReportData, PredictionResult, ExpertDashboardData, SatelliteData,
  FarmReportData, FarmTreatment, FarmReportHistoryItem,
  NotificationPreferences, PushDeliveryLogItem,
} from '../types';

const isNativePlatform = (): boolean => {
  if (typeof window === 'undefined') return false;
  const origin = window.location?.origin || '';
  return (
    origin.includes('capacitor://') ||
    origin.includes('ionic://') ||
    origin.startsWith('file://') ||
    Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
    // On Android Capacitor with androidScheme: 'https', origin is https://localhost
    (origin === 'https://localhost' && !(window as any).__VITE_DEV_SERVER_PORT__)
  );
};

export const getApiBase = () => {
  // Check user/runtime override first (e.g. if custom endpoint is configured)
  if (typeof window !== 'undefined') {
    const customApi = localStorage.getItem('agriguard_api_url')?.trim();
    if (customApi) {
      return customApi.endsWith('/api') ? customApi : `${customApi.replace(/\/+$/, '')}/api`;
    }
  }

  // 1. If running as native mobile app, use public HTTPS domain (never loopback https://localhost)
  if (isNativePlatform()) {
    const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
    if (envBase && !envBase.includes('localhost')) {
      return envBase.endsWith('/api') ? envBase : `${envBase.replace(/\/+$/, '')}/api`;
    }
    const pubUrl = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim();
    if (pubUrl && !pubUrl.includes('localhost')) {
      return `${pubUrl.replace(/\/+$/, '')}/api`;
    }
  }

  // 2. Web browser: Use current origin
  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    !isNativePlatform()
  ) {
    const origin = window.location.origin;
    return `${origin}/api`;
  }

  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envBase) {
    return envBase.endsWith('/api') ? envBase : `${envBase.replace(/\/+$/, '')}/api`;
  }
  return '/api';
};

export const API_BASE = getApiBase();

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach JWT token to every request and dynamically refresh baseURL
api.interceptors.request.use((config) => {
  const currentBase = getApiBase();
  if (currentBase && (!config.baseURL || config.baseURL === '/api' || isNativePlatform())) {
    config.baseURL = currentBase;
  }
  const token = localStorage.getItem('agriguard_token');
  if (token && token !== 'demo-token') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const lang = localStorage.getItem('agriguard_language') || 'en';
  config.headers['Accept-Language'] = lang;
  return config;
});

// Clear tokens only on true 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('agriguard_token');
      localStorage.removeItem('agriguard_refresh_token');
      localStorage.removeItem('agriguard_user');
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────
export const authApi = {
  login: async (email: string, password: string, role?: string) => {
    const loginPayload: { email: string; password: string; role?: string } = {
      email: email.trim().toLowerCase(),
      password,
    };
    if (role && role.trim()) {
      loginPayload.role = role.trim().toUpperCase();
    }
    const maxAttempts = 2; // Exactly 1 silent retry for genuine network errors
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await api.post('/auth/login', loginPayload, {
          timeout: 12000, // 12-second timeout for login
        });
        return res.data;
      } catch (err: any) {
        lastError = err;
        const status = err?.response?.status;

        // NEVER retry real auth errors (400, 401, 403, 422)
        if (status && (status < 500 || status === 401 || status === 403 || status === 422)) {
          throw err;
        }

        // Retry only for genuine transient network/server connection drop
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
      }
    }
    throw lastError;
  },
  register: async (registerData: {
    name: string;
    email: string;
    password: string;
    role?: string;
    specialization?: string;
    qualifications?: string;
    years_experience?: string;
    crops_expertise?: string[];
    bio?: string;
    assigned_region?: string;
    department?: string;
    phone?: string;
  }) => {
    const res = await api.post('/auth/register', registerData, { timeout: 15000 });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me', { timeout: 10000 });
    return res.data;
  },
  updateProfile: async (data: Record<string, any>) => {
    const res = await api.put('/auth/me', data);
    return res.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return res.data;
  },
  forgotPassword: async (email: string) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },
  refreshToken: async (refreshToken: string) => {
    const res = await api.post('/auth/refresh', { refresh_token: refreshToken });
    return res.data;
  },
};

// ─── Dashboard ───────────────────────────────────
export const dashboardApi = {
  getDashboard: async (): Promise<DashboardData> => {
    const res = await api.get('/dashboard');
    return res.data;
  },
};

// ─── Farms ───────────────────────────────────────
export const farmsApi = {
  getFarms: async (): Promise<{ farms: Farm[]; total: number }> => {
    const res = await api.get('/farms');
    return res.data;
  },
  getFarm: async (farmId: string): Promise<Farm> => {
    const res = await api.get(`/farms/${farmId}`);
    return res.data;
  },
  getSatellite: async (farmId: string): Promise<SatelliteData> => {
    const res = await api.get(`/farms/${farmId}/satellite`);
    return res.data;
  },
  createFarm: async (farmData: Partial<Farm>) => {
    const res = await api.post('/farms', farmData);
    return res.data;
  },
  updateFarm: async (farmId: string, data: Partial<Farm>) => {
    const res = await api.put(`/farms/${farmId}`, data);
    return res.data;
  },
  deleteFarm: async (farmId: string) => {
    const res = await api.delete(`/farms/${farmId}`);
    return res.data;
  },
};

// ─── Disease & ML ────────────────────────────────
export const diseaseApi = {
  getDiseases: async (params?: { crop?: string; search?: string; category?: string }): Promise<{ diseases: Disease[]; total: number }> => {
    const queryParams: any = {};
    if (params?.crop && params.crop !== 'All Crops') queryParams.crop = params.crop;
    if (params?.search) queryParams.search = params.search;
    if (params?.category) queryParams.category = params.category;
    const res = await api.get('/diseases', { params: queryParams });
    return res.data;
  },
  getDiseaseById: async (id: string): Promise<Disease> => {
    const res = await api.get(`/diseases/${id}`);
    return res.data;
  },
  enhanceImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/ml/enhance', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  validateImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/vision/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  predictDisease: async (formData: FormData): Promise<PredictionResult> => {
    const res = await api.post('/ml/predict', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return res.data;
  },
  getPredictions: async (farmId?: string) => {
    const params: any = {};
    if (farmId) params.farm_id = farmId;
    const res = await api.get('/predictions', { params });
    return res.data;
  },
  getPrediction: async (id: string) => {
    const res = await api.get(`/predictions/${id}`);
    return res.data;
  },
};

// ─── Weather ─────────────────────────────────────
export const weatherApi = {
  getWeather: async (params: { lat?: number; lon?: number; farm_id?: string }): Promise<WeatherData> => {
    const res = await api.get('/weather', { params });
    return res.data;
  },
};

// ─── Chat & Experts ──────────────────────────────
export const chatApi = {
  getExperts: async (): Promise<{ experts: ExpertProfile[] }> => {
    const res = await api.get('/experts');
    return res.data;
  },
  getConversations: async (): Promise<{ conversations: Conversation[] }> => {
    const res = await api.get('/conversations');
    return res.data;
  },
  getActiveConversation: async (): Promise<{ conversation: any | null }> => {
    const res = await api.get('/conversations/active');
    return res.data;
  },
  startConversation: async (expertId: string) => {
    const res = await api.post(`/conversations?expert_id=${expertId}`);
    return res.data;
  },
  getMessages: async (convId: string): Promise<{ messages: ChatMessage[]; total: number }> => {
    const res = await api.get(`/conversations/${convId}/messages`);
    return res.data;
  },
  sendMessage: async (convId: string, content: string, messageType: string = 'text') => {
    const res = await api.post(`/conversations/${convId}/messages`, {
      content,
      message_type: messageType,
    });
    return res.data;
  },
};

// ─── Officer ─────────────────────────────────────
export const officerApi = {
  getDashboard: async (): Promise<OfficerDashboardData> => {
    const res = await api.get('/officer/dashboard');
    return res.data;
  },
  getCases: async (params?: { status?: string; priority?: string; skip?: number; limit?: number }): Promise<{ cases: OfficerCase[]; total: number }> => {
    const res = await api.get('/officer/cases', { params });
    return res.data;
  },
  getCase: async (caseId: string) => {
    const res = await api.get(`/officer/cases/${caseId}`);
    return res.data;
  },
  getCaseHistory: async (caseId: string): Promise<{ case: OfficerCase; timeline: import('../types').CaseHistoryTimelineEvent[] }> => {
    const res = await api.get(`/officer/cases/${caseId}/history`);
    return res.data;
  },
  updateCase: async (caseId: string, data: { status?: string; officer_notes?: string; priority?: string; resolution_notes?: string }) => {
    const res = await api.put(`/officer/cases/${caseId}`, data);
    return res.data;
  },
  scheduleFieldVisit: async (data: { case_id: string; scheduled_date: string; notes?: string }) => {
    const res = await api.post('/officer/field-visits', data);
    return res.data;
  },
  addFieldReport: async (data: { case_id: string; title: string; content: string; recommendations?: string }) => {
    const res = await api.post('/officer/field-reports', data);
    return res.data;
  },
};

// ─── Expert ──────────────────────────────────────
export const expertApi = {
  getDashboard: async (): Promise<ExpertDashboardData> => {
    const res = await api.get('/expert/dashboard');
    return res.data;
  },
  getCases: async (params?: { status?: string; skip?: number; limit?: number }): Promise<{ cases: OfficerCase[]; total: number }> => {
    const res = await api.get('/expert/cases', { params });
    return res.data;
  },
  updateAvailability: async (isOnline: boolean) => {
    const res = await api.put('/expert/availability', { is_online: isOnline });
    return res.data;
  },
  getConsultations: async () => {
    const res = await api.get('/expert/consultations');
    return res.data;
  },
};

// ─── Notifications ───────────────────────────────
export const notificationsApi = {
  getNotifications: async (unreadOnly: boolean = false): Promise<{ notifications: NotificationItem[]; total: number; unread_count: number }> => {
    const res = await api.get('/notifications', { params: { unread_only: unreadOnly } });
    return res.data;
  },
  markRead: async (notifId: string) => {
    const res = await api.put(`/notifications/${notifId}/read`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await api.put('/notifications/read-all');
    return res.data;
  },
  getVapidPublicKey: async (): Promise<{ public_key: string }> => {
    const res = await api.get('/notifications/vapid-public-key');
    return res.data;
  },
  subscribeDevice: async (payload: {
    endpoint: string;
    keys?: { p256dh: string; auth: string };
    subscription_type?: string;
    device_info?: string;
  }) => {
    const res = await api.post('/notifications/subscribe', payload);
    return res.data;
  },
  unsubscribeDevice: async (endpoint: string) => {
    const res = await api.post('/notifications/unsubscribe', { endpoint });
    return res.data;
  },
  getPreferences: async (): Promise<NotificationPreferences> => {
    const res = await api.get('/notifications/preferences');
    return res.data;
  },
  updatePreferences: async (updates: Partial<NotificationPreferences>): Promise<{ status: string; preferences: NotificationPreferences }> => {
    const res = await api.put('/notifications/preferences', updates);
    return res.data;
  },
  sendTestPush: async () => {
    const res = await api.post('/notifications/test-push');
    return res.data;
  },
  getDeliveryLogs: async (limit: number = 20): Promise<{ logs: PushDeliveryLogItem[] }> => {
    const res = await api.get('/notifications/delivery-logs', { params: { limit } });
    return res.data;
  },
};

// ─── Reports ─────────────────────────────────────
export const reportsApi = {
  getReports: async (period: string = '30d', farmId?: string): Promise<ReportData> => {
    const params: any = { period };
    if (farmId) params.farm_id = farmId;
    const res = await api.get('/reports', { params });
    return res.data;
  },

  getFarmReport: async (farmId: string): Promise<FarmReportData> => {
    const res = await api.get(`/farms/${farmId}/report`);
    return res.data;
  },

  getReportHistory: async (farmId: string): Promise<{ reports: FarmReportHistoryItem[]; total: number }> => {
    const res = await api.get(`/farms/${farmId}/reports/history`);
    return res.data;
  },

  getTreatments: async (farmId: string): Promise<{ treatments: FarmTreatment[]; total: number }> => {
    const res = await api.get(`/farms/${farmId}/treatments`);
    return res.data;
  },

  createTreatment: async (
    farmId: string,
    data: {
      action_type: string;
      date: string;
      description: string;
      related_disease?: string;
      prediction_id?: string;
      notes?: string;
    }
  ): Promise<{ message: string; treatment: FarmTreatment }> => {
    const res = await api.post(`/farms/${farmId}/treatments`, data);
    return res.data;
  },

  deleteTreatment: async (farmId: string, treatmentId: string): Promise<void> => {
    const res = await api.delete(`/farms/${farmId}/treatments/${treatmentId}`);
    return res.data;
  },

  downloadPdf: async (farmId: string, farmName?: string, lang?: string): Promise<void> => {
    const res = await api.get(`/farms/${farmId}/report/pdf`, {
      params: lang ? { lang } : undefined,
      responseType: 'blob',
    });

    // Extract filename from header or fallback
    let filename = `AgriGuard_${(farmName || 'Farm').replace(/[^a-zA-Z0-9_\-]/g, '_')}_Report.pdf`;
    const disposition = res.headers['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = new Blob([res.data], { type: 'application/pdf' });

    // Universal browser & mobile download handling
    if (typeof window !== 'undefined') {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 2000);
    }
  },
};

// ─── AI Assistant & Vision API ───────────────────
export const aiApi = {
  chat: async (query: string, conversationId?: string, farmId?: string, language?: string) => {
    const lang = language || localStorage.getItem('agriguard_language') || 'en';
    const res = await api.post('/ai/chat', {
      query,
      conversation_id: conversationId,
      farm_id: farmId,
      language: lang,
    });
    return res.data;
  },
  streamChat: async (
    query: string,
    conversationId?: string,
    farmId?: string,
    onToken?: (token: string) => void,
    onStart?: (data: { conversation_id: string }) => void,
    onDone?: (data: any) => void,
    signal?: AbortSignal,
    language?: string
  ) => {
    const base = getApiBase();
    const token = localStorage.getItem('agriguard_token');
    const lang = language || localStorage.getItem('agriguard_language') || 'en';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Language': lang,
    };
    if (token && token !== 'demo-token') {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${base}/ai/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        conversation_id: conversationId,
        farm_id: farmId,
        language: lang,
      }),
      signal,
    });

    if (!response.ok) {
      let errDetail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        errDetail = errJson.detail || errJson.message || errDetail;
      } catch {
        // ignore
      }
      throw new Error(errDetail);
    }

    if (!response.body) {
      throw new Error('ReadableStream not supported');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'start' && onStart) {
              onStart(data);
            } else if (data.type === 'token' && onToken) {
              onToken(data.content);
            } else if (data.type === 'done' && onDone) {
              onDone(data);
            } else if (data.type === 'error') {
              throw new Error(data.error || 'AI stream error');
            }
          } catch (e: any) {
            if (trimmed.includes('"type": "error"')) throw e;
          }
        }
      }
    }
  },
  getConversations: async () => {
    const res = await api.get('/ai/conversations');
    return res.data;
  },
  getActiveConversation: async () => {
    const res = await api.get('/ai/conversations/active');
    return res.data;
  },
  getMessages: async (conversationId: string) => {
    const res = await api.get(`/ai/conversations/${conversationId}/messages`);
    return res.data;
  },
  deleteConversation: async (conversationId: string) => {
    const res = await api.delete(`/ai/conversations/${conversationId}`);
    return res.data;
  },
  createConversation: async (title?: string) => {
    const res = await api.post('/ai/conversations', null, { params: title ? { title } : {} });
    return res.data;
  },
  getSources: async () => {
    const res = await api.get('/ai/sources');
    return res.data;
  },
  getEvaluation: async () => {
    const res = await api.get('/ai/evaluation');
    return res.data;
  },
  getModelsStatus: async () => {
    const res = await api.get('/ai/models/status');
    return res.data;
  },
  submitExpertFeedback: async (data: {
    prediction_id?: string;
    image_path?: string;
    original_prediction: string;
    original_confidence: number;
    expert_label: string;
    crop?: string;
    disease?: string;
    notes?: string;
  }) => {
    const res = await api.post('/ai/expert-feedback', data);
    return res.data;
  },
};

export const visionApi = {
  validateImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/vision/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

export const translationApi = {
  translate: async (text: string, targetLanguage: string, sourceLanguage = 'en') => {
    const res = await api.post('/translation/translate', {
      text,
      target_language: targetLanguage,
      source_language: sourceLanguage,
    });
    return res.data as {
      original_text: string;
      translated_text: string;
      source_language: string;
      target_language: string;
      cached: boolean;
      service: string;
    };
  },
  getLanguages: async () => {
    const res = await api.get('/translation/languages');
    return res.data;
  },
  getGlossary: async () => {
    const res = await api.get('/translation/glossary');
    return res.data;
  },
};

export default api;

