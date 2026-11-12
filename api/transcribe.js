module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const buf = Buffer.concat(chunks);
    if (!buf.length) return res.status(400).json({ error: 'لا يوجد صوت' });
    if (buf.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'التسجيل كبير جدًّا' });
    const type = (req.headers['content-type'] || 'audio/webm').split(';')[0];
    const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type }), 'reading.' + ext);
    fd.append('model', 'whisper-large-v3');
    fd.append('language', 'ar');
    fd.append('response_format', 'verbose_json');
    fd.append('timestamp_granularities[]', 'word');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
      body: fd
    });
    const j = await r.json();
    if (!r.ok) return res.status(500).json({ error: (j.error && j.error.message) || 'فشل التفريغ' });
    res.status(200).json({ text: j.text || '', words: j.words || [] });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
