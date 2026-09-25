import { notificationsApi } from './api';
import type { NotificationPreferences, PushDeliveryLogItem } from '../types';

/**
 * Utility to convert URL-safe base64 VAPID public key string to Uint8Array
 * required by browser pushManager.subscribe().
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class PushNotificationService {
  /**
   * Checks whether the current browser or environment supports Web Push.
   */
  public isPushSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Current notification permission: 'default', 'granted', or 'denied'.
   */
  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Retrieves active Web Push subscription from the service worker if one exists.
   */
  public async getExistingSubscription(): Promise<PushSubscription | null> {
    if (!this.isPushSupported()) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch (e) {
      console.warn('[Push] Error checking existing subscription:', e);
      return null;
    }
  }

  /**
   * Requests permission with user explanation and subscribes device to push notifications.
   * Fetches the server VAPID key and registers the subscription on the backend.
   */
  public async requestPermissionAndSubscribe(): Promise<{
    success: boolean;
    error?: string;
    permission: NotificationPermission;
    subscription?: PushSubscription;
  }> {
    if (!this.isPushSupported()) {
      return {
        success: false,
        error: 'Push notifications are not supported on this browser or device.',
        permission: 'denied',
      };
    }

    try {
      // 1. Request notification permission from the user
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return {
          success: false,
          error: permission === 'denied' ? 'Notification permission was denied.' : 'Notification permission was dismissed.',
          permission,
        };
      }

      // 2. Fetch server VAPID public key
      const { public_key } = await notificationsApi.getVapidPublicKey();
      if (!public_key) {
        throw new Error('VAPID public key could not be retrieved from server.');
      }

      // 3. Ensure service worker is registered and ready
      const registration = await navigator.serviceWorker.ready;

      // 4. Subscribe to Push Service using standard VAPID key
      const convertedVapidKey = urlBase64ToUint8Array(public_key);
      let subscription = await registration.pushManager.getSubscription();

      // If existing subscription is expired or different, renew it
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as any,
        });
      }

      // 5. Serialize subscription keys
      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.p256dh || '';
      const auth = subJson.keys?.auth || '';

      // 6. Register device token on AgriGuard backend
      const deviceInfo = `${navigator.userAgent} (${navigator.platform || 'Unknown OS'})`;
      await notificationsApi.subscribeDevice({
        endpoint: subscription.endpoint,
        keys: { p256dh, auth },
        subscription_type: 'web_push',
        device_info: deviceInfo,
      });

      localStorage.setItem('agriguard_push_subscribed', 'true');
      console.log('[Push] Device push subscription registered successfully.');

      return {
        success: true,
        permission: 'granted',
        subscription,
      };
    } catch (err: any) {
      console.error('[Push] Failed to subscribe device:', err);
      return {
        success: false,
        error: err?.message || 'Failed to initialize device push notifications.',
        permission: this.getPermissionStatus(),
      };
    }
  }

  /**
   * Unsubscribes current device from Web Push and deactivates subscription on backend.
   */
  public async unsubscribe(): Promise<boolean> {
    if (!this.isPushSupported()) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await notificationsApi.unsubscribeDevice(endpoint).catch(() => {});
      }
      localStorage.removeItem('agriguard_push_subscribed');
      return true;
    } catch (e) {
      console.error('[Push] Error unsubscribing:', e);
      return false;
    }
  }

  /**
   * Notification preferences management
   */
  public async getPreferences(): Promise<NotificationPreferences> {
    return await notificationsApi.getPreferences();
  }

  public async updatePreferences(updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const res = await notificationsApi.updatePreferences(updates);
    return res.preferences;
  }

  public async sendTestPush(): Promise<any> {
    return await notificationsApi.sendTestPush();
  }

  public async getDeliveryLogs(): Promise<PushDeliveryLogItem[]> {
    const res = await notificationsApi.getDeliveryLogs(20);
    return res.logs || [];
  }
}

export const pushService = new PushNotificationService();
