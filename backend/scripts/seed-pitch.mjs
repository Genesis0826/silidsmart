import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, backup } from 'node:sqlite';
import { createSilidSmartService } from '../src/service.mjs';
import { PITCH_EMAIL } from '../src/pitch-seed.mjs';

const args = process.argv.slice(2);
let restore = false;
let dbPath = fileURLToPath(new URL('../data/silidsmart.sqlite', import.meta.url));
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--restore') restore = true;
  else if (args[i] === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) dbPath = path.resolve(args[++i]);
  else if (args[i] === '--help') {
    console.log('npm run seed:pitch [-- --restore] [-- --db PATH]\nAdds five fictional pitch units under a separate owner. Default preserves existing pitch progress.\n--restore resets only the identified pitch fixtures after a SQLite backup. Other portfolios stay intact.\nThe app administrator global Reset example data removes this opt-in pitch owner; rerun this command to restore it.');
    process.exit(0);
  } else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
}
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
let backupPath = null;
if (fs.existsSync(dbPath)) {
  const source = new DatabaseSync(dbPath, { readOnly: true });
  backupPath = path.join(path.dirname(dbPath), `pitch-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
  try { await backup(source, backupPath); } finally { source.close(); }
}
const result = createSilidSmartService(dbPath).preparePitchDemo({ restore });
const w = result.workspace;
const statement = w.commissionStatements.find(s => s.billingMonth === result.billingMonth && s.state === 'Issued');
const manifest = {
  preparedAt: new Date().toISOString(), mode: result.mode, database: dbPath, backup: backupPath,
  notice: 'Fictional pitch data only. No real bookings, transfers or payment verification.',
  owner: { id: result.ownerId, name: w.owner.displayName, email: PITCH_EMAIL, initialDemoPassword: 'password123', passwordNote: 'Existing account passwords are preserved.' },
  subscription: w.subscription, units: w.units.map(u => ({id:u.id,label:u.unitLabel,status:u.status})),
  billingMonth: result.billingMonth, statementId: statement?.id || null, commissionPhp: statement?.commissionPhp ?? null,
  outstandingPhp: statement?.outstandingPhp ?? null, paymentStatus: statement?.paymentStatus || 'No active statement; pitch progress preserved',
  guide: 'docs/PITCH_DEMO.md, Five seeded pitch examples section',
};
const output = path.join(path.dirname(dbPath), 'pitch-demo-manifest.json');
fs.writeFileSync(output, JSON.stringify(manifest, null, 2));
console.log(`Pitch profile ${result.mode}: ${w.units.length} units; proposed monthly plan PHP ${w.subscription.monthlyFeePhp}.`);
console.log(`Sign in: ${PITCH_EMAIL} / password123 (initial demo password; an existing changed password is preserved).`);
console.log(`Checkout month: ${result.billingMonth}; active statement commission: PHP ${manifest.commissionPhp ?? 'not issued'}; ${manifest.paymentStatus}.`);
console.log(`Manifest: ${output}`);
if (backupPath) console.log(`Pre-seed backup: ${backupPath}`);
console.log('No other owner portfolio was reset. Refresh the app; do not start another backend if port 4000 is already running.');
