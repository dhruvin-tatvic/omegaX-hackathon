export default function handler(req, res) {
  if (req.method === 'POST') {
    console.log('[Test Ride Submission]', req.body);
    res.writeHead(303, { Location: '/book-test-ride/thanks' });
    res.end();
    return;
  }
  res.status(405).send('Method Not Allowed');
}
