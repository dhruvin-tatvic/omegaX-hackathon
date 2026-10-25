/**
 * Public site URL for sitemap, robots, PDFs, and audit scripts.
 * On Render: set VITE_SITE_URL to RENDER_EXTERNAL_URL at build time.
 */
export function getSiteUrl() {
  const raw =
    process.env.SITE_URL ||
    process.env.VITE_SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    '';
  const url = raw.replace(/\/$/, '');
  if (url) return url;
  return 'http://localhost:4173';
}
