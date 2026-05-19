/** Email-safe HTML snippets for the marketing composer (table buttons + store badges). */

const supabasePublic =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') || '';

/** Hosted in `app-assets` when uploaded; falls back to official badge artwork. */
export const EMAIL_PLAY_STORE_BADGE_SRC =
  supabasePublic
    ? `${supabasePublic}/storage/v1/object/public/app-assets/google-play-badge.png`
    : 'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png';

export const EMAIL_APP_STORE_BADGE_SRC =
  supabasePublic
    ? `${supabasePublic}/storage/v1/object/public/app-assets/app-store-badge.png`
    : 'https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83';

export const DEFAULT_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.airaplay.app';

export const DEFAULT_APP_STORE_URL = 'https://apps.apple.com/app/airaplay';

export function buildEmailCtaButtonHtml(label: string, href: string): string {
  const safeLabel = label.trim() || 'Learn more';
  const safeHref = href.trim() || 'https://airaplay.com';
  return `<p style="text-align:center;margin:20px 0;">
  <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#000000;background:#000000;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;font-weight:700;line-height:1.2;">${safeLabel}</a>
</p>`;
}

export function buildPlayStoreBadgeHtml(href: string): string {
  const safeHref = href.trim() || DEFAULT_PLAY_STORE_URL;
  return `<p style="text-align:center;margin:16px 0;">
  <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
    <img src="${EMAIL_PLAY_STORE_BADGE_SRC}" alt="Get it on Google Play" width="135" height="40" style="display:block;border:0;max-width:100%;height:auto;">
  </a>
</p>`;
}

export function buildAppStoreBadgeHtml(href: string): string {
  const safeHref = href.trim() || DEFAULT_APP_STORE_URL;
  return `<p style="text-align:center;margin:16px 0;">
  <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
    <img src="${EMAIL_APP_STORE_BADGE_SRC}" alt="Download on the App Store" width="120" height="40" style="display:block;border:0;max-width:100%;height:auto;">
  </a>
</p>`;
}

export function buildStoreBadgesRowHtml(playHref: string, appStoreHref: string): string {
  const play = playHref.trim() || DEFAULT_PLAY_STORE_URL;
  const apple = appStoreHref.trim() || DEFAULT_APP_STORE_URL;
  return `<p style="text-align:center;margin:20px 0;line-height:0;">
  <a href="${play}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 8px;text-decoration:none;vertical-align:middle;">
    <img src="${EMAIL_PLAY_STORE_BADGE_SRC}" alt="Get it on Google Play" width="135" height="40" style="display:block;border:0;max-width:100%;height:auto;">
  </a>
  <a href="${apple}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 8px;text-decoration:none;vertical-align:middle;">
    <img src="${EMAIL_APP_STORE_BADGE_SRC}" alt="Download on the App Store" width="120" height="40" style="display:block;border:0;max-width:100%;height:auto;">
  </a>
</p>`;
}
