import { randomBytes, createHash, createPublicKey, verify, scryptSync } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');
const baseUrl = () => (process.env.PUBLIC_APP_URL || 'https://minha-evolucao-web-production.up.railway.app').replace(/\/$/, '');
const googleReady = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const emailReady = () => Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL && process.env.ADMIN_APPROVAL_EMAIL);
const cookie = value => 'session=' + value + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800';
const redirect = (res, location, headers = {}) => { res.writeHead(302, {Location: location, 'Cache-Control':'no-store', ...headers}); res.end(); };
let cachedJwks = null;
let keysExpireAt = 0;

async function claimsFromGoogle(idToken, expectedNonce) {
  if (typeof idToken !== 'string' || idToken.length > 16000) throw Error('Google retornou token inválido');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw Error('Formato do token inválido');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw Error('Algoritmo de assinatura inválido');
  if (!cachedJwks || keysExpireAt < Date.now()) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs', {signal: AbortSignal.timeout(12000)});
    if (!res.ok) throw Error('Não foi possível validar a chave Google');
    const body = await res.json();
    if (!Array.isArray(body.keys)) throw Error('Chaves Google inválidas');
    cachedJwks = body.keys;
    const match = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
    keysExpireAt = Date.now() + Math.min(Number(match?.[1] || 900), 3600) * 1000;
  }
  let key = cachedJwks.find(item => item.kid === header.kid && item.kty === 'RSA');
  if (!key) {
    cachedJwks = null;
    throw Error('A chave do Google foi renovada. Tente novamente.');
  }
  const verified = verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), createPublicKey({key, format:'jwk'}), Buffer.from(parts[2], 'base64url'));
  if (!verified) throw Error('Assinatura Google inválida');
  const now = Math.floor(Date.now()/1000);
  if (!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)
    || claims.aud !== process.env.GOOGLE_CLIENT_ID
    || !Number.isFinite(claims.exp) || claims.exp < now
    || !Number.isFinite(claims.iat) || claims.iat > now + 120
    || claims.nonce !== expectedNonce
    || !claims.sub || typeof claims.sub !== 'string'
    || claims.email_verified !== true
    || typeof claims.email !== 'string' || claims.email.length > 254) {
    throw Error('Identidade Google não validada');
  }
  return {sub:claims.sub, email:claims.email.toLowerCase().trim(), name:String(claims.name || claims.email).slice(0,160)};
}

async function notifyAdmin(pool, user) {
  await pool.query("INSERT INTO admin_notifications(user_id,kind) VALUES($1,'signup') ON CONFLICT(user_id,kind) DO NOTHING", [user.id]);
  if (!emailReady()) {
    await pool.query("UPDATE admin_notifications SET last_error=$2 WHERE user_id=$1 AND kind='signup'", [user.id, 'Envio de e-mail ainda não configurado']);
    return;
  }
  try {
    const text = 'Nova solicitação de acesso ao Minha Evolução.\n\nNome: ' + user.display_name
      + '\nE-mail Google verificado: ' + user.email
      + '\n\nPara aprovar ou rejeitar, entre como administrador em:\n'
      + baseUrl() + '/login.html?next=%2F%23administracao'
      + '\n\nPor segurança, nenhuma conta é liberada por este aviso: a decisão deve ser registrada no painel administrativo.';
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers: {
        'Authorization':'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type':'application/json',
        'User-Agent':'MinhaEvolucao/1.0',
        'Idempotency-Key':'registration-' + user.id
      },
      body:JSON.stringify({
        from:process.env.NOTIFICATION_FROM_EMAIL,
        to:[process.env.ADMIN_APPROVAL_EMAIL],
        subject:'Minha Evolução: novo cadastro aguardando aprovação',
        text
      }),
      signal:AbortSignal.timeout(12000)
    });
    if (!response.ok) throw Error('Serviço de e-mail retornou HTTP ' + response.status);
    await pool.query("UPDATE admin_notifications SET emailed_at=NOW(),last_error=NULL WHERE user_id=$1 AND kind='signup'",[user.id]);
  } catch (err) {
    await pool.query("UPDATE admin_notifications SET last_error=$2 WHERE user_id=$1 AND kind='signup'", [user.id,String(err.message).slice(0,200)]);
    console.error('Falha no aviso de novo cadastro:',err.message);
  }
}

