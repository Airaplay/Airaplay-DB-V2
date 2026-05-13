/**
 * Enforces solid black background on the email header block (logo strip).
 * Keep in sync with `supabase/functions/_shared/emailHeaderStyle.ts`.
 */
export function enforceBlackEmailHeaderBackground(html: string): string {
  if (!html) return html;

  let out = html.replace(
    /\.header\s*\{[\s\S]*?\}/g,
    '.header { background: #000000; color: #ffffff; padding: 30px; text-align: center; }',
  );

  out = out.replace(
    /(<div\b[^>]*\bclass=["'][^"']*\bheader\b[^"']*["'][^>]*)\sstyle=["'][^"']*["']/gi,
    '$1style="background:#000000;color:#ffffff;padding:30px;text-align:center;"',
  );

  return out;
}
