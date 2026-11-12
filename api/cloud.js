const crypto = require('crypto');
const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function r(...cmd) {
  const res = await fetch(R_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + R_TOK }, body: JSON.stringify(cmd) });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const hash = (p, s) => crypto.scryptSync(p, s, 64).toString('hex');
async function readBody(req) {
  let b = req.body;
  if (typeof b === 'string') b = JSON.parse(b || '{}');
  if (b && typeof b === 'object') return b;
  const ch = []; for await (const c of req) ch.push(c);
  return JSON.parse(Buffer.concat(ch).toString() || '{}');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!R_URL || !R_TOK) return res.status(500).json({ error: 'قاعدة البيانات غير مُعدّة في Vercel' });
  try {
    const b = await readBody(req);
    const a = b.action;
    if (a === 'signup' || a === 'login') {
      const email = String(b.email || '').trim().toLowerCase();
      const pw = String(b.password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'بريد إلكتروني غير صالح' });
      if (pw.length < 8) return res.status(400).json({ error: 'كلمة المرور ٨ أحرف على الأقل' });
      const fails = +((await r('GET', 'fail:' + email)) || 0);
      if (fails >= 10) return res.status(429).json({ error: 'محاولات كثيرة، حاولي بعد ١٥ دقيقة' });
      let u = await r('GET', 'user:' + email); u = u ? JSON.parse(u) : null;
      if (a === 'signup') {
        if (process.env.SIGNUP_CODE && b.code !== process.env.SIGNUP_CODE) return res.status(403).json({ error: 'رمز الدعوة غير صحيح' });
        if (u) return res.status(409).json({ error: 'الحساب موجود مسبقًا، استخدمي «دخول»' });
        const salt = crypto.randomBytes(16).toString('hex');
        await r('SET', 'user:' + email, JSON.stringify({ salt, hash: hash(pw, salt), created: Date.now() }));
      } else {
        const ok = u && crypto.timingSafeEqual(Buffer.from(hash(pw, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
        if (!ok) {
          await r('INCR', 'fail:' + email); await r('EXPIRE', 'fail:' + email, 900);
          return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
        }
        await r('DEL', 'fail:' + email);
      }
      const token = crypto.randomBytes(32).toString('hex');
      await r('SET', 'sess:' + token, email, 'EX', 60 * 60 * 24 * 30);
      return res.status(200).json({ token, email });
    }
    const em = b.token ? await r('GET', 'sess:' + b.token) : null;
    if (!em) return res.status(401).json({ error: 'انتهت الجلسة، سجّلي الدخول من جديد' });
    if (a === 'pull') {
      const d = await r('GET', 'data:' + em);
      return res.status(200).json(d ? JSON.parse(d) : { data: null, updated_at: 0 });
    }
    if (a === 'push') {
      const rec = { data: b.data || {}, updated_at: Date.now() };
      await r('SET', 'data:' + em, JSON.stringify(rec));
      return res.status(200).json({ updated_at: rec.updated_at });
    }
    if (a === 'logout') { await r('DEL', 'sess:' + b.token); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ error: 'طلب غير معروف' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
