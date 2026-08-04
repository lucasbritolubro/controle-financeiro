#!/usr/bin/env node
/**
 * Cria (ou atualiza) um usuário campanha_viewer com acesso somente leitura
 * aos dados de campanha de um usuário dono (padrão: lucasbrito@lubro.com.br).
 *
 * Uso:
 *   node scripts/create-campanha-viewer.mjs
 *   node scripts/create-campanha-viewer.mjs --email=viewer@lubro.com.br --password='SenhaForte123!'
 *   node scripts/create-campanha-viewer.mjs --owner=lucasbrito@lubro.com.br
 */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const REF = process.env.SUPABASE_PROJECT_REF || 'fdcopmlkxvbcffsjnbsg';
const SUPABASE_URL = process.env.SUPABASE_URL || `https://${REF}.supabase.co`;

function arg(name, fallback = null) {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  if (hit) return hit.slice(pref.length);
  return fallback;
}

function getServiceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const out = execSync(`supabase projects api-keys --project-ref ${REF}`, { encoding: 'utf8' });
  const m = out.match(/service_role\s*\|\s*(eyJ[A-Za-z0-9_\-\.]+)/);
  if (!m) throw new Error('service_role não encontrado');
  return m[1];
}

function request(method, pathname, key, body) {
  return new Promise((resolve, reject) => {
    const url = new globalThis.URL(pathname, SUPABASE_URL);
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(url, { method, headers }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        let data = d;
        try {
          data = d ? JSON.parse(d) : null;
        } catch {
          /* keep string */
        }
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} ${pathname}: ${typeof data === 'string' ? data : JSON.stringify(data)}`));
          return;
        }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function findUserByEmail(email, key) {
  for (let page = 1; page <= 20; page++) {
    const { data } = await request('GET', `/auth/v1/admin/users?page=${page}&per_page=200`, key);
    const batch = data?.users || [];
    if (!batch.length) break;
    const found = batch.find((u) => String(u.email || '').toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (batch.length < 200) break;
  }
  return null;
}

function genPassword() {
  // legível o suficiente para passar ao usuário
  const raw = crypto.randomBytes(12).toString('base64url');
  return `Campanha#${raw.slice(0, 10)}`;
}

const ownerEmail = arg('owner', process.env.OWNER_EMAIL || 'lucasbrito@lubro.com.br');
const viewerEmail = arg('email', process.env.VIEWER_EMAIL || 'campanha.viewer@lubro.com.br');
const passwordArg = arg('password', process.env.VIEWER_PASSWORD || null);
const password = passwordArg || genPassword();
const key = getServiceKey();

console.log('Projeto:', SUPABASE_URL);
console.log('Dono dos dados:', ownerEmail);
console.log('Viewer:', viewerEmail);

const owner = await findUserByEmail(ownerEmail, key);
if (!owner) {
  console.error(`Dono não encontrado: ${ownerEmail}`);
  process.exit(1);
}
console.log('Dono user_id:', owner.id);

const app_metadata = {
  role: 'campanha_viewer',
  share_from_user_id: owner.id,
  share_from_email: ownerEmail,
  modules: ['campanha'],
  read_only: true
};

let viewer = await findUserByEmail(viewerEmail, key);
let created = false;
if (!viewer) {
  const { data } = await request('POST', '/auth/v1/admin/users', key, {
    email: viewerEmail,
    password,
    email_confirm: true,
    app_metadata,
    user_metadata: {
      name: 'Visualização Campanha',
      role_label: 'Somente leitura · Campanha 2026'
    }
  });
  viewer = data;
  created = true;
  console.log('Usuário criado:', viewer.id);
} else {
  await request('PUT', `/auth/v1/admin/users/${viewer.id}`, key, {
    app_metadata: { ...(viewer.app_metadata || {}), ...app_metadata },
    user_metadata: {
      ...(viewer.user_metadata || {}),
      name: 'Visualização Campanha',
      role_label: 'Somente leitura · Campanha 2026'
    },
    password,
    email_confirm: true
  });
  viewer = await findUserByEmail(viewerEmail, key);
  console.log('Usuário atualizado:', viewer.id);
}

// Confirma que o dono tem a chave da campanha
const { data: rows } = await request(
  'GET',
  `/rest/v1/app_storage?user_id=eq.${owner.id}&key=eq.painel-financeiro:campanha-2026&select=key,updated_at`,
  key
);
const campanhaRow = Array.isArray(rows) ? rows[0] : null;

const out = {
  createdAt: new Date().toISOString(),
  created,
  viewer: {
    id: viewer.id,
    email: viewerEmail,
    password,
    role: 'campanha_viewer',
    share_from_user_id: owner.id,
    share_from_email: ownerEmail
  },
  owner: { id: owner.id, email: ownerEmail },
  campanhaPresent: Boolean(campanhaRow),
  campanhaUpdatedAt: campanhaRow?.updated_at || null,
  loginUrl: 'https://financas.lubrosolutions.com'
};

const dir = path.join(root, 'backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(dir, `campanha-viewer-credentials-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(dir, 'latest-campanha-viewer.json'), JSON.stringify(out, null, 2));

console.log('');
console.log('=== VIEWER PRONTO ===');
console.log('E-mail :', viewerEmail);
console.log('Senha  :', password);
console.log('Papel  : campanha_viewer (somente leitura · módulo Campanha)');
console.log('Dados  :', ownerEmail, campanhaRow ? `(campanha ok, ${campanhaRow.updated_at})` : '(AVISO: dono sem chave campanha ainda)');
console.log('Credenciais salvas em:', file);
console.log('');
console.log('Login:', out.loginUrl);
