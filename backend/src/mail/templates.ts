/**
 * Transactional e-mail templates in the usual industry structure: preheader, brand header,
 * heading, greeting, message, call-out (the code), security note and footer.
 * Built with tables and inline styles because Gmail, Outlook and phone mail apps ignore
 * <style> blocks and modern CSS layout.
 */

const BRAND = '#0F2744';
const ACCENT = '#1D5FD1';
const MUTED = '#5B6B84';
const BG = '#F1F4F9';

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Shared shell: hidden preheader, header bar, white card, footer. `body` is trusted HTML. */
export function layout(opts: { title: string; preheader: string; body: string }) {
  const { title, preheader, body } = opts;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
      <tr><td style="background:${BRAND};border-radius:10px 10px 0 0;padding:20px 28px;">
        <span style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:.04em;">PredictDx</span>
        <span style="color:#A9C4EC;font-size:12px;padding-left:10px;">Predict disease &middot; save lives</span>
      </td></tr>
      <tr><td style="background:#FFFFFF;padding:32px 28px 28px;border-left:1px solid #E1E7F0;border-right:1px solid #E1E7F0;">
        <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${BRAND};font-weight:700;">${escapeHtml(title)}</h1>
        ${body}
      </td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid #E1E7F0;border-top:0;border-radius:0 0 10px 10px;padding:0 28px 24px;">
        <hr style="border:0;border-top:1px solid #E1E7F0;margin:0 0 16px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
          This is an automated message from PredictDx, please do not reply.<br>
          PredictDx is a decision-support system: AI results support, and never replace, a physician's judgement.
        </p>
      </td></tr>
      <tr><td align="center" style="padding:16px 8px 0;font-size:11px;line-height:1.6;color:#8A97AC;">
        PredictDx &middot; AI multimodal chest disease platform &middot; Air University Islamabad
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const p = (html: string, extra = '') =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1F2A3D;${extra}">${html}</p>`;

export type CodePurpose = 'VERIFY_EMAIL' | 'LOGIN_MFA' | 'RESET_PASSWORD';

const CODE_COPY: Record<CodePurpose, { subject: string; title: string; lead: string; ignore: string }> = {
  VERIFY_EMAIL: {
    subject: 'Verify your PredictDx e-mail address',
    title: 'Verify your e-mail address',
    lead: 'Thank you for creating a PredictDx account. Enter this code on the verification screen to confirm that this e-mail address belongs to you:',
    ignore: 'If you did not create a PredictDx account, you can safely ignore this e-mail.',
  },
  LOGIN_MFA: {
    subject: 'Your PredictDx sign-in code',
    title: 'Your sign-in code',
    lead: 'Someone (hopefully you) entered your password on PredictDx. Enter this code to finish signing in:',
    ignore: 'If this was not you, someone may know your password. Do not share this code, and change your password from Account &amp; Security.',
  },
  RESET_PASSWORD: {
    subject: 'Reset your PredictDx password',
    title: 'Reset your password',
    lead: 'We received a request to reset your PredictDx password. Enter this code on the reset screen to choose a new password:',
    ignore: 'If you did not ask to reset your password, ignore this e-mail; your password will not change.',
  },
};

/** One-time code e-mail: subject, plain-text and HTML versions. */
export function codeEmail(purpose: CodePurpose, name: string, code: string, minutes: number) {
  const c = CODE_COPY[purpose];
  const first = name.trim().split(/\s+/)[0] || 'there';
  const html = layout({
    title: c.title,
    preheader: `Your PredictDx code is ${code}. It expires in ${minutes} minutes.`,
    body: [
      p(`Hello ${escapeHtml(first)},`),
      p(c.lead),
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 18px;"><tr><td align="center"
         style="background:#EEF4FF;border:1px solid #C9DAF8;border-radius:10px;padding:18px 12px;">
         <div style="font-size:12px;letter-spacing:.12em;color:${MUTED};text-transform:uppercase;margin-bottom:6px;">Your verification code</div>
         <div style="font-family:Consolas,'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:${ACCENT};">${escapeHtml(code)}</div>
       </td></tr></table>`,
      p(`This code expires in <b>${minutes} minutes</b> and can be used only once.`),
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 6px;"><tr><td
         style="background:#FFF8E6;border-left:4px solid #E6A23C;border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.6;color:#5C4813;">
         <b>Keep this code private.</b> PredictDx staff will never ask you for it.<br>${c.ignore}
       </td></tr></table>`,
    ].join('\n'),
  });
  const text = [
    `Hello ${first},`,
    '',
    c.lead.replace(/&amp;/g, '&'),
    '',
    `    ${code}`,
    '',
    `This code expires in ${minutes} minutes and can be used only once.`,
    'Keep this code private. PredictDx staff will never ask you for it.',
    c.ignore.replace(/&amp;/g, '&'),
    '',
    '- PredictDx (automated message, please do not reply)',
  ].join('\n');
  return { subject: c.subject, text, html };
}

/**
 * Any other notice (booking confirmed, prescription, doctor approval...). Lines starting with
 * "•" become a list; everything else becomes paragraphs.
 */
export function noticeEmail(subject: string, text: string) {
  const blocks: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(`<ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.7;color:#1F2A3D;">${list.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`);
      list = [];
    }
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('•')) { list.push(line.slice(1).trim()); continue; }
    flush();
    if (line) blocks.push(p(escapeHtml(line)));
  }
  flush();
  return layout({ title: subject.replace(/^Your PredictDx /i, 'Your ').replace(/^PredictDx: /, ''), preheader: text.split('\n').find((l) => l.trim()) ?? subject, body: blocks.join('\n') });
}

/** "Hello Ayesha," from a full name, for the first line of notice e-mails. */
export const greeting = (fullName: string) => `Hello ${fullName.replace(/^Dr\.?\s+/i, 'Dr ').trim().split(/\s+/).slice(0, fullName.startsWith('Dr') ? 2 : 1).join(' ')},`;
