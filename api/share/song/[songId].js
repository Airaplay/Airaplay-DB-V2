import { createClient } from '@supabase/supabase-js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toAbsoluteUrl(url, origin) {
  const u = String(url ?? '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) return `${origin}${u}`;
  return `${origin}/${u}`;
}

export default async function handler(req, res) {
  try {
    const origin =
      process.env.PUBLIC_ORIGIN ||
      process.env.PRODUCTION_ORIGIN ||
      'https://airaplay.com';

    const songId = req?.query?.songId;
    if (!songId || typeof songId !== 'string') {
      res.statusCode = 400;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('Missing songId');
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    const fallbackImage = `${origin}/official_airaplay_logo.png`;
    const songUrl = `${origin}/song/${encodeURIComponent(songId)}`;

    let title = 'Airaplay';
    let description = 'Discover and stream amazing music from talented artists worldwide';
    let image = fallbackImage;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });

      const { data, error } = await supabase
        .from('songs')
        .select(
          `
          id,
          title,
          cover_image_url,
          artists:artist_id (
            id,
            name,
            artist_profiles (stage_name)
          )
        `
        )
        .eq('id', songId)
        .maybeSingle();

      if (!error && data) {
        const artistName =
          data?.artists?.artist_profiles?.[0]?.stage_name || data?.artists?.name || 'Unknown Artist';
        title = `${data.title} — ${artistName}`;
        description = `Check out "${data.title}" by ${artistName} on Airaplay!`;
        image = toAbsoluteUrl(data.cover_image_url, origin) || fallbackImage;
      }
    }

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="music.song" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:url" content="${escapeHtml(songUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(`/song/${encodeURIComponent(songId)}`)}" />
  </head>
  <body></body>
</html>`;

    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    // Cache at the edge, but allow quick updates.
    res.setHeader('cache-control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    res.end(html);
  } catch (err) {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html><head><meta http-equiv="refresh" content="0;url=/"></head><body></body></html>`);
  }
}

