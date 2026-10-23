// Liga o DNA Central ao Firebase: login com Google e banco compartilhado (Firestore).
// Expõe a mesma interface de banco que a página usa dentro do Claude.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCxoOgZAWVanY5e5865xmqIr4oPupel4UE',
  authDomain: 'dna-central-8f465.firebaseapp.com',
  projectId: 'dna-central-8f465',
  storageBucket: 'dna-central-8f465.firebasestorage.app',
  messagingSenderId: '16625184539',
  appId: '1:16625184539:web:c4e9eaf2228f0a84e6edbe'
};

// Só estes e-mails entram (as regras do Firestore repetem esta lista)
const ALLOWED = ["danyellevieiracc04@gmail.com", "dedsfelps3@gmail.com"];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = initializeFirestore(app, { localCache: persistentLocalCache() });

const toErr = e => ({ code: e && e.code === 'permission-denied' ? 'invalid_argument' : e && e.code === 'resource-exhausted' ? 'quota_exceeded' : 'unavailable', message: (e && e.message) || '' });
const wrap = s => ({ id: s.id, exists: s.exists(), data: () => s.data() });
const fail = e => { throw toErr(e); };
function docApi(path) {
  const r = doc(fs, path);
  return {
    get: () => getDoc(r).then(wrap, fail),
    set: d => setDoc(r, d).catch(fail),
    update: d => updateDoc(r, d).catch(fail),
    delete: () => deleteDoc(r).catch(fail),
    onSnapshot: (next, onErr) => onSnapshot(r, s => next(wrap(s)), e => onErr && onErr(toErr(e)))
  };
}
const db = {
  doc: p => docApi(p),
  collection: c => ({
    doc: id => docApi(c + '/' + id),
    onSnapshot: (next, onErr) => onSnapshot(collection(fs, c), s => next({ docs: s.docs.map(wrap) }), e => onErr && onErr(toErr(e)))
  })
};

// Fotos (capa e fundo): reduzidas no navegador e guardadas no próprio banco
const images = new Map();
function imageUrl(id) {
  if (images.has(id)) return images.get(id) || '';
  images.set(id, '');
  getDoc(doc(fs, 'images/' + id)).then(s => { if (s.exists()) { images.set(id, s.data().data); window.dispatchEvent(new Event('dna-rerender')); } }).catch(() => {});
  return '';
}
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let q = .85, out = c.toDataURL('image/jpeg', q);
      while (out.length > 900000 && q > .4) { q -= .1; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => reject({ code: 'unsupported_type' });
    img.src = url;
  });
}
const assets = {
  async upload(file) {
    const data = await shrink(file);
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    await setDoc(doc(fs, 'images/' + id), { data, createdAt: new Date().toISOString() }).catch(fail);
    images.set(id, data);
    return { id, url: data };
  }
};

// Tela de entrada
const gate = document.createElement('div');
gate.id = 'dna-gate';
gate.innerHTML = `<style>
  #dna-gate { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: radial-gradient(900px 620px at 8% -5%, rgba(222,119,200,.38), transparent 62%), radial-gradient(820px 640px at 100% 18%, rgba(120,110,240,.32), transparent 60%), radial-gradient(1000px 700px at 45% 115%, rgba(248,184,98,.2), transparent 60%), #0B080D; color: #FAF2F8; font: 400 15px/1.45 Outfit, "Segoe UI", Arial, sans-serif; }
  #dna-gate .box { width: min(420px, 100%); padding: 32px 28px; border-radius: 30px; text-align: center; background: rgba(28,19,31,.55); border: 1px solid rgba(255,255,255,.12); box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 24px 60px rgba(0,0,0,.5); -webkit-backdrop-filter: blur(22px); backdrop-filter: blur(22px); }
  #dna-gate h1 { margin: 0; font: italic 800 56px/1 Sora, "Segoe UI", Arial, sans-serif; letter-spacing: -.05em; }
  #dna-gate p { color: #BCAABB; margin: 10px 0 24px; }
  #dna-gate button { border: 0; border-radius: 999px; padding: 14px 22px; font: 600 15px Outfit, "Segoe UI", Arial, sans-serif; background: #FAF2F8; color: #170F17; cursor: pointer; display: inline-flex; gap: 10px; align-items: center; }
  #dna-gate .msg { margin-top: 16px; font-size: 14px; color: #FF7A85; min-height: 20px; }
</style><div class="box"><h1>DNA</h1><p>Central da equipe. Entre com a sua conta Google.</p><button type="button" id="dna-login"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.7 2.3-8.7 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>Entrar com Google</button><div class="msg" id="dna-msg"></div></div>`;
document.body.appendChild(gate);
const msg = t => { document.getElementById('dna-msg').textContent = t; };
document.getElementById('dna-login').addEventListener('click', async () => {
  msg('');
  if (auth.currentUser) await signOut(auth);
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { msg(e && e.code === 'auth/popup-blocked' ? 'O navegador bloqueou a janela de login. Permita pop-ups e tente de novo.' : e && e.code === 'auth/popup-closed-by-user' ? '' : 'Não foi possível entrar. Tente de novo.'); }
});

let resolved = false;
onAuthStateChanged(auth, user => {
  if (!user) { gate.style.display = 'grid'; return; }
  const email = (user.email || '').toLowerCase();
  if (!ALLOWED.includes(email)) { gate.style.display = 'grid'; msg(`O e-mail ${email} não tem acesso. Entre com outra conta.`); return; }
  gate.style.display = 'none';
  if (!resolved) { resolved = true; window.__dnaResolve({ db, assets, imageUrl, user, signOut: () => signOut(auth) }); }
});
