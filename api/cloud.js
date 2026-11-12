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
const getJ = async k => { const v = await r('GET', k); return v ? JSON.parse(v) : null; };
const setJ = (k, o) => r('SET', k, JSON.stringify(o));
const emailOk = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
async function readBody(req) {
  let b = req.body;
  if (typeof b === 'string') b = JSON.parse(b || '{}');
  if (b && typeof b === 'object') return b;
  const ch = []; for await (const c of req) ch.push(c);
  return JSON.parse(Buffer.concat(ch).toString() || '{}');
}
async function joinOrCreate(email, u) {
  const inv = await getJ('inv:' + email);
  if (inv) {
    const c = await getJ('clinic:' + inv.cid);
    if (c) {
      if (u.clinic && u.clinic !== inv.cid) {
        const old = await getJ('clinic:' + u.clinic);
        if (old && old.members[email]) { delete old.members[email]; await setJ('clinic:' + u.clinic, old); }
      }
      c.members[email] = inv.role || 'doctor';
      c.invites = (c.invites || []).filter(x => x !== email);
      await setJ('clinic:' + inv.cid, c); await r('DEL', 'inv:' + email);
      u.clinic = inv.cid; await setJ('user:' + email, u); return inv.cid;
    }
    await r('DEL', 'inv:' + email);
  }
  if (u.clinic) { const c = await getJ('clinic:' + u.clinic); if (c && c.members[email]) return u.clinic; }
  const cid = crypto.randomBytes(8).toString('hex');
  await setJ('clinic:' + cid, { name: 'عيادتي', owner: email, members: { [email]: 'admin' }, invites: [], created: Date.now() });
  const old = await r('GET', 'data:' + email); if (old) await r('SET', 'cdata:' + cid, old);
  u.clinic = cid; await setJ('user:' + email, u); return cid;
}
async function ctx(token) {
  const em = token ? await r('GET', 'sess:' + token) : null;
  if (!em) return { err: [401, 'انتهت الجلسة، سجّلي الدخول من جديد'] };
  const u = await getJ('user:' + em);
  if (!u || !u.clinic) return { err: [401, 'انتهت الجلسة، سجّلي الدخول من جديد'] };
  const c = await getJ('clinic:' + u.clinic);
  if (!c || !c.members[em]) return { err: [403, 'أُزيل حسابك من العيادة. تواصلي مع مدير العيادة.'] };
  return { em, cid: u.clinic, c, role: c.members[em] };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!R_URL || !R_TOK) return res.status(500).json({ error: 'قاعدة البيانات غير مُعدّة في Vercel' });
  try {
    const b = await readBody(req), a = b.action;
    if (a === 'signup' || a === 'login') {
      const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
      if (!emailOk(email)) return res.status(400).json({ error: 'بريد إلكتروني غير صالح' });
      if (pw.length < 8) return res.status(400).json({ error: 'كلمة المرور ٨ أحرف على الأقل' });
      const fails = +((await r('GET', 'fail:' + email)) || 0);
      if (fails >= 10) return res.status(429).json({ error: 'محاولات كثيرة، حاولي بعد ١٥ دقيقة' });
      let u = await getJ('user:' + email);
      if (a === 'signup') {
        const invited = await r('GET', 'inv:' + email);
        if (!invited && process.env.SIGNUP_CODE && b.code !== process.env.SIGNUP_CODE) return res.status(403).json({ error: 'رمز الدعوة غير صحيح' });
        if (u) return res.status(409).json({ error: 'الحساب موجود مسبقًا، استخدمي «دخول»' });
        const salt = crypto.randomBytes(16).toString('hex');
        u = { salt, hash: hash(pw, salt), created: Date.now() };
        await setJ('user:' + email, u);
      } else {
        const ok = u && crypto.timingSafeEqual(Buffer.from(hash(pw, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
        if (!ok) { await r('INCR', 'fail:' + email); await r('EXPIRE', 'fail:' + email, 900); return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' }); }
        await r('DEL', 'fail:' + email);
      }
      const cid = await joinOrCreate(email, u);
      const c = await getJ('clinic:' + cid);
      const token = crypto.randomBytes(32).toString('hex');
      await r('SET', 'sess:' + token, email, 'EX', 60 * 60 * 24 * 30);
      return res.status(200).json({ token, email, role: c.members[email], clinic: { name: c.name } });
    }
    const x = await ctx(b.token);
    if (x.err) return res.status(x.err[0]).json({ error: x.err[1] });
    const { em, cid, c, role } = x, info = { role, clinic: { name: c.name } };
    if (a === 'pull') { const d = await getJ('cdata:' + cid); return res.status(200).json(Object.assign({ data: null, updated_at: 0 }, d || {}, info)); }
    if (a === 'push') {
      const cur = await getJ('cdata:' + cid);
      if (cur && cur.updated_at > (+b.base || 0)) return res.status(409).json({ error: 'conflict', data: cur.data, updated_at: cur.updated_at });
      const rec = { data: b.data || {}, updated_at: Date.now(), by: em };
      await setJ('cdata:' + cid, rec);
      return res.status(200).json({ updated_at: rec.updated_at });
    }
    if (a === 'logout') { await r('DEL', 'sess:' + b.token); return res.status(200).json({ ok: true }); }
    if (role !== 'admin') return res.status(403).json({ error: 'هذا الإجراء لمدير العيادة فقط' });
    const e = String(b.email || '').trim().toLowerCase();
    if (a === 'members') return res.status(200).json({ name: c.name, members: c.members, invites: c.invites || [] });
    if (a === 'invite') {
      if (!emailOk(e)) return res.status(400).json({ error: 'بريد إلكتروني غير صالح' });
      if (c.members[e]) return res.status(409).json({ error: 'هذه الدكتورة عضو في العيادة مسبقًا' });
      await setJ('inv:' + e, { cid, role: b.role === 'admin' ? 'admin' : 'doctor' });
      c.invites = [...new Set([...(c.invites || []), e])]; await setJ('clinic:' + cid, c);
      return res.status(200).json({ ok: true });
    }
    if (a === 'remove') {
      if (e === em) return res.status(400).json({ error: 'لا يمكنك إزالة نفسك' });
      delete c.members[e]; c.invites = (c.invites || []).filter(z => z !== e);
      await r('DEL', 'inv:' + e); await setJ('clinic:' + cid, c);
      return res.status(200).json({ ok: true });
    }
    if (a === 'setrole') {
      if (!c.members[e]) return res.status(404).json({ error: 'العضو غير موجود' });
      const nr = b.role === 'admin' ? 'admin' : 'doctor';
      if (nr === 'doctor' && c.members[e] === 'admin' && Object.values(c.members).filter(v => v === 'admin').length <= 1) return res.status(400).json({ error: 'يجب أن يبقى مدير واحد على الأقل' });
      c.members[e] = nr; await setJ('clinic:' + cid, c);
      return res.status(200).json({ ok: true });
    }
    if (a === 'rename') { c.name = String(b.name || '').trim().slice(0, 60) || c.name; await setJ('clinic:' + cid, c); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ error: 'طلب غير معروف' });
  } catch (err) {
    return res.status(500).json({ error: String((err && err.message) || err) });
  }
};
