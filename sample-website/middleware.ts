import problemsPractice from './src/config/problems_practice.json';
import problemsDryrun from './src/config/problems_dryrun.json';

const scenario = process.env.VITE_SCENARIO === 'dryrun' ? 'dryrun' : 'practice';
const problems = scenario === 'dryrun' ? problemsDryrun : problemsPractice;

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.headers.get('x-forwarded-for') || '';
  const referer = request.headers.get('referer') || '';
  const method = request.method;

  // Check firewall_block
  if (problems.firewall_block && problems.firewall_block.enabled) {
    const { path_prefix, user_agents } = problems.firewall_block;
    if (url.pathname.startsWith(path_prefix)) {
      const isBlocked = user_agents.some((ua: string) =>
        userAgent.toLowerCase().includes(ua.toLowerCase())
      );
      if (isBlocked) {
        // Log blocked request
        console.log(JSON.stringify({
          time: new Date().toISOString(),
          ip,
          method,
          path: url.pathname,
          status: 403,
          referrer: referer,
          userAgent,
          action: 'firewall_blocked'
        }));
        return new Response('', { status: 403 });
      }
    }
  }

  // Request logging
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    ip,
    method,
    path: url.pathname,
    status: 200,
    referrer: referer,
    userAgent
  }));
}

export const config = {
  matcher: ['/((?!_next|assets|favicon.ico).*)'],
};
