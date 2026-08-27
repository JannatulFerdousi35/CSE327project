const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config({path: __dirname + '/.env'});

const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret';

// Test 1: Valid auth token
const token = jwt.sign({ userId: 1 }, AUTH_SECRET, { expiresIn: '1h' });

function makeRequest(path, cookieHeader) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers: {},
    };
    if (cookieHeader) options.headers['Cookie'] = cookieHeader;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Test 1: my-reports WITH valid auth');
  const r1 = await makeRequest('/api/issues/my-reports', 'cab_auth=' + token);
  console.log('  Status:', r1.status, 'Body:', r1.body);

  console.log('\nTest 2: my-reports WITHOUT auth');
  const r2 = await makeRequest('/api/issues/my-reports');
  console.log('  Status:', r2.status, 'Body:', r2.body);

  console.log('\nTest 3: stats (no auth needed)');
  const r3 = await makeRequest('/api/issues/stats');
  console.log('  Status:', r3.status, 'Body:', r3.body);

  console.log('\nTest 4: /api/issues (no auth needed)');
  const r4 = await makeRequest('/api/issues');
  console.log('  Status:', r4.status, 'Body:', r4.body.substring(0, 200));
}

main().catch(console.error);