export async function initAccess(pool) {
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'local'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INT REFERENCES users(id)");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users(google_sub)");
  await pool.query("CREATE TABLE IF NOT EXISTS google_auth_states(state TEXT PRIMARY KEY,nonce TEXT NOT NULL,expires TIMESTAMPTZ NOT NULL)");
  await pool.query("CREATE TABLE IF NOT EXISTS admin_notifications(id BIGSERIAL PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),emailed_at TIMESTAMPTZ,last_error TEXT,UNIQUE(user_id,kind))");
  await pool.query("UPDATE users SET role='admin',status='approved' WHERE username='Rafael' AND google_sub IS NULL");
}

export async function publicAccess(req, res, path, url, pool, send) {
  if (path === '/api/auth/config' && req.method === 'GET') {
    send(res,200,{googleEnabled:googleReady(),approvalRequired:true,emailNotificationsEnabled:emailReady()});
    return true;
  }
  if (path === '/api/auth/google/start' && req.method === 'GET') {
    if (!googleReady()) {
      redirect(res,'/login.html?status=not_configured');
      return true;
    }
    const state = randomBytes(32).toString('hex');
    const nonce = randomBytes(24).toString('hex');
    await pool.query("DELETE FROM google_auth_states WHERE expires < NOW()");
    await pool.query("INSERT INTO google_auth_states(state,nonce,expires) VALUES($1,$2,NOW()+INTERVAL '10 minutes')",[sha(state),nonce]);
    const authorization = new URLSearchParams({
      client_id:process.env.GOOGLE_CLIENT_ID,
      redirect_uri:baseUrl() + '/api/auth/google/callback',
      response_type:'code',
      scope:'openid email profile',
      state,nonce,
      prompt:'select_account'
    });
    redirect(res,'https://accounts.google.com/o/oauth2/v2/auth?' + authorization,{'Set-Cookie':'google_oauth_state='+state+'; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/google/callback; Max-Age=600'});
    return true;
  }
  if (path === '/api/auth/google/callback' && req.method === 'GET') {
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const cookieState = /(?:^|; )google_oauth_state=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!state || !code || !cookieState || state !== cookieState || state.length > 256 || code.length > 4096 || !googleReady()) {
      redirect(res,'/login.html?status=google_error');
      return true;
    }
    try {
      res.setHeader('Set-Cookie','google_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/google/callback; Max-Age=0');
      const claimed = await pool.query('DELETE FROM google_auth_states WHERE state=$1 AND expires>NOW() RETURNING nonce',[sha(state)]);
      if (!claimed.rowCount) throw Error('Estado de autenticação inválido ou expirado');
      const exchange = await fetch('https://oauth2.googleapis.com/token',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({
          code,
          client_id:process.env.GOOGLE_CLIENT_ID,
          client_secret:process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri:baseUrl() + '/api/auth/google/callback',
          grant_type:'authorization_code'
        }),
        signal:AbortSignal.timeout(15000)
      });
      if (!exchange.ok) throw Error('Google recusou o código de autorização');
      const googleResponse = await exchange.json();
      const identity = await claimsFromGoogle(googleResponse.id_token,claimed.rows[0].nonce);
      let found = await pool.query('SELECT id,status,email,display_name,role FROM users WHERE google_sub=$1',[identity.sub]);
      let user = found.rows[0];
      if (!user) {
        const salt = randomBytes(16).toString('hex');
        const passhash = scryptSync(randomBytes(32),salt,64).toString('hex');
        const username = 'google_' + sha(identity.sub).slice(0,32);
        const inserted = await pool.query(
          "INSERT INTO users(username,salt,passhash,must_change,role,google_sub,email,display_name,provider,status) VALUES($1,$2,$3,false,'user',$4,$5,$6,'google','pending') ON CONFLICT (google_sub) DO NOTHING RETURNING id,status,email,display_name,role",
          [username,salt,passhash,identity.sub,identity.email,identity.name]);
        if (inserted.rowCount) {
          user = inserted.rows[0];
          await pool.query('INSERT INTO access_audit(user_id,action) VALUES($1,$2)',[user.id,'signup_pending']);
          await notifyAdmin(pool,user);
        } else {
          found = await pool.query('SELECT id,status,email,display_name,role FROM users WHERE google_sub=$1',[identity.sub]);
          user = found.rows[0];
        }
      }
      if (!user) throw Error('Conta Google não pôde ser registrada');
      if (user.status !== 'approved') {
        const status = ['pending','rejected','blocked'].includes(user.status) ? user.status : 'pending';
        redirect(res,'/login.html?status=' + status);
        return true;
      }
      const session = randomBytes(32).toString('hex');
      await pool.query("INSERT INTO sessions(token,user_id,expires) VALUES($1,$2,NOW()+INTERVAL '7 days')",[sha(session),user.id]);
      await pool.query('INSERT INTO access_audit(user_id,action) VALUES($1,$2)',[user.id,'login_google_success']);
      redirect(res,'/',{'Set-Cookie':[cookie(session),'google_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/google/callback; Max-Age=0']});
      return true;
    } catch (err) {
      console.error('Erro de autenticação Google:',err.message);
      redirect(res,'/login.html?status=google_error');
      return true;
    }
  }
  return false;
}

