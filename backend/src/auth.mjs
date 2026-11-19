import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export class AccessError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const demoAccounts = [
  { id: 'user-owner-1', name: 'Maria Santos', email: 'maria.santos@silidsmart.ph', phone: '0917-555-0192', role: 'owner', ownerId: 'owner-1' },
  { id: 'user-renter-1', name: 'Juan Dela Cruz', email: 'juan.delacruz@gmail.com', phone: '0918-123-4567', role: 'renter' },
  { id: 'user-admin-1', name: 'Platform Review Lead', email: 'governance@silidsmart.ph', phone: '0919-000-8888', role: 'admin' },
];

export function createAuthStore(db) {
  const sessions = new Map();
  const publicUser = (row) => row ? {
    id: row.id, name: row.name, email: row.email, phone: row.phone,
    role: row.role, ownerId: row.owner_id || undefined,
    avatarInitials: row.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
  } : null;

  const store = {
    seedDemoAccounts() {
      for (const user of demoAccounts) {
        if (db.prepare('SELECT id FROM accounts WHERE id = ?').get(user.id)) {
          if (user.ownerId) db.prepare('UPDATE accounts SET owner_id = ? WHERE id = ?').run(user.ownerId, user.id);
          continue;
        }
        store.register({ ...user, password: 'password123' }, user.role, user.ownerId);
      }
    },
    register(input, role = 'renter', ownerId = null) {
      const name = String(input.name || '').trim();
      const email = String(input.email || '').trim().toLowerCase();
      const password = String(input.password || '');
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
        throw new AccessError(400, 'INVALID_ACCOUNT', 'Enter your name, a valid email, and a password with at least 8 characters.');
      }
      if (db.prepare('SELECT id FROM accounts WHERE email = ?').get(email)) {
        throw new AccessError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists.');
      }
      const id = input.id || `user-${randomUUID()}`;
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64).toString('hex');
      db.prepare('INSERT INTO accounts (id, name, email, phone, role, owner_id, password_salt, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, email, String(input.phone || ''), role, ownerId, salt, hash);
      return publicUser(db.prepare('SELECT * FROM accounts WHERE id = ?').get(id));
    },
    login(identifier, password) {
      const value = String(identifier || '').trim();
      const row = db.prepare('SELECT * FROM accounts WHERE email = ? COLLATE NOCASE OR (phone <> \'\' AND phone = ?)').get(value, value);
      const candidate = scryptSync(String(password || ''), row?.password_salt || 'missing-account', 64);
      if (!row || !timingSafeEqual(candidate, Buffer.from(row.password_hash, 'hex'))) {
        throw new AccessError(401, 'INVALID_CREDENTIALS', 'Email, mobile number, or password is incorrect.');
      }
      return publicUser(row);
    },
    startSession(user, req, res) {
      store.endSession(req, res);
      const token = randomBytes(32).toString('hex');
      sessions.set(token, { id: user.id, expires: Date.now() + 8 * 60 * 60 * 1000 });
      res.setHeader('Set-Cookie', `silidsmart_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${req.socket.encrypted ? '; Secure' : ''}`);
    },
    token(req) {
      return /(?:^|;\s*)silidsmart_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    },
    getUser(req) {
      const token = store.token(req);
      const session = sessions.get(token);
      if (!session) return null;
      if (session.expires <= Date.now()) { sessions.delete(token); return null; }
      return publicUser(db.prepare('SELECT * FROM accounts WHERE id = ?').get(session.id));
    },
    endSession(req, res) {
      sessions.delete(store.token(req));
      res.setHeader('Set-Cookie', 'silidsmart_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    },
  };
  store.seedDemoAccounts();
  return store;
}
