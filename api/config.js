module.exports = (req, res) => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';

  // Mescla com window.__ENV__ já definido em env.js (não apaga GOOGLE_CLIENT_ID local se a Vercel não tiver a var).
  const payload = {
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: key
  };
  if (googleClientId) payload.GOOGLE_CLIENT_ID = googleClientId;

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.status(200).send(
    `window.__ENV__=Object.assign({}, window.__ENV__||{}, ${JSON.stringify(payload)});`
  );
};