/** Baked at build time from VITE_SITE_URL (Render: use RENDER_EXTERNAL_URL). */
const raw = import.meta.env.VITE_SITE_URL || 'http://localhost:4173';
export const SITE_URL = raw.replace(/\/$/, '');
