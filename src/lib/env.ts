/** Browser / platform detection helpers (client only). */

export function isSecure(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export function hasCameraApi(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/** In-app webviews that commonly block getUserMedia. */
export function inAppBrowserName(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): string | null {
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return "Facebook";
  if (/WhatsApp/i.test(ua)) return "WhatsApp";
  if (/musical_ly|Bytedance|TikTok|trill/i.test(ua)) return "TikTok";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/\bLine\//i.test(ua)) return "LINE";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  if (/Twitter|TwitterAndroid/i.test(ua)) return "X";
  if (/; wv\)/.test(ua) && /Android/i.test(ua)) return "WebView";
  return null;
}

export function isIOS(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isMobile(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || isIOS(ua);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
