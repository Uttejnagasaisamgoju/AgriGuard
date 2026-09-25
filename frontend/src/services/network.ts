import api from './api';

export interface NetworkInfo {
  local_ip: string;
  frontend_port: number;
  backend_port: number;
  public_url?: string;
  share_url: string;
  apk_url: string;
}

let cachedNetworkInfo: NetworkInfo | null = null;

export async function getNetworkInfo(): Promise<NetworkInfo> {
  if (cachedNetworkInfo) return cachedNetworkInfo;

  try {
    const res = await api.get('/system/network-info');
    if (res.data && (res.data.local_ip || res.data.public_url)) {
      cachedNetworkInfo = res.data;
      return res.data;
    }
  } catch (err) {
    console.warn('Unable to query /system/network-info, using window.location fallback', err);
  }

  // Fallback if backend is unavailable or offline
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://demo.agriguard.app';

  const fallback: NetworkInfo = {
    local_ip: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
    frontend_port: 3001,
    backend_port: 8000,
    public_url: origin,
    share_url: `${origin}/?screen=download`,
    apk_url: `${origin}/downloads/AgriGuard.apk`,
  };

  cachedNetworkInfo = fallback;
  return fallback;
}

export function getShareUrlSync(): string {
  if (cachedNetworkInfo) return cachedNetworkInfo.share_url;
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://demo.agriguard.app';
  return `${origin}/?screen=download`;
}

