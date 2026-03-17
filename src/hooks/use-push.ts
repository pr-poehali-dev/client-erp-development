import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePush(token: string) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (ok) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!token || !supported) return;
    api.push.checkSubscription(token).then(r => setSubscribed(r.subscribed)).catch(() => {});
  }, [token, supported]);

  const subscribe = useCallback(async () => {
    if (!supported || !token) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") { setLoading(false); return false; }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const { vapid_public_key } = await api.push.vapidKey();
      if (!vapid_public_key) { setLoading(false); return false; }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid_public_key),
        });
      }

      await api.push.subscribe(token, sub.toJSON(), navigator.userAgent);
      setSubscribed(true);
      setLoading(false);
      return true;
    } catch {
      setLoading(false);
      return false;
    }
  }, [supported, token]);

  const unsubscribe = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api.push.unsubscribe(token, sub.endpoint);
          await sub.unsubscribe();
        }
      }
      setSubscribed(false);
    } catch (e) { void e; }
    setLoading(false);
  }, [token]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}

export default usePush;