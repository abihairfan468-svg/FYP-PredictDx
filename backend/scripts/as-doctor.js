/**
 * Dev helper: act as a second user from the terminal while you watch the web app.
 *   node scripts/as-doctor.js "Message text" [email] [password]
 * Signs in through the real API (password + OTP from the dev echo), connects to
 * Socket.IO, shows a typing indicator, sends the message to the latest direct thread,
 * then prints anything the other side sends for 20 seconds.
 */
const { io } = require('socket.io-client');

const BASE = process.env.API ?? 'http://localhost:3000';
const text = process.argv[2] ?? 'Hello from the doctor terminal';
const email = process.argv[3] ?? 'a.rehman@predictdx.com';
// Default: Dr Adeel Rehman's password (all passwords are in LOGINS.md).
const password = process.argv[4] ?? process.env.PDX_PASSWORD ?? 'Adeel@Shifa204';
const role = email.startsWith('admin') ? 'ADMIN' : email.endsWith('@predictdx.com') && !/(ayesha|bilal|hira|usman\.tariq)/.test(email) ? 'DOCTOR' : 'PATIENT';

async function call(path, body, token) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${JSON.stringify(data)}`);
  return data;
}

(async () => {
  const login = await call('/auth/login', { email, password, role });
  const session = await call('/auth/mfa/verify', { mfaToken: login.mfaToken, code: login.devCode });
  const token = session.accessToken;
  console.log(`signed in as ${session.user.fullName} (${session.user.role})`);

  const threads = await call('/chat/threads', undefined, token);
  const thread = threads.find((t) => t.kind === 'DIRECT');
  if (!thread) throw new Error('no direct thread');
  console.log(`thread with ${thread.other.name}`);

  const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
  socket.on('message:new', ({ message }) => message.senderId !== session.user.id && console.log(`<- ${message.body}`));
  socket.on('typing', (p) => p.typing && console.log(`   (${p.name} is typing…)`));
  socket.on('notification', (n) => console.log(`[notification] ${n.title}: ${n.body}`));
  // 'ready' is sent by the server once the socket is authenticated (after 'connect').
  await new Promise((r) => socket.on('ready', r));
  console.log('socket connected');

  socket.emit('typing', { threadId: thread.id, typing: true });
  await new Promise((r) => setTimeout(r, 2500));
  socket.emit('typing', { threadId: thread.id, typing: false });
  await call(`/chat/threads/${thread.id}/messages`, { body: text }, token);
  console.log(`-> ${text}`);

  await new Promise((r) => setTimeout(r, Number(process.env.LISTEN_MS ?? 20000)));
  socket.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
