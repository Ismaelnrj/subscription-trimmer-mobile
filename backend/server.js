const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'subtrimmer-dev-secret-change-in-production';

app.use(cors());
app.use(express.json());

// ── Database setup ────────────────────────────────────────────────────────────

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'subtrimmer.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openId TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    isPaid INTEGER DEFAULT 0,
    paidAt TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    billingCycle TEXT NOT NULL DEFAULT 'monthly',
    category TEXT DEFAULT 'other',
    nextBillingDate TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function trpc(data) {
  return { result: { data } };
}

function nextBillingDate(billingCycle) {
  const d = new Date();
  if (billingCycle === 'weekly') d.setDate(d.getDate() + 7);
  else if (billingCycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function toMonthly(price, billingCycle) {
  if (billingCycle === 'weekly') return price * 52 / 12;
  if (billingCycle === 'yearly') return price / 12;
  return price;
}

function formatUser(u) {
  return {
    id: u.id,
    openId: u.openId,
    email: u.email,
    name: u.name,
    role: u.role,
    isPaid: !!u.isPaid,
    paidAt: u.paidAt,
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const openId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO users (openId, email, name, password_hash) VALUES (?, ?, ?, ?)'
    ).run(openId, email, name || null, passwordHash);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    // Welcome notification
    db.prepare('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)').run(
      user.id, 'Welcome to SubTrimmer!', 'Start adding your subscriptions to track your spending.'
    );

    res.json({ token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(formatUser(user));
});

// ── Subscriptions ─────────────────────────────────────────────────────────────

app.get('/api/trpc/subscriptions.list', authMiddleware, (req, res) => {
  const subs = db.prepare(
    'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.userId);
  res.json(trpc(subs));
});

app.post('/api/trpc/subscriptions.create', authMiddleware, (req, res) => {
  const { name, price, billingCycle = 'monthly', category = 'other' } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'Name and price required' });

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO subscriptions (user_id, name, price, billingCycle, category, nextBillingDate) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.userId, name, price, billingCycle, category, nextBillingDate(billingCycle));

  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(lastInsertRowid);

  db.prepare('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)').run(
    req.userId, 'Subscription Added', `${name} ($${price}/${billingCycle}) was added.`
  );

  res.json(trpc(sub));
});

app.post('/api/trpc/subscriptions.delete', authMiddleware, (req, res) => {
  const { id } = req.body;
  const sub = db.prepare('SELECT id FROM subscriptions WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
  res.json(trpc({ success: true }));
});

// ── Analytics ─────────────────────────────────────────────────────────────────

app.get('/api/trpc/analytics.summary', authMiddleware, (req, res) => {
  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(req.userId);
  const monthlyTotal = subs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
  const alertCount = db.prepare(
    'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.userId).c;

  res.json(trpc({
    activeSubscriptions: subs.length,
    monthlyTotal,
    yearlyTotal: monthlyTotal * 12,
    alertCount,
  }));
});

// ── Alerts ────────────────────────────────────────────────────────────────────

app.get('/api/trpc/alerts.list', authMiddleware, (req, res) => {
  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(req.userId);
  const now = new Date();
  const alerts = [];

  for (const sub of subs) {
    const days = Math.ceil((new Date(sub.nextBillingDate) - now) / 86400000);
    if (days <= 7) {
      alerts.push({
        id: sub.id,
        title: `${sub.name} billing ${days <= 0 ? 'today' : `in ${days} day${days !== 1 ? 's' : ''}`}`,
        message: `$${sub.price} will be charged for ${sub.name}.`,
        severity: days <= 1 ? 'high' : days <= 3 ? 'medium' : 'low',
      });
    }
  }

  const monthlyTotal = subs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
  if (monthlyTotal > 100) {
    alerts.push({
      id: 0,
      title: 'High monthly spending',
      message: `You spend $${monthlyTotal.toFixed(2)}/month on subscriptions.`,
      severity: 'low',
    });
  }

  res.json(trpc(alerts));
});

// ── Insights ──────────────────────────────────────────────────────────────────

app.get('/api/trpc/insights.getRecommendations', authMiddleware, (req, res) => {
  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(req.userId);

  if (subs.length === 0) {
    return res.json(trpc([{
      id: 'empty',
      title: 'Add your first subscription',
      description: 'Track all your subscriptions to get spending insights and recommendations.',
      potentialSavings: 0,
    }]));
  }

  const byCategory = {};
  for (const s of subs) {
    byCategory[s.category] = (byCategory[s.category] || 0) + toMonthly(s.price, s.billingCycle);
  }

  const recs = Object.entries(byCategory)
    .filter(([, total]) => total > 20)
    .map(([category, total]) => ({
      id: category,
      title: `Review your ${category} subscriptions`,
      description: `You spend $${total.toFixed(2)}/month on ${category}. Are you using all of them?`,
      potentialSavings: +(total * 0.25).toFixed(2),
    }));

  res.json(trpc(recs.length ? recs : [{
    id: 'ok',
    title: 'Your spending looks healthy',
    description: 'Keep tracking your subscriptions to get more insights over time.',
    potentialSavings: 0,
  }]));
});

// ── Notifications ─────────────────────────────────────────────────────────────

app.get('/api/trpc/notifications.getHistory', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const notifs = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(req.userId, limit);
  res.json(trpc(notifs));
});

app.get('/api/trpc/notifications.getUnreadCount', authMiddleware, (req, res) => {
  const { c } = db.prepare(
    'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.userId);
  res.json(trpc({ count: c }));
});

app.post('/api/trpc/notifications.markAsRead', authMiddleware, (req, res) => {
  const { id } = req.body;
  if (id) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.userId);
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId);
  }
  res.json(trpc({ success: true }));
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`SubTrimmer backend running on port ${PORT}`));
