module.exports = (req, res) => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.status(200).send(
    `window.__ENV__=${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key })};`
  );
};