export async function adminAccess(req, res, path, pool, send, currentUser) {
  if (!path.startsWith('/api/admin/registrations')) return false;
  if (currentUser.role !== 'admin') {
    send(res,403,{error:'Somente o administrador pode gerenciar cadastros'});
    return true;
  }
  if (path === '/api/admin/registrations' && req.method === 'GET') {
    const result = await pool.query(
      "SELECT u.id,u.email,u.display_name,u.status,u.created_at,n.emailed_at,n.last_error FROM users u LEFT JOIN admin_notifications n ON n.user_id=u.id AND n.kind='signup' WHERE u.google_sub IS NOT NULL ORDER BY CASE WHEN u.status='pending' THEN 0 ELSE 1 END,u.created_at DESC LIMIT 200");
    send(res,200,{registrations:result.rows,emailNotificationsEnabled:emailReady()});
    return true;
  }
  const match = /^\/api\/admin\/registrations\/(\d+)\/(approve|reject|block)$/.exec(path);
  if (match && req.method === 'POST') {
    const target = Number(match[1]);
    if (!Number.isSafeInteger(target) || target < 1 || target === currentUser.id) {
      send(res,400,{error:'Usuário inválido'});
      return true;
    }
    const newStatus = {approve:'approved',reject:'rejected',block:'blocked'}[match[2]];
    const changed = await pool.query(
      "UPDATE users SET status=$1,approved_by=CASE WHEN $1='approved' THEN $2 ELSE approved_by END,approved_at=CASE WHEN $1='approved' THEN NOW() ELSE approved_at END WHERE id=$3 AND role<>'admin' AND google_sub IS NOT NULL RETURNING id,email,status",
      [newStatus,currentUser.id,target]);
    if (!changed.rowCount) {
      send(res,404,{error:'Solicitação não encontrada'});
      return true;
    }
    await pool.query('DELETE FROM sessions WHERE user_id=$1',[target]);
    await pool.query('INSERT INTO access_audit(user_id,action) VALUES($1,$2)',[currentUser.id,'registration_'+match[2]+'_'+target]);
    send(res,200,{ok:true,registration:changed.rows[0]});
    return true;
  }
  send(res,405,{error:'Operação não permitida'});
  return true;
}
