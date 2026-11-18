const crypto = require('crypto');
const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SHARE_SECONDS = 7 * 24 * 60 * 60;
const SHARE_LIMIT = 200;

async function r(...cmd) {
  const res = await fetch(R_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + R_TOK },
    body: JSON.stringify(cmd)
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const getJ = async key => { const value = await r('GET', key); return value ? JSON.parse(value) : null; };
const setJ = (key, value) => r('SET', key, JSON.stringify(value), 'EX', SHARE_SECONDS);

async function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    if (Buffer.byteLength(JSON.stringify(req.body)) > 64 * 1024) throw new Error('request too large');
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('request too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

async function clinicContext(token) {
  const email = token ? await r('GET', 'sess:' + token) : null;
  if (!email) return null;
  const userText = await r('GET', 'user:' + email);
  if (!userText) return null;
  const user = JSON.parse(userText);
  if (!user.clinic) return null;
  const clinicText = await r('GET', 'clinic:' + user.clinic);
  if (!clinicText) return null;
  const clinic = JSON.parse(clinicText);
  if (!clinic.members || !clinic.members[email]) return null;
  return { email, clinicId: user.clinic };
}

function safeSummary(value) {
  if (!value || typeof value !== 'object') return null;
  const nums = xs => Array.isArray(xs)
    ? xs.slice(-10).map(x => Number(x)).filter(x => Number.isFinite(x)).map(x => Math.max(0, Math.min(10000, Math.round(x))))
    : [];
  const name = String(value.n || '').trim().slice(0, 40);
  if (!name) return null;
  return {
    n: name,
    f: String(value.f || '').slice(0, 32),
    t: String(value.t || '').slice(0, 32),
    s: Math.max(0, Math.min(1000, Math.round(Number(value.s) || 0))),
    w: nums(value.w),
    c: nums(value.c).map(x => Math.min(x, 100)),
    wk: value.wk === true
  };
}

const tokenKey = token => 'parent-share:' + crypto.createHash('sha256').update(token).digest('hex');
const shareIdKey = id => 'parent-share-id:' + id;
const shareIndexKey = clinicId => 'parent-share-index:' + clinicId;
const validShareToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
const validShareId = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!R_URL || !R_TOK) return res.status(500).json({ error: 'قاعدة البيانات غير مُعدّة في Vercel' });
  try {
    const body = await readBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'طلب غير صالح.' });
    if (body.action === 'get') {
      if (!validShareToken(body.shareToken)) return res.status(404).json({ error: 'الرابط غير صالح أو انتهت صلاحيته.' });
      const id = await r('GET', tokenKey(body.shareToken));
      if (!id) return res.status(404).json({ error: 'انتهت صلاحية الرابط أو أُلغي.' });
      const share = await getJ(shareIdKey(id));
      if (!share || share.expiresAt <= Date.now()) return res.status(404).json({ error: 'انتهت صلاحية الرابط أو أُلغي.' });
      return res.status(200).json({ data: share.data, expiresAt: share.expiresAt });
    }

    if (!['create', 'list', 'revoke'].includes(body.action)) return res.status(400).json({ error: 'طلب غير معروف' });
    const context = await clinicContext(body.token);
    if (!context) return res.status(401).json({ error: 'انتهت الجلسة، سجّلي الدخول إلى السحابة من جديد.' });

    const indexKey = shareIndexKey(context.clinicId);
    let shares = await getJ(indexKey) || [];
    shares = shares.filter(item => item.expiresAt > Date.now());
    if (body.action === 'list') {
      await setJ(indexKey, shares);
      return res.status(200).json({ shares });
    }

    if (body.action === 'create') {
      const data = safeSummary(body.data);
      if (!data) return res.status(400).json({ error: 'ملخص التقرير غير صالح.' });
      const studentId = String(body.studentId || '').slice(0, 64);
      if (!studentId) return res.status(400).json({ error: 'معرّف الطالب غير صالح.' });
      const previous = shares.filter(item => item.studentId === studentId);
      for (const item of previous) {
        const old = await getJ(shareIdKey(item.id));
        if (old && old.tokenKey) await r('DEL', old.tokenKey);
        await r('DEL', shareIdKey(item.id));
      }
      shares = shares.filter(item => item.studentId !== studentId);
      if (shares.length >= SHARE_LIMIT) return res.status(429).json({ error: 'وصلت العيادة إلى الحد المؤقت للروابط النشطة.' });
      const shareToken = crypto.randomBytes(32).toString('base64url');
      const id = crypto.randomBytes(16).toString('hex');
      const expiresAt = Date.now() + SHARE_SECONDS * 1000;
      const key = tokenKey(shareToken);
      const share = { id, clinicId: context.clinicId, studentId, createdBy: context.email, expiresAt, tokenKey: key, data };
      await r('SET', key, id, 'EX', SHARE_SECONDS);
      await r('SET', shareIdKey(id), JSON.stringify(share), 'EX', SHARE_SECONDS);
      shares.push({ id, studentId, expiresAt });
      await setJ(indexKey, shares);
      return res.status(201).json({ id, token: shareToken, expiresAt });
    }

    if (!validShareId(body.shareId)) return res.status(400).json({ error: 'الرابط غير صالح.' });
    const share = await getJ(shareIdKey(body.shareId));
    if (!share) return res.status(200).json({ revoked: false });
    if (share.clinicId !== context.clinicId) return res.status(403).json({ error: 'لا يمكنك إلغاء رابط تابع لعيادة أخرى.' });
    await r('DEL', share.tokenKey, shareIdKey(share.id));
    shares = shares.filter(item => item.id !== share.id);
    await setJ(indexKey, shares);
    return res.status(200).json({ revoked: true });
  } catch (error) {
    return res.status(500).json({ error: 'تعذّر إتمام الطلب الآن.' });
  }
};
