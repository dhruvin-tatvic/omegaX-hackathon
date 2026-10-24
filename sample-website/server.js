import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust reverse proxy (e.g. Render, Cloudflare) so req.ip and morgan :remote-addr capture client IP
app.set('trust proxy', true);

// Configure morgan logging: remote IP, HTTP method, URL, status code, and User-Agent
const logFormat = ':remote-addr - :method :url :status - ":user-agent"';
app.use(morgan(logFormat));

// Serve static files from the dist directory
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir, { extensions: ['html'] }));

// Catch-all route (*) that serves dist/index.html to support frontend routing
// (Compatible with Express 4 '*' and Express 5 '{*splat}')
const sendIndex = (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
};

try {
  app.get('*', sendIndex);
} catch {
  app.get('{*splat}', sendIndex);
}

// Listen on process.env.PORT or default to 10000
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
