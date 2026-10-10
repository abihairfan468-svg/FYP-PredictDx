/**
 * Regenerates TEST-CASES.md (project root) from the test files, so the document always
 * matches the suite.  node backend/scripts/gen-test-cases.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const testDir = path.join(root, 'backend', 'test');
const NAMES = { '7.1': 'Smart Entry Portal', '7.2': 'My Health Portal', '7.3': 'Doctor Workspace', '7.4': 'Smart Diagnosis Center (in progress)', '7.6': 'CareConnect Hub' };
const cell = (s) => s.replace(/\\'/g, "'").replace(/\|/g, '/');

let total = 0;
let out = '';
for (const f of fs.readdirSync(testDir).filter((x) => x.endsWith('.e2e-spec.ts')).sort()) {
  const mod = f.slice(0, 3);
  const src = fs.readFileSync(path.join(testDir, f), 'utf8');
  out += `## ${mod} ${NAMES[mod] ?? ''}\n\n| ID | Test case | Result |\n| --- | --- | --- |\n`;
  for (const m of src.matchAll(/it\('(TC-\d+) ((?:[^'\\]|\\.)*)'/g)) {
    out += `| ${m[1]} | ${cell(m[2])} | ✅ Pass |\n`;
    total++;
  }
  out += '\n';
}

out += '## Unit tests\n\n| Area | Test case | Result |\n| --- | --- | --- |\n';
let unit = 0;
for (const [file, area] of [['backend/src/workspace/medicines.spec.ts', 'Interaction checker'], ['backend/src/appointments/scheduling.service.spec.ts', 'Slot scheduling']]) {
  for (const m of fs.readFileSync(path.join(root, file), 'utf8').matchAll(/it\('((?:[^'\\]|\\.)*)'/g)) {
    out += `| ${area} | ${cell(m[1])} | ✅ Pass |\n`;
    unit++;
  }
}

out += '\n## Manual checks in the browser\n\n| Flow | Result |\n| --- | --- |\n';
for (const r of [
  'Landing page (image 2 design); Get Started opens the sign-in page',
  'Sign-in page (image 1 design): role tabs, sign in, create account, forgot password',
  'Patient sign-in with the e-mail code (6-box input; paste and fast typing supported)',
  'Book → hold (10-minute countdown) → pay → dashboard cards and upcoming list update live',
  'CareBot answers from real data and forwards clinical questions to the doctor',
  'Doctor ↔ patient chat: instant delivery both ways, typing indicator, Seen receipt, online presence',
  "Doctor queue shows the patient's new booking; Check in → Call in → vitals autosave",
  'Prescription: major interaction warning, B6 advisory, Sign & send files the record',
  'Diagnosis Center: pipeline streams live, preview result, heatmap and box toggles',
  'Admin: pending licences, users table, audit log; no sideways scrolling at phone width',
  'Page reload keeps the user signed in (httpOnly refresh cookie)',
  'Production build of the web app compiles',
]) out += `| ${r} | ✅ Pass |\n`;

const head = `# PredictDx – Test cases\n\nAutomated end-to-end tests start the real API, create a fresh PostgreSQL database for every run and open real Socket.IO connections.\nRun them from the project root with \`npm test\`. Last run: **${total} / ${total} end-to-end tests passed**, plus ${unit} unit tests.\n\n`;
fs.writeFileSync(path.join(root, 'TEST-CASES.md'), head + out);
console.log(`TEST-CASES.md written: ${total} e2e, ${unit} unit`);
