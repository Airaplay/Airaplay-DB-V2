/**
 * Enforces solid black background on the email header block (logo strip).
 * Normalizes `.header { ... }` in embedded `<style>` and common inline `style=` on the header div.
 * Keep in sync with `src/lib/emailHeaderStyle.ts` (admin preview / save).
 */
export function enforceBlackEmailHeaderBackground(html: string): string {
  if (!html) return html;

  let out = html.replace(
    /\.header\s*\{[\s\S]*?\}/g,
    ".header { background: #000000; color: #ffffff; padding: 30px; text-align: center; }",
  );

  out = out.replace(
    /(<div\b[^>]*\bclass=["'][^"']*\bheader\b[^"']*["'][^>]*)\sstyle=["'][^"']*["']/gi,
    '$1style="background:#000000;color:#ffffff;padding:30px;text-align:center;"',
  );

  return out;
}
