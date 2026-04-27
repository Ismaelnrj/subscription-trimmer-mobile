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
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id INTEGER PRIMARY KEY,
    renewal_alerts INTEGER DEFAULT 1,
    spending_alerts INTEGER DEFAULT 1,
    weekly_summary INTEGER DEFAULT 1,
    push_enabled INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function trpc(data) { return { result: { data } }; }

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
  return { id: u.id, openId: u.openId, email: u.email, name: u.name, role: u.role, isPaid: !!u.isPaid, paidAt: u.paidAt };
}

function formatNotification(n) {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type || 'info',
    read: !!n.is_read,
    createdAt: n.created_at,
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
    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
      user.id, 'Welcome to SubTrimmer!', 'Start adding your subscriptions to track your spending.', 'info'
    );
    db.prepare('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)').run(user.id);
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

app.patch('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      const hash = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.userId);
    }

    if (name !== undefined) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name || null, req.userId);
    }

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    res.json(formatUser(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Subscriptions ─────────────────────────────────────────────────────────────

app.get('/api/trpc/subscriptions.list', authMiddleware, (req, res) => {
  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(trpc(subs));
});

app.post('/api/trpc/subscriptions.create', authMiddleware, (req, res) => {
  const { name, price, billingCycle = 'monthly', category = 'other' } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'Name and price required' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO subscriptions (user_id, name, price, billingCycle, category, nextBillingDate) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.userId, name, price, billingCycle, category, nextBillingDate(billingCycle));
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(lastInsertRowid);
  db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
    req.userId, 'Subscription Added', `${name} ($${price}/${billingCycle}) was added.`, 'info'
  );
  res.json(trpc(sub));
});

app.post('/api/trpc/subscriptions.update', authMiddleware, (req, res) => {
  const { id, name, price, billingCycle, category } = req.body;
  if (!id) return res.status(400).json({ error: 'Subscription id required' });
  const sub = db.prepare('SELECT id FROM subscriptions WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  db.prepare(
    'UPDATE subscriptions SET name = ?, price = ?, billingCycle = ?, category = ?, nextBillingDate = ? WHERE id = ?'
  ).run(name, price, billingCycle, category, nextBillingDate(billingCycle), id);
  const updated = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
  res.json(trpc(updated));
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
  const alertCount = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.userId).c;

  const byCategory = {};
  for (const s of subs) {
    const monthly = toMonthly(s.price, s.billingCycle);
    byCategory[s.category] = (byCategory[s.category] || 0) + monthly;
  }
  const categoryBreakdown = Object.entries(byCategory).map(([category, amount]) => ({ category, amount }));

  res.json(trpc({
    activeSubscriptions: subs.length,
    totalSubscriptions: subs.length,
    monthlyTotal,
    yearlyTotal: monthlyTotal * 12,
    alertCount,
    categoryBreakdown,
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
        type: 'renewal_alert',
        title: `${sub.name} billing ${days <= 0 ? 'today' : `in ${days} day${days !== 1 ? 's' : ''}`}`,
        message: `$${sub.price} will be charged for ${sub.name}.`,
        subscriptionName: sub.name,
        severity: days <= 1 ? 'high' : days <= 3 ? 'medium' : 'low',
      });
    }
  }

  const monthlyTotal = subs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
  if (monthlyTotal > 100) {
    alerts.push({
      id: 0,
      type: 'expensive_alert',
      title: 'High monthly spending',
      message: `You spend $${monthlyTotal.toFixed(2)}/month on subscriptions.`,
      subscriptionName: null,
      severity: 'low',
    });
  }

  res.json(trpc(alerts));
});

// ── Insights ──────────────────────────────────────────────────────────────────

app.get('/api/trpc/insights.getRecommendations', authMiddleware, (req, res) => {
  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(req.userId);

  if (subs.length === 0) {
    return res.json(trpc({
      keyInsights: 'Add your first subscription to get personalized insights about your spending habits.',
      topRecommendations: [
        'Track all your subscriptions in one place.',
        'Set billing cycle correctly to get accurate yearly projections.',
        'Review your subscriptions monthly to cancel unused ones.',
      ],
      estimatedSavings: 0,
    }));
  }

  const monthlyTotal = subs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
  const byCategory = {};
  for (const s of subs) {
    byCategory[s.category] = (byCategory[s.category] || 0) + toMonthly(s.price, s.billingCycle);
  }
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  const estimatedSavings = +(monthlyTotal * 0.2).toFixed(2);

  const recommendations = [];
  if (topCategory && topCategory[1] > 20) {
    recommendations.push(`Review your ${topCategory[0]} subscriptions ($${topCategory[1].toFixed(2)}/mo) — you may be able to downgrade or cancel some.`);
  }
  if (subs.length > 5) {
    recommendations.push(`You have ${subs.length} active subscriptions. Consider auditing for duplicates or unused services.`);
  }
  recommendations.push(`Switching some monthly plans to annual billing could save up to 20% per year.`);
  if (monthlyTotal > 50) {
    recommendations.push(`Your monthly spend of $${monthlyTotal.toFixed(2)} is above average. Look for bundle deals to reduce costs.`);
  }

  res.json(trpc({
    keyInsights: `You have ${subs.length} active subscription${subs.length !== 1 ? 's' : ''} costing $${monthlyTotal.toFixed(2)}/month ($${(monthlyTotal * 12).toFixed(2)}/year). ${topCategory ? `Your biggest category is ${topCategory[0]} at $${topCategory[1].toFixed(2)}/month.` : ''}`,
    topRecommendations: recommendations,
    estimatedSavings,
  }));
});

// ── Notifications ─────────────────────────────────────────────────────────────

app.get('/api/trpc/notifications.getHistory', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const notifs = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(req.userId, limit);
  res.json(trpc(notifs.map(formatNotification)));
});

app.get('/api/trpc/notifications.getUnreadCount', authMiddleware, (req, res) => {
  const { c } = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.userId);
  res.json(trpc({ unreadCount: c }));
});

app.post('/api/trpc/notifications.markAsRead', authMiddleware, (req, res) => {
  const id = req.body.id || req.body.notificationId;
  if (id) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.userId);
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId);
  }
  res.json(trpc({ success: true }));
});

// ── Notification Preferences ──────────────────────────────────────────────────

app.get('/api/trpc/notifications.getPreferences', authMiddleware, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)').run(req.userId);
  const prefs = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(req.userId);
  res.json(trpc({
    renewalAlerts: !!prefs.renewal_alerts,
    spendingAlerts: !!prefs.spending_alerts,
    weeklySummary: !!prefs.weekly_summary,
    pushEnabled: !!prefs.push_enabled,
  }));
});

app.post('/api/trpc/notifications.updatePreferences', authMiddleware, (req, res) => {
  const { renewalAlerts, spendingAlerts, weeklySummary, pushEnabled } = req.body;
  db.prepare('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)').run(req.userId);
  db.prepare(
    'UPDATE notification_preferences SET renewal_alerts = ?, spending_alerts = ?, weekly_summary = ?, push_enabled = ? WHERE user_id = ?'
  ).run(
    renewalAlerts ? 1 : 0,
    spendingAlerts ? 1 : 0,
    weeklySummary ? 1 : 0,
    pushEnabled ? 1 : 0,
    req.userId
  );
  res.json(trpc({ success: true }));
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`SubTrimmer backend running on port ${PORT}`));
