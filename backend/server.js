const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'subtrimmer-dev-secret-change-in-production';

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      open_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      is_paid BOOLEAN DEFAULT FALSE,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price NUMERIC NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      category TEXT DEFAULT 'other',
      next_billing_date TIMESTAMPTZ,
      trial_end_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      renewal_alerts BOOLEAN DEFAULT TRUE,
      spending_alerts BOOLEAN DEFAULT TRUE,
      weekly_summary BOOLEAN DEFAULT TRUE,
      push_enabled BOOLEAN DEFAULT TRUE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      budget_goal NUMERIC,
      currency TEXT DEFAULT 'USD',
      currency_symbol TEXT DEFAULT '$'
    )
  `);
  await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS currency_symbol TEXT DEFAULT '$'`);
}

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
  return { id: u.id, openId: u.open_id, email: u.email, name: u.name, role: u.role, isPaid: u.is_paid, paidAt: u.paid_at };
}

function formatSub(s) {
  return {
    id: s.id,
    user_id: s.user_id,
    name: s.name,
    price: parseFloat(s.price),
    billingCycle: s.billing_cycle,
    category: s.category,
    nextBillingDate: s.next_billing_date,
    trialEndDate: s.trial_end_date || null,
    created_at: s.created_at,
  };
}

function formatNotification(n) {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type || 'info',
    read: n.is_read,
    createdAt: n.created_at,
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const openId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2);

    const result = await pool.query(
      'INSERT INTO users (open_id, email, name, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
      [openId, email, name || null, passwordHash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [user.id, 'Welcome to SubTrimmer!', 'Start adding your subscriptions to track your spending.', 'info']
    );
    await pool.query('INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);

    res.json({ token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(formatUser(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.userId]);
    }

    if (name !== undefined) {
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name || null, req.userId]);
    }

    const updated = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    res.json(formatUser(updated.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Subscriptions ─────────────────────────────────────────────────────────────

app.get('/api/trpc/subscriptions.list', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(trpc(result.rows.map(formatSub)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trpc/subscriptions.create', authMiddleware, async (req, res) => {
  try {
    const { name, price, billingCycle = 'monthly', category = 'other', trialEndDate } = req.body;
    if (!name || price == null) return res.status(400).json({ error: 'Name and price required' });

    const result = await pool.query(
      'INSERT INTO subscriptions (user_id, name, price, billing_cycle, category, next_billing_date, trial_end_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.userId, name, price, billingCycle, category, nextBillingDate(billingCycle), trialEndDate || null]
    );
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [req.userId, 'Subscription Added', `${name} ($${price}/${billingCycle}) was added.`, 'info']
    );
    res.json(trpc(formatSub(result.rows[0])));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trpc/subscriptions.update', authMiddleware, async (req, res) => {
  try {
    const { id, name, price, billingCycle, category, trialEndDate } = req.body;
    if (!id) return res.status(400).json({ error: 'Subscription id required' });

    const check = await pool.query(
      'SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });

    const result = await pool.query(
      'UPDATE subscriptions SET name = $1, price = $2, billing_cycle = $3, category = $4, next_billing_date = $5, trial_end_date = $6 WHERE id = $7 RETURNING *',
      [name, price, billingCycle, category, nextBillingDate(billingCycle), trialEndDate || null, id]
    );
    res.json(trpc(formatSub(result.rows[0])));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trpc/subscriptions.delete', authMiddleware, async (req, res) => {
  try {
    const { id } = req.body;
    const check = await pool.query(
      'SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    await pool.query('DELETE FROM subscriptions WHERE id = $1', [id]);
    res.json(trpc({ success: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trpc/subscriptions.exportCsv', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY name ASC',
      [req.userId]
    );
    const subs = result.rows;
    const header = 'Name,Price,Billing Cycle,Category,Next Billing Date,Trial End Date\n';
    const rows = subs.map(s => [
      `"${s.name}"`,
      parseFloat(s.price).toFixed(2),
      s.billing_cycle,
      s.category,
      s.next_billing_date ? new Date(s.next_billing_date).toLocaleDateString() : '',
      s.trial_end_date ? new Date(s.trial_end_date).toLocaleDateString() : '',
    ].join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User Settings ─────────────────────────────────────────────────────────────

app.get('/api/trpc/settings.get', authMiddleware, async (req, res) => {
  try {
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.userId]);
    const result = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [req.userId]);
    const s = result.rows[0];
    res.json(trpc({
      budgetGoal: s.budget_goal ? parseFloat(s.budget_goal) : null,
      currency: s.currency || 'USD',
      currencySymbol: s.currency_symbol || '$',
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trpc/settings.update', authMiddleware, async (req, res) => {
  try {
    const { budgetGoal, currency, currencySymbol } = req.body;
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.userId]);
    await pool.query(
      'UPDATE user_settings SET budget_goal = $1, currency = $2, currency_symbol = $3 WHERE user_id = $4',
      [budgetGoal ?? null, currency || 'USD', currencySymbol || '$', req.userId]
    );
    res.json(trpc({ success: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────────

app.get('/api/trpc/analytics.summary', authMiddleware, async (req, res) => {
  try {
    const subsResult = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.userId]);
    const subs = subsResult.rows;
    const monthlyTotal = subs.reduce((sum, s) => sum + toMonthly(parseFloat(s.price), s.billing_cycle), 0);

    const alertResult = await pool.query(
      'SELECT COUNT(*) as c FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.userId]
    );
    const alertCount = parseInt(alertResult.rows[0].c);

    const byCategory = {};
    for (const s of subs) {
      const monthly = toMonthly(parseFloat(s.price), s.billing_cycle);
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Alerts ────────────────────────────────────────────────────────────────────

app.get('/api/trpc/alerts.list', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.userId]);
    const subs = result.rows;
    const now = new Date();
    const alerts = [];

    for (const sub of subs) {
      const days = Math.ceil((new Date(sub.next_billing_date) - now) / 86400000);
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
      if (sub.trial_end_date) {
        const trialDays = Math.ceil((new Date(sub.trial_end_date) - now) / 86400000);
        if (trialDays >= 0 && trialDays <= 3) {
          alerts.push({
            id: sub.id * 1000,
            type: 'trial_alert',
            title: `${sub.name} trial ends ${trialDays === 0 ? 'today' : `in ${trialDays} day${trialDays !== 1 ? 's' : ''}`}`,
            message: `Your free trial for ${sub.name} is about to end. Cancel now to avoid charges.`,
            subscriptionName: sub.name,
            severity: trialDays === 0 ? 'high' : 'medium',
          });
        }
      }
    }

    const monthlyTotal = subs.reduce((sum, s) => sum + toMonthly(parseFloat(s.price), s.billing_cycle), 0);
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Insights ──────────────────────────────────────────────────────────────────

app.get('/api/trpc/insights.getRecommendations', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.userId]);
    const subs = result.rows;

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

    const monthlyTotal = subs.reduce((sum, s) => sum + toMonthly(parseFloat(s.price), s.billing_cycle), 0);
    const byCategory = {};
    for (const s of subs) {
      byCategory[s.category] = (byCategory[s.category] || 0) + toMonthly(parseFloat(s.price), s.billing_cycle);
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Notifications ─────────────────────────────────────────────────────────────

app.get('/api/trpc/notifications.getHistory', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.userId, limit]
    );
    res.json(trpc(result.rows.map(formatNotification)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trpc/notifications.getUnreadCount', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as c FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.userId]
    );
    res.json(trpc({ unreadCount: parseInt(result.rows[0].c) }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trpc/notifications.markAsRead', authMiddleware, async (req, res) => {
  try {
    const id = req.body.id || req.body.notificationId;
    if (id) {
      await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [id, req.userId]);
    } else {
      await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.userId]);
    }
    res.json(trpc({ success: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Notification Preferences ──────────────────────────────────────────────────

app.get('/api/trpc/notifications.getPreferences', authMiddleware, async (req, res) => {
  try {
    await pool.query('INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.userId]);
    const result = await pool.query('SELECT * FROM notification_preferences WHERE user_id = $1', [req.userId]);
    const p = result.rows[0];
    res.json(trpc({
      renewalAlerts: p.renewal_alerts,
      spendingAlerts: p.spending_alerts,
      weeklySummary: p.weekly_summary,
      pushEnabled: p.push_enabled,
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trpc/notifications.updatePreferences', authMiddleware, async (req, res) => {
  try {
    const { renewalAlerts, spendingAlerts, weeklySummary, pushEnabled } = req.body;
    await pool.query('INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.userId]);
    await pool.query(
      'UPDATE notification_preferences SET renewal_alerts = $1, spending_alerts = $2, weekly_summary = $3, push_enabled = $4 WHERE user_id = $5',
      [renewalAlerts, spendingAlerts, weeklySummary, pushEnabled, req.userId]
    );
    res.json(trpc({ success: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ status: 'ok' }));

initDB()
  .then(() => app.listen(PORT, () => console.log(`SubTrimmer backend running on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
