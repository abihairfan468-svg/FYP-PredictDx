/** Private network addresses: localhost, 10.x, 172.16-31.x, 192.168.x (the Wi-Fi at home or on campus). */
const LOCAL_NETWORK = /^https?:\/\/(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|192\.168(\.\d{1,3}){2})(:\d+)?$/;

/**
 * Which browser origins may call the API: the WEB_ORIGIN list, plus - in development only - any
 * device on the local network, so the website and mobile app can be opened on a phone over Wi-Fi.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // native apps and server-to-server calls send no Origin
  const listed = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim());
  if (listed.includes(origin)) return true;
  return process.env.NODE_ENV !== 'production' && LOCAL_NETWORK.test(origin);
}
