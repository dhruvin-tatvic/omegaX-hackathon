import express from 'express';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scenario = process.env.VITE_SCENARIO === 'dryrun' ? 'dryrun' : 'practice';
const problemsPath = path.join(__dirname, 'src/config', `problems_${scenario}.json`);
const problems = JSON.parse(fs.readFileSync(problemsPath, 'utf8'));

const app = express();

app.set('trust proxy', true);

// Planted problem: firewall_block (Render production path; not Vercel middleware)
app.use((req, res, next) => {
  const block = problems.firewall_block;
  if (!block?.enabled) {
    next();
    return;
  }
  const { path_prefix, user_agents } = block;
  const ua = req.get('user-agent') || '';
  if (path_prefix && req.path.startsWith(path_prefix)) {
    const denied = (user_agents || []).some(u =>
      ua.toLowerCase().includes(String(u).toLowerCase())
    );
    if (denied) {
      console.log(
        JSON.stringify({
          time: new Date().toISOString(),
          ip: req.ip,
          method: req.method,
          path: req.path,
          status: 403,
          userAgent: ua,
          action: 'firewall_blocked',
        })
      );
      res.status(403).end();
      return;
    }
  }
  next();
});

const logFormat = ':remote-addr - :method :url :status - ":user-agent"';
const accessLogFile = process.env.ACCESS_LOG_FILE;
if (accessLogFile) {
  const logPath = path.isAbsolute(accessLogFile)
    ? accessLogFile
    : path.join(__dirname, accessLogFile);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  app.use(morgan(logFormat, { stream: logStream }));
  app.use(morgan(logFormat));
} else {
  app.use(morgan(logFormat));
}

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir, { extensions: ['html'] }));

const sendIndex = (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
};

try {
  app.get('*', sendIndex);
} catch {
  app.get('{*splat}', sendIndex);
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} (scenario: ${scenario})`);
});
