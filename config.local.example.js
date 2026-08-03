// Copie para config.local.js e preencha com os dados do Supabase (só para teste local).
// No deploy, a Vercel injeta isso via /api/config.
window.__ENV__ = {
  SUPABASE_URL: 'https://SEU_PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'sua_chave_anon_aqui',
  // Opcional: Client ID OAuth do Google Cloud (tipo "Aplicativo da Web")
  // com escopo calendar.readonly e origem autorizada do seu domínio.
  GOOGLE_CLIENT_ID: ''
};