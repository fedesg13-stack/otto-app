/**
 * OTTO v3 — app.js
 * ─────────────────────────────────────────────────
 * Arquitectura de datos (Fuente Única de Verdad):
 *
 * usuarios/{uid}/
 *   directorio/{id}   ← FUENTE ÚNICA NEURONAL
 *     nombre, categoria_principal, icono, color_fondo,
 *     metadata:{telefono,email,nota}, activo, creadoEn
 *
 *   movimientos/{id}  cat, tipo, monto, fecha, desc,
 *                     proveedorId, proveedorNombre
 *   pedidos/{id}      cli, cliId, empleadoId, items[], fecha, hora
 *   eventos/{id}      tit, fecha, hora, clienteId, cliente
 *   tareas/{id}       tit, done, fecha, prio
 *   notas/nota        notas:[]
 *   perfil/datos      negocio, rubro, emoji, …
 */

import { initializeApp } from
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getFirestore, collection, doc,
  addDoc, getDocs, deleteDoc, setDoc, updateDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ══════════════════════════════════════════════════
// 1. FIREBASE CONFIG
// ══════════════════════════════════════════════════
const firebaseConfig = {
  apiKey:            'AIzaSyBocids5Yt8eSExznVPkkFwE_4Kq3aDGnE',
  authDomain:        'otto-claude.firebaseapp.com',
  projectId:         'otto-claude',
  storageBucket:     'otto-claude.firebasestorage.app',
  messagingSenderId: '192204294004',
  appId:             '1:192204294004:web:1cdcf94fcdb0c26eb10e21',
};
const fbApp  = initializeApp(firebaseConfig);
const db     = getFirestore(fbApp);
const auth   = getAuth(fbApp);
const gProv  = new GoogleAuthProvider();

// ══════════════════════════════════════════════════
// 2. CONFIGURACIÓN DEL DIRECTORIO
// ══════════════════════════════════════════════════
// DIR_CATS ya no es fijo — las categorías viven en Firestore
// Se usa solo como fallback para datos legacy
const DIR_CATS_LEGACY = {
  Clientes:    { icono:'👤', color:'#1967D2', bg:'#E8F0FE', label:'cliente'   },
  Empleados:   { icono:'👥', color:'#137333', bg:'#E6F4EA', label:'empleado'  },
  Proveedores: { icono:'🏭', color:'#B06000', bg:'#FEF7E0', label:'proveedor' },
  Servicios:   { icono:'⚡', color:'#7627BB', bg:'#F3E8FD', label:'servicio'  },
};

// Categorías por defecto para usuarios nuevos (se guardan en Firestore al primer login)
const CATS_DEFAULT = [
  { nombre:'Clientes',    icono:'👤', color:'#1967D2', orden:0 },
  { nombre:'Empleados',   icono:'👥', color:'#137333', orden:1 },
  { nombre:'Proveedores', icono:'🏭', color:'#B06000', orden:2 },
  { nombre:'Productos',   icono:'📦', color:'#0D47A1', orden:3 },
];
const PALETA = [
  // Verdes
  {bg:'#1B5E20', c:'#FFFFFF'}, {bg:'#2E7D32', c:'#FFFFFF'},
  {bg:'#388E3C', c:'#FFFFFF'}, {bg:'#66BB6A', c:'#1B5E20'},
  // Azules
  {bg:'#0D47A1', c:'#FFFFFF'}, {bg:'#1565C0', c:'#FFFFFF'},
  {bg:'#1976D2', c:'#FFFFFF'}, {bg:'#42A5F5', c:'#0D47A1'},
  // Rojos / Naranjas
  {bg:'#B71C1C', c:'#FFFFFF'}, {bg:'#E53935', c:'#FFFFFF'},
  {bg:'#E64A19', c:'#FFFFFF'}, {bg:'#FF7043', c:'#B71C1C'},
  // Amarillos / Ámbar
  {bg:'#F57F17', c:'#FFFFFF'}, {bg:'#F9A825', c:'#4E342E'},
  {bg:'#FFD600', c:'#4E342E'}, {bg:'#FFEE58', c:'#4E342E'},
  // Púrpuras
  {bg:'#4A148C', c:'#FFFFFF'}, {bg:'#6A1B9A', c:'#FFFFFF'},
  {bg:'#7B1FA2', c:'#FFFFFF'}, {bg:'#AB47BC', c:'#4A148C'},
  // Teales / Cyan
  {bg:'#004D40', c:'#FFFFFF'}, {bg:'#00695C', c:'#FFFFFF'},
  {bg:'#00897B', c:'#FFFFFF'}, {bg:'#26A69A', c:'#004D40'},
  // Rosas
  {bg:'#880E4F', c:'#FFFFFF'}, {bg:'#AD1457', c:'#FFFFFF'},
  {bg:'#E91E63', c:'#FFFFFF'}, {bg:'#F06292', c:'#880E4F'},
  // Grises / Oscuros
  {bg:'#212121', c:'#FFFFFF'}, {bg:'#37474F', c:'#FFFFFF'},
  {bg:'#546E7A', c:'#FFFFFF'}, {bg:'#78909C', c:'#212121'},
];
const ICONOS = [
  '👤','👥','🏭','⚡','🏪','🏬','🏢','🏠','🚗','🚚',
  '🍽️','☕','🎯','💼','💳','📱','🌱','❤️','⭐','🔑',
  '📦','🛍️','🎁','📞','✉️','🔧','⚙️','🎨','📊','💡',
  '🥐','🍰','🎓','🏋️','🔥','🚀','🫙','🌿','🧁','🎪',
];

// ══════════════════════════════════════════════════
// 3. ESTADO GLOBAL
// ══════════════════════════════════════════════════
let S = {
  uid: null, nombre: '', negocio: '', perfil: null,
  tipo: 'gasto',
  finFiltro: 'todos',
  finMes: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })(),
  pedFecha: null, ageFecha: null, taskFecha: null,
  pedModoSemana: false,
  movs: [], pedidos: [], eventos: [], tareas: [],
  notas: [],
  ottoCache: [], ottoCacheTime: 0,
  chatGuardadoId: null, // id del doc de Firestore con el historial de chat
  // Directorio en memoria (sincronizado por onSnapshot)
  directorio: [],
  dirUnsub:   null,
  // Categorías dinámicas (sincronizadas por onSnapshot)
  // Estructura: [{ _id, nombre, icono, color, parentId, orden }]
  // parentId=null → categoría principal
  // parentId='xyz' → subcategoría de xyz
  categorias: [],
  catsUnsub:  null,
};

// ══════════════════════════════════════════════════
// 4. UTILIDADES
// ══════════════════════════════════════════════════
const g       = id   => document.getElementById(id);
const col     = name => collection(db, `usuarios/${S.uid}/${name}`);
const dirCol  = ()   => collection(db, `usuarios/${S.uid}/directorio`);
const docRef  = (col2, id) => doc(db, `usuarios/${S.uid}/${col2}/${id}`);

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const diffDias = (a, b) => {
  const [ay,am,ad] = a.split('-').map(Number);
  const [by,bm,bd] = (b||hoy()).split('-').map(Number);
  return Math.round((new Date(ay,am-1,ad)-new Date(by,bm-1,bd))/86400000);
};
const fmtARS = n => {
  const abs = Math.abs(n);
  return (n<0?'-':'')+'$'+abs.toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0});
};
const fmt = ds => {
  try { return new Date(ds+'T00:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'short'}); }
  catch(e) { return ds; }
};

let sliderIdx = 0, sliderTimer = null;

function toast(msg) {
  const t = g('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 3000);
}

// ══════════════════════════════════════════════════
// 5b. CATEGORÍAS DINÁMICAS
// Firestore: usuarios/{uid}/categorias/{id}
// { nombre, icono, color, parentId, orden, activo }
// parentId=null → categoría principal
// parentId='id' → subcategoría
// ══════════════════════════════════════════════════

const catsCol = () => collection(db, `usuarios/${S.uid}/categorias`);

// ── Acceso en memoria ─────────────────────────────
const getCatsPrincipales = () =>
  S.categorias.filter(c => !c.parentId)
    .sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'','es'));

const getSubcats = (parentId) =>
  S.categorias.filter(c => c.parentId === parentId)
    .sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'','es'));

const getCatById = (id) => S.categorias.find(c => c._id === id) || null;

// ── Listener en tiempo real ───────────────────────
function fetchCategorias() {
  return new Promise((resolve) => {
    if (S.catsUnsub) S.catsUnsub();
    let primero = true;
    let resuelto = false;
    const _resolve = () => { if (!resuelto) { resuelto = true; resolve(); } };

    // Timeout de seguridad: si onSnapshot no responde en 8s, continuar igual
    const timeout = setTimeout(() => {
      console.warn('[Cats] timeout — continuando sin datos');
      _resolve();
    }, 8000);

    const q = query(catsCol(), where('activo','==',true));
    S.catsUnsub = onSnapshot(q, snap => {
      clearTimeout(timeout);
      S.categorias = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
      if (primero) { primero = false; _resolve(); }
      else { renderDirectorioGrid(); }
    }, async err => {
      clearTimeout(timeout);
      console.warn('[Cats] onSnapshot:', err.message);
      try {
        const snap = await getDocs(catsCol());
        S.categorias = snap.docs.map(d => ({ ...d.data(), _id: d.id })).filter(c => c.activo !== false);
      } catch(e) {}
      _resolve();
    });
  });
}

// ── Inicializar categorías default para usuarios nuevos ──
async function initCategoriasDefault() {
  const snap = await getDocs(catsCol());
  if (!snap.empty) return; // ya tiene categorías
  // Crear las 4 categorías principales por defecto
  for (const cat of CATS_DEFAULT) {
    await addDoc(catsCol(), {
      ...cat, parentId: null, activo: true,
      creadoEn: serverTimestamp(),
    });
  }
}

// ── CRUD categorías ───────────────────────────────
async function saveCategoria({ nombre, icono, color, parentId = null }) {
  if (!nombre?.trim()) throw new Error('El nombre es obligatorio');
  // ── Validar nombre duplicado ──────────────────────
  const nombreNorm = nombre.trim().toLowerCase();
  const duplicada = S.categorias.find(c =>
    c.parentId === parentId &&
    c.nombre.trim().toLowerCase() === nombreNorm
  );
  if (duplicada) {
    toast(`⚠️ Ya existe "${duplicada.nombre}"`);
    throw new Error('Categoría duplicada');
  }
  // ─────────────────────────────────────────────────
  const orden = S.categorias.filter(c => c.parentId === parentId).length;
  const ref = await addDoc(catsCol(), {
    nombre: nombre.trim(), icono: icono || '📁',
    color: color || '#1976D2',
    parentId, orden, activo: true,
    creadoEn: serverTimestamp(),
  });
  return { _id: ref.id, nombre: nombre.trim(), icono, color, parentId, orden };
}

async function updateCategoria(id, cambios) {
  // ── Validar nombre duplicado al renombrar ─────────
  if (cambios.nombre) {
    const nombreNorm = cambios.nombre.trim().toLowerCase();
    const catActual  = getCatById(id);
    const duplicada  = S.categorias.find(c =>
      c._id !== id &&
      c.parentId === catActual?.parentId &&
      c.nombre.trim().toLowerCase() === nombreNorm
    );
    if (duplicada) {
      toast(`⚠️ Ya existe "${duplicada.nombre}"`);
      throw new Error('Categoría duplicada');
    }
  }
  // ─────────────────────────────────────────────────
  await updateDoc(doc(db, `usuarios/${S.uid}/categorias/${id}`), {
    ...cambios, actualizadoEn: serverTimestamp(),
  });
}

async function deleteCategoria(id) {
  // Soft-delete la categoría y todas sus subcategorías
  const batch = [];
  batch.push(updateDoc(doc(db, `usuarios/${S.uid}/categorias/${id}`),
    { activo: false, actualizadoEn: serverTimestamp() }));
  // Subcategorías hijas
  S.categorias.filter(c => c.parentId === id).forEach(sub => {
    batch.push(updateDoc(doc(db, `usuarios/${S.uid}/categorias/${sub._id}`),
      { activo: false, actualizadoEn: serverTimestamp() }));
  });
  await Promise.all(batch);
}

// ══════════════════════════════════════════════════
// 5. DIRECTORIO — FUENTE ÚNICA DE VERDAD
// ══════════════════════════════════════════════════

/**
 * fetchDirectorio()
 * ─────────────────
 * FIX 1: Devuelve una Promise que resuelve con el PRIMER snapshot.
 * Esto permite que inicializarOTTO() haga `await fetchDirectorio()`
 * y garantice que S.directorio esté lleno ANTES de renderizar.
 *
 * Snapshots posteriores llaman _despuesDeActualizarDirectorio()
 * que propaga el cambio a Mi Negocio Y al picker si está abierto.
 */
function fetchDirectorio() {
  return new Promise((resolve) => {
    if (S.dirUnsub) S.dirUnsub();

    let primerLlamada = true;
    let resuelto = false;
    const _resolve = () => { if (!resuelto) { resuelto = true; resolve(); } };

    // Timeout de seguridad: si onSnapshot no responde en 8s, continuar igual
    const timeout = setTimeout(() => {
      console.warn('[Directorio] timeout — continuando sin datos');
      _resolve();
    }, 8000);

    const q = query(dirCol(), where('activo','==',true));

    S.dirUnsub = onSnapshot(q,
      snap => {
        clearTimeout(timeout);
        S.directorio = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'','es'));

        if (primerLlamada) {
          primerLlamada = false;
          _resolve();
        } else {
          _despuesDeActualizarDirectorio();
        }
      },
      err => {
        clearTimeout(timeout);
        console.warn('[Directorio] onSnapshot error:', err.message);
        getDocs(dirCol()).then(snap => {
          S.directorio = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(e => e.activo !== false)
            .sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'','es'));
          _resolve();
        }).catch(() => _resolve());
      }
    );
  });
}

/**
 * _despuesDeActualizarDirectorio()
 * FIX 2: Propagación neuronal en cada update del directorio.
 * Actualiza Mi Negocio Y re-renderiza el picker si está abierto.
 */
function _despuesDeActualizarDirectorio() {
  // Siempre actualizar el EntityGrid de Mi Negocio
  renderDirectorioGrid();
  // Si el picker dp está abierto en pantalla, actualizar su lista también
  if (g('dp-sheet')?.classList.contains('on')) {
    _dpRenderList();
  }
}

// ── Accesos en memoria ──────────────────────────
const dirGetAll   = ()    => {
  // Filtrar items cuya categoría principal existe en el sistema dinámico
  // o que no tienen categoría asignada (compatibilidad)
  const catIds = new Set(S.categorias.map(c => c._id));
  return S.directorio.filter(e =>
    !e.categoria_principal || catIds.has(e.categoria_principal)
  );
};
const dirGetById  = id    => S.directorio.find(e => e.id === id) || null;

/**
 * dirGetByCat(categoria)
 * Filtro por categoria_principal: 'Clientes'|'Empleados'|'Proveedores'|'Servicios'
 */
const dirGetByCat = cat => S.directorio
  .filter(e => e.categoria_principal === cat)
  .sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'','es'));

const dirSearch   = q     => {
  const lq = q.toLowerCase();
  return S.directorio.filter(e =>
    (e.nombre||'').toLowerCase().includes(lq) ||
    (e.metadata?.email||'').toLowerCase().includes(lq) ||
    (e.metadata?.telefono||'').includes(lq)
  );
};

/**
 * saveEntidad({ nombre, categoria_principal, icono, color_fondo, metadata })
 * Crea una nueva entidad en la colección `directorio`.
 * Devuelve el objeto con su id asignado por Firestore.
 * onSnapshot actualiza S.directorio y el grid automáticamente.
 */
async function saveEntidad({ nombre, categoria_principal, icono, color_fondo, subcatId, metadata = {} }) {
  const catDin = getCatById(categoria_principal);
  const data = {
    nombre:              nombre.trim(),
    categoria_principal,
    subcatId:            subcatId || null,
    icono:       icono       || catDin?.icono || '👤',
    color_fondo: color_fondo || catDin?.color || '#234136',
    metadata,
    activo:        true,
    creadoEn:      serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  };
  const ref = await addDoc(dirCol(), data);
  // Devolvemos id inmediatamente para que los pickers puedan seleccionarlo
  // antes de que llegue el snapshot
  return { id: ref.id, ...data };
}

async function updateEntidad(id, cambios) {
  await updateDoc(doc(db, `usuarios/${S.uid}/directorio/${id}`), {
    ...cambios, actualizadoEn: serverTimestamp(),
  });
}

async function deleteEntidad(id) {
  // Soft-delete: preserva integridad referencial en pedidos/movimientos históricos
  await updateDoc(doc(db, `usuarios/${S.uid}/directorio/${id}`), {
    activo: false, actualizadoEn: serverTimestamp(),
  });
}

// ══════════════════════════════════════════════════
// 6. MI NEGOCIO — EntityGrid
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// 6. MI NEGOCIO — Sistema de categorías dinámicas
// ══════════════════════════════════════════════════

function renderDirectorioGrid(filtro) {
  const p   = S.perfil;
  const neg = p?.negocio || S.negocio || '';
  if (neg) {
    ['mn-negocio','hd-negocio','menu-neg','perfil-neg'].forEach(id => {
      const el = g(id); if (el) el.textContent = neg;
    });
    if (g('perfil-rubro'))
      g('perfil-rubro').textContent = (p?.emoji||'💼')+' '+(p?.rubro||'Mi negocio');
  }

  const wrap = g('mn-sections'); if (!wrap) return;
  const f = (filtro || g('mn-search-inp')?.value || '').toLowerCase();
  const principales = getCatsPrincipales();

  if (!principales.length) {
    wrap.innerHTML = `
      <div style="margin:32px 16px;padding:28px 20px;background:var(--surface);
                  border-radius:18px;border:1.5px dashed var(--border);text-align:center;">
        <div style="font-size:40px;margin-bottom:10px;">🗂️</div>
        <div style="font-size:16px;font-weight:700;color:var(--t1);margin-bottom:6px;">
          Sin categorías
        </div>
        <div style="font-size:13px;color:var(--t3);margin-bottom:16px;">
          Tocá el botón de abajo para crear tu primera categoría.
        </div>
      </div>`;
    _mnAddBotonNuevaCat(wrap);
    return;
  }

  let html = `
    <div style="padding:0 12px 12px;">
      <button class="dir-add-btn rpl" id="mn-nueva-cat"
        style="border-color:var(--bosque);color:var(--bosque);font-weight:700;">
        <span class="material-icons-round">create_new_folder</span>
        Nueva categoría principal
      </button>
    </div>`;

  principales.forEach(cat => {
    let items = dirGetByCat(cat._id);
    if (f) items = items.filter(e =>
      (e.nombre||'').toLowerCase().includes(f) ||
      (e.metadata?.telefono||'').includes(f) ||
      (e.metadata?.email||'').toLowerCase().includes(f)
    );
    html += _mnCatBlock(cat, items);
  });

  wrap.innerHTML = html;
  g('mn-nueva-cat')?.addEventListener('click', () => _mnOpenCrearCat(null));
  _mnBindEvents();
}

function _mnAddBotonNuevaCat(wrap) {
  const div = document.createElement('div');
  div.style.cssText = 'padding:0 12px 24px;';
  div.innerHTML = `
    <button class="dir-add-btn rpl" id="mn-nueva-cat"
      style="border-color:var(--bosque);color:var(--bosque);font-weight:700;">
      <span class="material-icons-round">create_new_folder</span>
      Nueva categoría principal
    </button>`;
  wrap.appendChild(div);
  g('mn-nueva-cat')?.addEventListener('click', () => _mnOpenCrearCat(null));
}

function _mnCatBlock(cat, items) {
  const color = cat.color || '#234136';
  // Color de fondo suave basado en el color principal
  const bg = color + '18'; // transparencia

  let html = `
    <div class="dir-cat-block" data-cat-id="${cat._id}">
      <div class="dir-cat-hdr">
        <div class="dir-cat-icon-wrap" style="background:${color};color:#fff;">${cat.icono||'📁'}</div>
        <span class="dir-cat-label" style="color:${color};">${cat.nombre}</span>
        <span class="dir-cat-count">${items.length}</span>
        <div style="display:flex;gap:4px;margin-left:auto;">
          <button class="rpl mn-cat-edit" data-cat-id="${cat._id}"
            style="background:transparent;border:none;cursor:pointer;color:var(--t4);padding:4px;display:flex;">
            <span class="material-icons-round" style="font-size:16px">edit</span>
          </button>
          <button class="rpl mn-cat-del" data-cat-id="${cat._id}"
            style="background:transparent;border:none;cursor:pointer;color:var(--t5);padding:4px;display:flex;">
            <span class="material-icons-round" style="font-size:16px">delete_outline</span>
          </button>
        </div>
      </div>`;



  if (items.length) {
    html += `<div class="dir-entity-grid">`;
    items.forEach(e => {
      const catColor = cat.color || '#234136';
      const itemColor = e.color_fondo || catColor;
      const ini = (e.nombre||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const hasEmoji = e.icono && e.icono !== '👤' && e.icono !== '👥';
      const subcat = e.subcatId ? getCatById(e.subcatId) : null;
      const meta = [
        subcat ? `${subcat.icono||''} ${subcat.nombre}` : null,
        e.metadata?.telefono || e.metadata?.email || null,
      ].filter(Boolean).join(' · ');
      html += `
        <div class="dir-entity-card rpl" data-id="${e._id || e.id}">
          <div class="dir-entity-avatar" style="background:${itemColor};">
            ${hasEmoji
              ? `<span style="font-size:16px;">${e.icono}</span>`
              : `<span style="font-size:13px;font-weight:700;color:#fff;">${ini}</span>`}
          </div>
          <div style="flex:1;min-width:0;">
            <div class="dir-entity-name">${e.nombre}</div>
            ${meta ? `<div class="dir-entity-meta">${meta}</div>` : ''}
          </div>
          <div class="dir-entity-actions">
            <button class="dir-edit-btn rpl" data-id="${e._id || e.id}"
              style="background:transparent;border:none;cursor:pointer;color:var(--t4);padding:4px;display:flex;">
              <span class="material-icons-round" style="font-size:16px">edit</span>
            </button>
            <button class="dir-del-btn rpl" data-id="${e._id || e.id}"
              style="background:transparent;border:none;cursor:pointer;color:var(--t5);padding:4px;display:flex;">
              <span class="material-icons-round" style="font-size:16px">delete_outline</span>
            </button>
          </div>
        </div>`;
    });
    html += `</div>`;
  }

  html += `
      <button class="dir-add-btn rpl" data-add-cat="${cat._id}">
        <span class="material-icons-round">add_circle_outline</span>
        Agregar en ${cat.nombre}
      </button>
    </div>`;
  return html;
}

function _mnBindEvents() {
  const wrap = g('mn-sections'); if (!wrap) return;

  // Agregar ítem en categoría
  wrap.querySelectorAll('[data-add-cat]').forEach(btn => {
    btn.addEventListener('click', () => _mnOpenCrearItem(btn.dataset.addCat));
  });
  // Editar ítem
  wrap.querySelectorAll('.dir-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _mnOpenEditarItem(btn.dataset.id); });
  });
  // Eliminar ítem
  wrap.querySelectorAll('.dir-del-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _mnConfirmarEliminar(btn.dataset.id); });
  });
  // Click en card = editar ítem
  wrap.querySelectorAll('.dir-entity-card').forEach(card => {
    card.addEventListener('click', () => _mnOpenEditarItem(card.dataset.id));
  });
  // Editar categoría principal
  wrap.querySelectorAll('.mn-cat-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _mnOpenEditarCat(btn.dataset.catId); });
  });
  // Eliminar categoría principal
  wrap.querySelectorAll('.mn-cat-del').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _mnConfirmarEliminarCat(btn.dataset.catId); });
  });

}

// ── CRUD categorías (principal o sub) ────────────
function _mnOpenCrearCat(parentId) {
  const parent = parentId ? getCatById(parentId) : null;
  const titulo = parentId ? `Nueva subcategoría de ${parent?.nombre||''}` : 'Nueva categoría principal';
  let selColor = parent?.color || '#1976D2';

  openEdit(titulo, `
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mcat-nombre" placeholder=" " maxlength="40" autocomplete="off">
      <label class="m3-lbl">Nombre *</label>
    </div>
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mcat-icono" value="${parent?.icono||'📁'}" placeholder=" " maxlength="4"
        style="font-size:28px;text-align:center;padding:10px 12px 4px;cursor:pointer;">
      <label class="m3-lbl">Ícono (tocá para elegir emoji)</label>
    </div>
    <span class="sec-lbl">Color</span>
    <div id="mcat-color-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
      ${PALETA.map(p => `
        <button class="rpl mcat-col-btn" data-bg="${p.bg}" data-c="${p.c}"
          style="width:34px;height:34px;border-radius:50%;background:${p.bg};cursor:pointer;
                 border:3px solid ${p.bg===selColor?'#234136':'transparent'};"></button>
      `).join('')}
    </div>
    <button class="btn-save rpl" id="mcat-save">
      Guardar <span class="material-icons-round" style="font-size:18px">check</span>
    </button>`);

  setTimeout(() => g('mcat-nombre')?.focus(), 200);

  document.querySelectorAll('.mcat-col-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mcat-col-btn').forEach(x => x.style.borderColor='transparent');
      b.style.borderColor='#234136'; selColor=b.dataset.bg;
    });
  });

  g('mcat-save').addEventListener('click', async () => {
    const nombre = g('mcat-nombre')?.value.trim();
    if (!nombre) { g('mcat-nombre').style.borderColor='var(--red)'; return; }
    const icono = g('mcat-icono')?.value || '📁';
    const btn = g('mcat-save'); btn.textContent='Guardando…'; btn.disabled=true;
    try {
      await saveCategoria({ nombre, icono, color: selColor, parentId });
      closeEdit(); toast(`✅ ${nombre} creado`);
    } catch(e) { console.error(e); btn.textContent='Error'; btn.disabled=false; }
  });
}

function _mnOpenEditarCat(id) {
  const cat = getCatById(id); if (!cat) return;
  let selColor = cat.color || '#1976D2';

  openEdit(`✏️ ${cat.nombre}`, `
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mcat-nombre" value="${(cat.nombre||'').replace(/"/g,'&quot;')}" placeholder=" " maxlength="40">
      <label class="m3-lbl">Nombre *</label>
    </div>
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mcat-icono" value="${cat.icono||'📁'}" placeholder=" " maxlength="4"
        style="font-size:28px;text-align:center;padding:10px 12px 4px;cursor:pointer;">
      <label class="m3-lbl">Ícono</label>
    </div>
    <span class="sec-lbl">Color</span>
    <div id="mcat-color-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
      ${PALETA.map(p => `
        <button class="rpl mcat-col-btn" data-bg="${p.bg}"
          style="width:34px;height:34px;border-radius:50%;background:${p.bg};cursor:pointer;
                 border:3px solid ${p.bg===selColor?'#234136':'transparent'};"></button>
      `).join('')}
    </div>
    <button class="btn-save rpl" id="mcat-save" style="margin-bottom:8px;">
      Guardar cambios <span class="material-icons-round" style="font-size:18px">check</span>
    </button>
    <button class="btn-save rpl" id="mcat-del" style="background:var(--red-bg);color:var(--red);box-shadow:none;">
      🗑️ Eliminar ${cat.parentId ? 'subcategoría' : 'categoría'}
    </button>`);

  setTimeout(() => g('mcat-nombre')?.focus(), 200);

  document.querySelectorAll('.mcat-col-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mcat-col-btn').forEach(x => x.style.borderColor='transparent');
      b.style.borderColor='#234136'; selColor=b.dataset.bg;
    });
  });

  g('mcat-save').addEventListener('click', async () => {
    const nombre = g('mcat-nombre')?.value.trim(); if (!nombre) return;
    const btn = g('mcat-save'); btn.textContent='Guardando…'; btn.disabled=true;
    try {
      await updateCategoria(id, { nombre, icono: g('mcat-icono')?.value||cat.icono, color: selColor });
      closeEdit(); toast(`✅ ${nombre} actualizado`);
    } catch(e) { console.error(e); btn.textContent='Error'; btn.disabled=false; }
  });

  g('mcat-del').addEventListener('click', () => { closeEdit(); _mnConfirmarEliminarCat(id); });
}

function _mnConfirmarEliminarCat(id) {
  const cat = getCatById(id); if (!cat) return;
  const tieneItems = dirGetByCat(id).length;
  const tieneSubs  = getSubcats(id).length;
  let msg = `¿Eliminar "${cat.nombre}"?`;
  if (tieneItems) msg += `\n\n⚠️ Tiene ${tieneItems} contacto${tieneItems>1?'s':''} asociados.`;
  if (tieneSubs)  msg += `\n⚠️ Tiene ${tieneSubs} subcategoría${tieneSubs>1?'s':''} que también se eliminarán.`;
  msg += '\n\nLos registros históricos conservarán los datos.';
  if (!confirm(msg)) return;
  deleteCategoria(id).then(() => toast('Eliminado')).catch(console.error);
}

// ── CRUD ítems del directorio ─────────────────────
function _mnOpenCrearItem(catId) {
  const cat = getCatById(catId); if (!cat) return;
  let selIcono = cat.icono || '👤';
  let selColor = cat.color || '#1976D2';
  let selSubcat = '';

  openEdit(`${cat.icono||'+'} Nuevo en ${cat.nombre}`, `
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mnd-nombre" placeholder=" " maxlength="60" autocomplete="off">
      <label class="m3-lbl">Nombre *</label>
    </div>

    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mnd-tel" placeholder=" " type="tel">
      <label class="m3-lbl">Teléfono</label>
    </div>
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mnd-email" placeholder=" " type="email">
      <label class="m3-lbl">Email</label>
    </div>
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mnd-nota" placeholder=" ">
      <label class="m3-lbl">Nota</label>
    </div>
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mnd-icono" value="${selIcono}" placeholder=" " maxlength="4"
        style="font-size:28px;text-align:center;padding:10px 12px 4px;cursor:pointer;">
      <label class="m3-lbl">Ícono (tocá para elegir emoji)</label>
    </div>
    <span class="sec-lbl">Color</span>
    <div id="mnd-color-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
      ${PALETA.map(p => `
        <button class="rpl mnd-col-btn" data-bg="${p.bg}"
          style="width:34px;height:34px;border-radius:50%;background:${p.bg};cursor:pointer;
                 border:3px solid ${p.bg===selColor?'#234136':'transparent'};"></button>
      `).join('')}
    </div>
    <button class="btn-save rpl" id="mnd-save">
      Guardar <span class="material-icons-round" style="font-size:18px">check</span>
    </button>`);

  setTimeout(() => g('mnd-nombre')?.focus(), 200);
  g('mnd-icono')?.addEventListener('input', e => { selIcono = e.target.value || cat.icono || '👤'; });
  document.querySelectorAll('.mnd-col-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mnd-col-btn').forEach(x => x.style.borderColor='transparent');
      b.style.borderColor='#234136'; selColor=b.dataset.bg;
    });
  });

  g('mnd-save').addEventListener('click', async () => {
    selIcono = g('mnd-icono')?.value?.trim() || selIcono;
    const nombre = g('mnd-nombre')?.value.trim();
    if (!nombre) { g('mnd-nombre').style.borderColor='var(--red)'; return; }
    const btn = g('mnd-save'); btn.textContent='Guardando…'; btn.disabled=true;
    try {
      await saveEntidad({
        nombre, categoria_principal: catId,
        icono: selIcono, color_fondo: selColor,
        metadata: {
          telefono: g('mnd-tel')?.value.trim() || null,
          email:    g('mnd-email')?.value.trim() || null,
          nota:     g('mnd-nota')?.value.trim() || null,
        },
      });
      closeEdit(); toast(`✅ ${nombre} guardado`);
    } catch(e) { console.error(e); btn.textContent='Error — reintentar'; btn.disabled=false; }
  });
}

function _mnOpenEditarItem(id) {
  const e = dirGetById(id); if (!e) return;
  const cat = getCatById(e.categoria_principal) || { icono:'👤', color:'#234136', nombre:'Sin categoría' };
  let selIcono = e.icono || cat.icono || '👤';
  let selColor = e.color_fondo || cat.color || '#234136';

  openEdit(`✏️ ${e.nombre}`, `
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mnd-nombre" value="${(e.nombre||'').replace(/"/g,'&quot;')}" placeholder=" " maxlength="60">
      <label class="m3-lbl">Nombre *</label>
    </div>

    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mnd-tel" value="${(e.metadata?.telefono||'').replace(/"/g,'&quot;')}" placeholder=" " type="tel">
      <label class="m3-lbl">Teléfono</label>
    </div>
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mnd-email" value="${(e.metadata?.email||'').replace(/"/g,'&quot;')}" placeholder=" " type="email">
      <label class="m3-lbl">Email</label>
    </div>
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mnd-nota" value="${(e.metadata?.nota||'').replace(/"/g,'&quot;')}" placeholder=" ">
      <label class="m3-lbl">Nota</label>
    </div>
    <div class="m3-field" style="margin-bottom:14px;">
      <input class="m3-inp" id="mnd-icono" value="${selIcono}" placeholder=" " maxlength="4"
        style="font-size:28px;text-align:center;padding:10px 12px 4px;cursor:pointer;">
      <label class="m3-lbl">Ícono</label>
    </div>
    <span class="sec-lbl">Color</span>
    <div id="mnd-color-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
      ${PALETA.map(p => `
        <button class="rpl mnd-col-btn" data-bg="${p.bg}"
          style="width:34px;height:34px;border-radius:50%;background:${p.bg};cursor:pointer;
                 border:3px solid ${p.bg===selColor?'#234136':'transparent'};"></button>
      `).join('')}
    </div>
    <button class="btn-save rpl" id="mnd-save" style="margin-bottom:8px;">
      Guardar <span class="material-icons-round" style="font-size:18px">check</span>
    </button>
    <button class="btn-save rpl" id="mnd-del" style="background:var(--red-bg);color:var(--red);box-shadow:none;">
      🗑️ Eliminar
    </button>`);

  setTimeout(() => g('mnd-nombre')?.focus(), 200);
  g('mnd-icono')?.addEventListener('input', ev => { selIcono = ev.target.value || cat.icono || '👤'; });
  document.querySelectorAll('.mnd-col-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mnd-col-btn').forEach(x=>x.style.borderColor='transparent');
      b.style.borderColor='#234136'; selColor=b.dataset.bg;
    });
  });

  g('mnd-save').addEventListener('click', async () => {
    selIcono = g('mnd-icono')?.value?.trim() || selIcono;
    const nombre = g('mnd-nombre')?.value.trim(); if (!nombre) return;
    const btn=g('mnd-save'); btn.textContent='Guardando…'; btn.disabled=true;
    try {
      await updateEntidad(id, {
        nombre, icono: selIcono, color_fondo: selColor,
        metadata: {
          ...e.metadata,
          telefono: g('mnd-tel')?.value.trim() || null,
          email:    g('mnd-email')?.value.trim() || null,
          nota:     g('mnd-nota')?.value.trim() || null,
        },
      });
      closeEdit(); toast(`✅ ${nombre} actualizado`);
    } catch(err) { console.error(err); btn.textContent='Error'; btn.disabled=false; }
  });

  g('mnd-del').addEventListener('click', () => { closeEdit(); _mnConfirmarEliminar(id); });
}

function _mnConfirmarEliminar(id) {
  const e = dirGetById(id); if (!e) return;
  if (!confirm(`¿Eliminar "${e.nombre}"?\nLos registros históricos conservarán los datos.`)) return;
  deleteEntidad(id).then(() => toast(`Eliminado: ${e.nombre}`)).catch(console.error);
}

// ══════════════════════════════════════════════════
// 7. PICKER DIRECTORIO (dp-*)

//    Componente bottom-sheet conectado al directorio
// ══════════════════════════════════════════════════
let _dpCategoria  = null;
let _dpSelectedId = null;
let _dpOnSelect   = null;
let _dpQuery      = '';
let _dpSelIcono   = '👤';
let _dpSelColor   = '#E8F0FE';

function dpOpen({ categoria, titulo, selectedId, onSelect }) {
  _dpCategoria  = categoria  || null;
  _dpSelectedId = selectedId || null;
  _dpOnSelect   = onSelect;
  _dpQuery      = '';

  // Buscar la cat dinámica para defaults de ícono/color
  const catDin = categoria ? getCatById(categoria) : null;
  _dpSelIcono   = catDin?.icono  || '👤';
  _dpSelColor   = catDin?.color  || '#1976D2';

  g('dp-title').textContent = titulo
    || (catDin ? `Seleccionar en ${catDin.nombre}` : 'Directorio');

  if (g('dp-search')) g('dp-search').value = '';
  g('dp-search-clear').classList.remove('on');
  g('dp-create-modal').classList.remove('on');

  _dpRenderList();
  g('dp-overlay').classList.add('on');
  g('dp-sheet').classList.add('on');
  setTimeout(() => g('dp-search').focus(), 300);
}

function dpClose() {
  g('dp-overlay').classList.remove('on');
  g('dp-sheet').classList.remove('on');
  // Resetear botón guardar por si quedó en estado "Guardando…"
  const btn = g('dp-create-save');
  if (btn) { btn.innerHTML = '<span class="material-icons-round">check</span>'; btn.disabled = false; }
  g('dp-create-modal')?.classList.remove('on');
}

function _dpRenderList() {
  const list = g('dp-list');
  const q    = _dpQuery.trim().toLowerCase();
  // Buscar la categoría dinámica por id o por nombre (compatibilidad)
  const cat = _dpCategoria ? getCatById(_dpCategoria) || getCatsPrincipales().find(c=>c.nombre===_dpCategoria) : null;

  let items = _dpCategoria ? dirGetByCat(_dpCategoria) : dirGetAll();
  if (q) items = items.filter(e =>
    (e.nombre||'').toLowerCase().includes(q) ||
    (e.metadata?.telefono||'').includes(q) ||
    (e.metadata?.email||'').toLowerCase().includes(q)
  );
  items = [...items].sort((a,b) => {
    if ((a._id||a.id) === _dpSelectedId) return -1;
    if ((b._id||b.id) === _dpSelectedId) return  1;
    return (a.nombre||'').localeCompare(b.nombre||'','es');
  });

  const labelNuevo = q
    ? `Crear "${_dpQuery.trim()}"`
    : `Agregar en ${cat?.nombre || 'directorio'}`;

  let html = `
    <div class="dp-add-row" id="dp-add-btn">
      <div class="dp-add-icon"><span class="material-icons-round">add</span></div>
      <div class="dp-add-txt">
        <div class="dp-add-label">${labelNuevo}</div>
        <div class="dp-add-sub">Se guarda en Mi Negocio automáticamente</div>
      </div>
    </div>`;

  if (!items.length) {
    html += `
      <div class="dp-empty">
        <div class="dp-empty-icon">${cat?.icono||'📁'}</div>
        <div class="dp-empty-txt">
          ${q
            ? 'Sin resultados. Tocá "Agregar" para crear uno nuevo.'
            : `Todavía no hay nadie en ${cat?.nombre||'esta categoría'}.<br>Tocá el botón de arriba para agregar el primero.`}
        </div>
      </div>`;
  } else {
    if (_dpSelectedId && (items[0]?._id || items[0]?.id) === _dpSelectedId) {
      html += `<div class="dp-section-lbl">Seleccionado</div>`;
      html += _dpItemHTML(items[0]);
      if (items.length > 1) {
        html += `<div class="dp-section-lbl">${cat?.nombre||'Directorio'}</div>`;
        items.slice(1).forEach(e => { html += _dpItemHTML(e); });
      }
    } else {
      items.forEach(e => { html += _dpItemHTML(e); });
    }
  }

  list.innerHTML = html;

  g('dp-add-btn').addEventListener('click', () => _dpOpenCreate(_dpQuery.trim()));
  list.querySelectorAll('.dp-item[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      const ent = dirGetById(el.dataset.id);
      if (ent && _dpOnSelect) _dpOnSelect(ent);
      dpClose();
    });
  });
}

function _dpItemHTML(e) {
  const isSel = (e._id || e.id) === _dpSelectedId;
  const bg    = e.color_fondo || getCatById(e.categoria_principal)?.color || '#234136';
  // Solo metadata real — nunca el ID de Firestore
  const catNombre = getCatById(e.categoria_principal)?.nombre || '';
  const meta  = [e.metadata?.telefono, e.metadata?.email].filter(Boolean).join(' · ')
              || catNombre || '';
  return `
    <div class="dp-item${isSel?' dp-sel':''}" data-id="${e._id || e.id}">
      <div class="dp-avatar" style="background:${bg};">
        ${e.icono || getCatById(e.categoria_principal)?.icono || '👤'}
      </div>
      <div class="dp-item-info">
        <div class="dp-item-name">${e.nombre}</div>
        ${meta ? `<div class="dp-item-meta">${meta}</div>` : ''}
      </div>
      <span class="dp-check material-icons-round">check_circle</span>
    </div>`;
}

function _dpOpenCreate(nombreInicial = '') {
  const catDin = getCatById(_dpCategoria);
  g('dp-create-title').textContent = `Nuevo en ${catDin?.nombre||'directorio'}`;
  g('dp-create-nombre').value = nombreInicial;
  g('dp-create-tel').value    = '';
  g('dp-create-email').value  = '';

  // Input emoji nativo — el teclado del celular tiene el selector de emoji
  const iconGrid = g('dp-icon-grid');
  if (iconGrid) {
    iconGrid.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <input id="dp-emoji-inp" value="${_dpSelIcono}" placeholder="😊" maxlength="4"
          style="font-size:36px;text-align:center;width:72px;height:60px;
                 border:1.5px solid #E2E8E5;border-radius:12px;background:#F7F8F6;
                 outline:none;cursor:pointer;font-family:inherit;">
        <span style="font-size:13px;color:#8FA898;line-height:1.4;">
          Tocá el campo y usá<br>el teclado emoji 🎉
        </span>
      </div>`;
    g('dp-emoji-inp')?.addEventListener('input', e => {
      _dpSelIcono = e.target.value || getCatById(_dpCategoria)?.icono || '👤';
    });
  }

  // Grid de colores
  const colorGrid = g('dp-color-grid');
  colorGrid.innerHTML = PALETA.map(p => `
    <button class="dp-color-btn${p.bg===_dpSelColor?' sel':''}"
      data-bg="${p.bg}" style="background:${p.bg};"></button>
  `).join('');
  colorGrid.querySelectorAll('.dp-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      colorGrid.querySelectorAll('.dp-color-btn').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel'); _dpSelColor = btn.dataset.bg;
    });
  });

  g('dp-create-modal').classList.add('on');
  setTimeout(() => g('dp-create-nombre').focus(), 200);
}

async function _dpGuardarNuevo() {
  const nombre = g('dp-create-nombre').value.trim();
  if (!nombre) {
    g('dp-create-nombre').style.borderColor = '#C0392B';
    setTimeout(() => g('dp-create-nombre').style.borderColor='', 1500);
    return;
  }
  const btn = g('dp-create-save');
  btn.innerHTML = 'Guardando…'; btn.disabled = true;
  try {
    const nueva = await saveEntidad({
      nombre,
      categoria_principal: _dpCategoria || getCatsPrincipales()[0]?._id || 'default',
      icono:       _dpSelIcono,
      color_fondo: _dpSelColor,
      metadata: {
        telefono: g('dp-create-tel').value.trim()   || null,
        email:    g('dp-create-email').value.trim() || null,
      },
    });
    if (_dpOnSelect) _dpOnSelect(nueva);
    dpClose();
  } catch(err) {
    console.error('[Picker] guardar:', err);
    btn.innerHTML = '<span class="material-icons-round">check</span>Error — reintentar';
    btn.disabled = false;
  }
}

/**
 * dpBindTrigger — conecta cualquier campo de formulario al picker del directorio.
 * Parámetros:
 *   triggerId      id del <button class="field-trigger">
 *   lblId          id del <span> que muestra el nombre seleccionado
 *   hiddenIdId     id del <input type="hidden"> que guarda el id de entidad
 *   hiddenNombreId id del <input type="hidden"> que guarda el nombre (cache, opcional)
 *   categoria      'Clientes' | 'Empleados' | 'Proveedores' | 'Servicios'
 *   titulo         título del sheet del picker
 *   onSelect       callback opcional fn(entidad)
 */
function dpBindTrigger({ triggerId, lblId, hiddenIdId, hiddenNombreId, categoria, titulo, onSelect }) {
  const trigger = g(triggerId); if (!trigger) return;
  trigger.addEventListener('click', () => {
    dpOpen({
      categoria,
      titulo,
      selectedId: g(hiddenIdId)?.value || null,
      onSelect: ent => {
        const lbl = g(lblId);
        if (lbl) { lbl.textContent = ent.nombre; lbl.style.color = 'var(--t1)'; }
        trigger.classList.add('filled');
        if (g(hiddenIdId))     g(hiddenIdId).value     = ent.id;
        if (hiddenNombreId && g(hiddenNombreId)) g(hiddenNombreId).value = ent.nombre;
        if (onSelect) onSelect(ent);
      },
    });
  });
}

// ══════════════════════════════════════════════════
// 8. CARGA DE DATOS TRANSACCIONALES
// ══════════════════════════════════════════════════
async function loadAllData() {
  if (!S.uid) return;
  const qCol = async (name, key) => {
    try {
      const s = await getDocs(col(name));
      S[key] = s.docs.map(d => ({ ...d.data(), _id: d.id }));
    } catch(e) { console.warn(name, e.message); }
  };
  await Promise.all([
    qCol('movimientos','movs'),
    qCol('pedidos','pedidos'),
    qCol('eventos','eventos'),
    qCol('tareas','tareas'),
  ]);
}

// ══════════════════════════════════════════════════
// 9. NAVEGACIÓN
// ══════════════════════════════════════════════════
function navTo(panel) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('on'));
  const p   = g('p-'+panel);          if (p)   p.classList.add('on');
  const btn = document.querySelector(`.menu-item[data-nav="${panel}"]`);
  if (btn) btn.classList.add('on');

  if (panel === 'user')  renderUserPanel();
  if (panel === 'age')   renderAgeCalGoogle();
  if (panel === 'task')  renderCalMes('task','taskMesOffset','taskFecha',null,
    ds => S.tareas.some(t => t.fecha===ds && !t.done));
  if (panel === 'mn')    renderDirectorioGrid();
  if (panel === 'otto')  { ottoGoHome(); renderOttoStats(); }
  closeMenu();
}

// ══════════════════════════════════════════════════
// 10. MENÚ / FAB / SHEETS
// ══════════════════════════════════════════════════
const openMenu  = () => { g('menu-overlay').classList.add('on');    g('menu-panel').classList.add('on'); };
const closeMenu = () => { g('menu-overlay').classList.remove('on'); g('menu-panel').classList.remove('on'); };
const openFab   = () => { g('fab-overlay').classList.add('on');     g('fab-sheet').classList.add('on');    g('nav-fab').classList.add('open'); };
const closeFab  = () => { g('fab-overlay').classList.remove('on');  g('fab-sheet').classList.remove('on'); g('nav-fab').classList.remove('open'); };
const toggleFab = () => g('fab-sheet').classList.contains('on') ? closeFab() : openFab();

function openSheet(tipo) {
  closeFab();
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'));
  g('sheet-overlay').classList.add('on');
  const sheet = g('s-'+tipo); if (!sheet) return;
  sheet.classList.add('on');
  const today = hoy();

  if (tipo === 'fin') {
    setTipo('gasto');
    const mi = g('s-fin-monto'); if (mi) { mi.value=''; setTimeout(()=>mi.focus(),300); }
    document.querySelectorAll('.quick-amt').forEach(b=>b.classList.remove('sel'));
    if(g('s-fin-cat')) g('s-fin-cat').value='';
    g('s-fin-fecha').value = today; if(g('s-fin-desc')) g('s-fin-desc').value='';
    _resetTrigger('fin-cat-trigger',  'fin-cat-trigger-lbl',  'Seleccionar categoría…');
    // proveedor eliminado del formulario
  }
  if (tipo === 'ped') {
    ['s-ped-cli-id','s-ped-cli','s-ped-emp-id'].forEach(id=>{ if(g(id)) g(id).value=''; });
    g('s-ped-fecha').value=today; if(g('s-ped-hora')) g('s-ped-hora').value='';
    if(g('s-ped-prods')) g('s-ped-prods').innerHTML='';
    if(g('s-ped-notas')) g('s-ped-notas').value='';
    _resetTrigger('ped-cli-trigger',  'ped-cli-trigger-lbl',  'Seleccionar cliente…');
    _resetTrigger('ped-emp-trigger',  'ped-emp-trigger-lbl',  'Seleccionar empleado…');
    _resetTrigger('ped-prod-trigger', 'ped-prod-trigger-lbl', 'Agregar producto…');
  }
  if (tipo === 'age') {
    ['s-age-cli-id','s-age-cli'].forEach(id=>{ if(g(id)) g(id).value=''; });
    if(g('s-age-tit'))   g('s-age-tit').value='';
    if(g('s-age-fecha')) g('s-age-fecha').value=today;
    if(g('s-age-hora'))  g('s-age-hora').value='';
    if(g('s-age-desc'))  g('s-age-desc').value='';
    _resetTrigger('age-cli-trigger','age-cli-trigger-lbl','Seleccionar cliente…');
    setTimeout(()=>g('s-age-tit')?.focus(),300);
  }
  if (tipo === 'task') {
    if(g('s-task-tit'))   g('s-task-tit').value='';
    if(g('s-task-fecha')) g('s-task-fecha').value=today;
    if(g('s-task-desc'))  g('s-task-desc').value='';
    setTimeout(()=>g('s-task-tit')?.focus(),300);
  }
}

function _resetTrigger(triggerId, lblId, placeholder) {
  const el  = g(triggerId), lbl = g(lblId);
  if (el)  el.classList.remove('filled');
  if (lbl) { lbl.textContent = placeholder; lbl.style.color = 'var(--t4)'; }
}

const closeSheet = () => {
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'));
  g('sheet-overlay').classList.remove('on');
};

const setTipo = tipo => {
  S.tipo = tipo;
  g('pill-ing').classList.toggle('sel', tipo==='ingreso');
  g('pill-gas').classList.toggle('sel', tipo==='gasto');
  if (g('s-fin-title'))
    g('s-fin-title').textContent = tipo==='ingreso' ? '💰 Nuevo ingreso' : '💸 Nuevo gasto';
};

function openEdit(titulo, bodyHtml) {
  g('edit-title').textContent = titulo;
  g('edit-body').innerHTML    = '';
  g('edit-body').innerHTML    = bodyHtml;
  g('edit-overlay').classList.add('on');
  g('edit-sheet').classList.add('on');
}
const closeEdit = () => {
  g('edit-overlay').classList.remove('on');
  g('edit-sheet').classList.remove('on');
};

// ══════════════════════════════════════════════════
// 11. PICKER CATEGORÍAS FINANZAS
//     Dos niveles: categoría principal → subcategoría
// ══════════════════════════════════════════════════
function openFinCatPicker() {
  _openFinCatPickerConCallback(valor => {
    const lbl = g('fin-cat-trigger-lbl');
    if (lbl) { lbl.textContent=valor; lbl.style.color='var(--t1)'; }
    if (g('s-fin-cat')) g('s-fin-cat').value = valor;
    g('fin-cat-trigger')?.classList.add('filled');
    closeEdit(); // cerrar el picker y volver al sheet de finanza
  });
}

function _openFinCatPickerConCallback(onSelect) {
  const principales = getCatsPrincipales();
  const usadas = [...new Set((S.movs||[]).map(m=>m.cat).filter(Boolean))].sort();

  // Todas las categorías principales navegan al nivel 2 (muestran sus ítems)
  const dirCatNames = new Set(principales.map(c=>c.nombre));

  const items = [
    ...principales.map(cat => {
      const count = dirGetByCat(cat._id).length;
      return {
        id:        'cat:'+cat._id,
        name:      `${cat.icono||'📁'} ${cat.nombre}`,
        sub:       count ? `${count} ítem${count>1?'s':''}` : 'vacía',
        color:     cat.color,
        hasSubcats: true, // siempre navegar al nivel 2
        catId:     cat._id,
        nombre:    cat.nombre,
      };
    }),
    // Categorías históricas no presentes en el directorio
    ...usadas
      .filter(c => !principales.some(p => c.startsWith(p.nombre) || c === p.nombre))
      .map(c => ({ id:'hist:'+c, name:c, sub:'usada antes' })),
  ];

  _openFinCatDosNiveles(items, onSelect);
}

function _openFinCatDosNiveles(items, onSelect) {
  const seleccionar = (valor) => {
    if (onSelect) onSelect(valor);
  };

  const renderNivel1 = () => {
    const body = g('edit-body'); if (!body) return;
    body.innerHTML = `
      <input id="pg-search" autocomplete="off"
        style="width:100%;margin-bottom:12px;padding:10px 14px;border:1.5px solid var(--border);
               border-radius:var(--rfull);font-family:var(--font);font-size:14px;color:var(--t1);outline:none;"
        placeholder="Buscar…">
      <div id="pg-list" style="display:flex;flex-direction:column;gap:2px;max-height:400px;overflow-y:auto;">
        ${items.map(item => `
          <div class="rpl pg-item" data-id="${item.id}"
            data-name="${(item.name||'').replace(/"/g,'&quot;')}"
            data-has-subcats="${item.hasSubcats||false}"
            data-cat-id="${item.catId||''}"
            data-cat-nombre="${(item.nombre||item.name||'').replace(/^[^\w\s]+ /,'').trim().replace(/"/g,'&quot;')}"
            style="padding:12px;border-radius:var(--r10);cursor:pointer;
                   display:flex;align-items:center;gap:10px;transition:background .12s;">
            ${item.color
              ? `<div style="width:12px;height:12px;border-radius:50%;background:${item.color};flex-shrink:0;"></div>`
              : ''}
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:600;color:var(--t1);">${item.name}</div>
              ${item.sub ? `<div style="font-size:11px;color:var(--t4);margin-top:2px;">${item.sub}</div>` : ''}
            </div>
            ${item.hasSubcats
              ? `<span class="material-icons-round" style="font-size:18px;color:var(--t4)">chevron_right</span>`
              : ''}
          </div>`).join('')}
      </div>
      <div style="font-size:12px;color:var(--t4);margin-top:8px;text-align:center;">
        Escribí y presioná Enter para una categoría personalizada
      </div>`;

    const searchEl = g('pg-search');
    searchEl.addEventListener('input', () => {
      const q = searchEl.value.toLowerCase();
      g('pg-list').querySelectorAll('.pg-item').forEach(el => {
        // Buscar en nombre de categoría Y en nombres de sus ítems (nivel 2)
        const catId = el.dataset.catId;
        const matchNombre = el.dataset.name.toLowerCase().includes(q);
        const matchItems = catId
          ? dirGetByCat(catId).some(e => e.nombre.toLowerCase().includes(q))
          : false;
        el.style.display = (matchNombre || matchItems) ? '' : 'none';
      });
    });
    searchEl.addEventListener('keydown', e => {
      if (e.key==='Enter' && searchEl.value.trim())
        seleccionar(searchEl.value.trim());
    });

    g('pg-list').querySelectorAll('.pg-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background='var(--surface2)');
      el.addEventListener('mouseleave', () => el.style.background='');
      el.addEventListener('click', () => {
        const nombre = el.dataset.catNombre || el.dataset.name.replace(/^[^\w\s]+ /,'').trim();
        if (el.dataset.hasSubcats === 'true' && el.dataset.catId) {
          // Navegar al nivel 2
          renderNivel2(el.dataset.catId, nombre, el.dataset.name.split(' ')[0]);
        } else {
          seleccionar(nombre);
        }
      });
    });
    searchEl.focus();
  };

  const renderNivel2 = (catId, catNombre, catIcono) => {
    const cat   = getCatById(catId);
    const items = dirGetByCat(catId);
    const color = cat?.color || '#234136';
    const body  = g('edit-body'); if (!body) return;

    const itemsHtml = items.map(e => {
      const bg  = e.color_fondo || color;
      const ini = (e.nombre||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const hasEmoji = e.icono && e.icono !== '👤' && e.icono !== '👥';
      return `
        <div class="rpl pg-item" data-valor="${catNombre} / ${e.nombre}"
          style="padding:10px 12px;border-radius:var(--r10);cursor:pointer;
                 display:flex;align-items:center;gap:10px;transition:background .12s;">
          <div style="width:32px;height:32px;border-radius:50%;background:${bg};
                      display:flex;align-items:center;justify-content:center;
                      font-size:14px;flex-shrink:0;">
            ${hasEmoji
              ? e.icono
              : `<span style="font-size:11px;font-weight:700;color:#fff;">${ini}</span>`}
          </div>
          <div style="flex:1;font-size:14px;font-weight:600;color:var(--t1);">${e.nombre}</div>
        </div>`;
    }).join('');

    body.innerHTML = `
      <button id="pg-back"
        style="display:flex;align-items:center;gap:6px;background:transparent;border:none;
               cursor:pointer;font-family:var(--font);font-size:14px;font-weight:600;
               color:var(--bosque);padding:0 0 12px 0;">
        <span class="material-icons-round" style="font-size:18px">arrow_back</span>
        ${catIcono||''} ${catNombre}
      </button>

      <!-- Agregar nuevo ítem en esta categoría -->
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input id="pg-nuevo-inp" placeholder="Agregar nuevo en ${catNombre}…"
          style="flex:1;padding:9px 14px;border:1.5px solid var(--border);
                 border-radius:var(--rfull);font-family:var(--font);font-size:14px;
                 color:var(--t1);outline:none;background:var(--surface);">
        <button id="pg-nuevo-btn"
          style="background:${color};color:#fff;border:none;border-radius:var(--rfull);
                 padding:9px 14px;font-family:var(--font);font-size:13px;font-weight:700;
                 cursor:pointer;white-space:nowrap;">
          + Agregar
        </button>
      </div>

      <div id="pg-list" style="display:flex;flex-direction:column;gap:2px;max-height:360px;overflow-y:auto;">
        <!-- Opción: solo la categoría principal -->
        <div class="rpl pg-item" data-valor="${catNombre}"
          style="padding:10px 12px;border-radius:var(--r10);cursor:pointer;
                 display:flex;align-items:center;gap:10px;transition:background .12s;
                 border:1.5px dashed var(--border);margin-bottom:4px;">
          <div style="font-size:13px;color:var(--t3);font-style:italic;flex:1;">
            Solo "${catNombre}" (sin especificar)
          </div>
        </div>
        ${itemsHtml}
      </div>`;

    g('pg-back').addEventListener('click', () => {
      g('edit-title').textContent = 'Categoría';
      renderNivel1();
    });

    // Agregar nuevo ítem al directorio y seleccionarlo
    const _agregarNuevo = async () => {
      const nombre = g('pg-nuevo-inp')?.value.trim();
      if (!nombre) return;
      const btn = g('pg-nuevo-btn');
      btn.textContent = '…'; btn.disabled = true;
      try {
        await saveEntidad({
          nombre, categoria_principal: catId,
          icono: cat?.icono || '📁',
          color_fondo: color,
          metadata: {},
        });
        seleccionar(`${catNombre} / ${nombre}`);
        toast(`✅ "${nombre}" guardado en Mi Negocio`);
      } catch(e) {
        console.error(e);
        btn.textContent = '+ Agregar'; btn.disabled = false;
      }
    };

    g('pg-nuevo-btn').addEventListener('click', _agregarNuevo);
    g('pg-nuevo-inp').addEventListener('keydown', e => {
      if (e.key === 'Enter') _agregarNuevo();
    });

    g('pg-list').querySelectorAll('.pg-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background='var(--surface2)');
      el.addEventListener('mouseleave', () => el.style.background='');
      el.addEventListener('click', () => seleccionar(el.dataset.valor));
    });

    g('edit-title').textContent = catNombre;
  };

  openEdit('Categoría', '');
  renderNivel1();
}

// ══════════════════════════════════════════════════
// 12. PICKER GENÉRICO DE LISTA (para categorías, productos, etc.)
// ══════════════════════════════════════════════════
function _openPickerLista({ title, items, selected, onSelect, addLabel, onAdd, emptyMsg }) {
  const sorted = [...(items||[])].sort((a,b)=>(a.name||'').localeCompare(b.name||'','es'));
  const placeholder = onAdd ? 'Buscar o escribir nuevo…' : 'Buscar…';

  let html = `
    <input id="pg-search" autocomplete="off"
      style="width:100%;margin-bottom:12px;padding:10px 14px;border:1.5px solid var(--border);
             border-radius:var(--rfull);font-family:var(--font);font-size:14px;color:var(--t1);outline:none;"
      placeholder="${placeholder}">
    <div id="pg-list" style="display:flex;flex-direction:column;gap:2px;max-height:340px;overflow-y:auto;">`;

  if (!sorted.length && emptyMsg) {
    html += `<div style="padding:20px 12px;text-align:center;font-size:13px;color:var(--t4);">${emptyMsg}</div>`;
  }

  sorted.forEach(item => {
    html += `
      <div class="rpl pg-item" data-id="${item.id}"
        data-name="${(item.name||'').replace(/"/g,'&quot;')}"
        style="padding:11px 12px;border-radius:var(--r10);cursor:pointer;font-size:14px;
               font-weight:500;color:var(--t1);display:flex;align-items:center;
               justify-content:space-between;transition:background .1s;">
        <div>
          <div>${item.name}</div>
          ${item.sub ? `<div style="font-size:11px;color:var(--t4);margin-top:2px;">${item.sub}</div>` : ''}
        </div>
        ${item.id===selected
          ? '<span class="material-icons-round" style="color:var(--bosque);font-size:18px;">check_circle</span>'
          : ''}
      </div>`;
  });
  html += `</div>`;
  if (onAdd) {
    html += `<div style="font-size:12px;color:var(--t4);margin-top:8px;text-align:center;">
      Escribí y presioná Enter para agregar uno nuevo
    </div>`;
  }

  openEdit(title, html);

  const searchEl = g('pg-search');
  const listEl   = g('pg-list');

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.toLowerCase();
    listEl.querySelectorAll('.pg-item').forEach(el => {
      el.style.display = el.dataset.name.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  listEl.querySelectorAll('.pg-item').forEach(el => {
    el.addEventListener('mouseenter', () => el.style.background = 'var(--surface2)');
    el.addEventListener('mouseleave', () => el.style.background = '');
    const _doSelect = () => { if (onSelect) onSelect(el.dataset.id, el.dataset.name); closeEdit(); };
    el.addEventListener('click', _doSelect);
    el.addEventListener('touchend', e => { e.preventDefault(); _doSelect(); });
  });
  if (onAdd) {
    searchEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && searchEl.value.trim()) {
        onAdd(searchEl.value.trim()); closeEdit();
      }
    });
  }
}

// ══════════════════════════════════════════════════
// 13. PICKER PRODUCTOS (para pedidos)
// ══════════════════════════════════════════════════
function openPedProdPicker(targetBox) {
  // Buscar la categoría "Productos" dinámicamente
  // Si hay varias con el mismo nombre, usar la que tiene más ítems
  const candidatas = getCatsPrincipales().filter(c =>
    c.nombre.toLowerCase() === 'productos'
  );
  const catProductos = candidatas.length <= 1
    ? candidatas[0]
    : candidatas.map(c => ({ cat: c, count: dirGetByCat(c._id).length }))
        .sort((a, b) => b.count - a.count)[0]?.cat;

  const productos = catProductos ? dirGetByCat(catProductos._id) : [];
  const items = productos.map(e => ({ id: e._id || e.id, name: e.nombre }));

  _openPickerLista({
    title:    'Agregar producto',
    items,
    selected: '',
    onSelect: (_, nombre) => { addPedProd(nombre, targetBox); },
    addLabel: 'Producto nuevo',
    onAdd: async nombre => {
      if (!nombre?.trim()) return;
      let catId = catProductos?._id;
      if (!catId) {
        const nueva = await saveCategoria({
          nombre: 'Productos', icono: '📦', color: '#0D47A1', parentId: null,
        });
        catId = nueva._id;
      }
      await saveEntidad({
        nombre: nombre.trim(),
        categoria_principal: catId,
        icono: '📦',
        color_fondo: '#0D47A1',
        metadata: {},
      });
      addPedProd(nombre.trim(), targetBox);
      closeEdit();
      toast(`✅ "${nombre.trim()}" guardado en Mi Negocio`);
    },
    emptyMsg: 'No tenés productos cargados. Escribí el nombre y presioná Enter para crear uno.',
  });
}

function addPedProd(nombre, box) {
  const target = box || g('s-ped-prods');
  if (!target || !nombre) return;
  const div = document.createElement('div');
  div.className = 'prod-row';
  div.innerHTML = `
    <span class="prod-row-name">${nombre}</span>
    <div class="prod-row-qty">
      <button class="qty-btn rpl" data-a="dec">−</button>
      <input class="qty-num" type="number" value="1" min="1" inputmode="numeric"
        style="width:36px;text-align:center;border:none;background:transparent;
               font-family:var(--font);font-size:14px;font-weight:700;color:var(--t1);outline:none;">
      <button class="qty-btn rpl" data-a="inc">+</button>
    </div>
    <button class="prod-row-del rpl">
      <span class="material-icons-round" style="font-size:18px">close</span>
    </button>`;
  div.querySelector('[data-a="dec"]').addEventListener('click', () => {
    const n=div.querySelector('.qty-num'), v=parseInt(n.value)-1;
    if (v<1) div.remove(); else n.value=v;
  });
  div.querySelector('[data-a="inc"]').addEventListener('click', () => {
    const n=div.querySelector('.qty-num'); n.value=parseInt(n.value)+1;
  });
  div.querySelector('.prod-row-del').addEventListener('click', () => div.remove());
  target.appendChild(div);
  const lbl = g('ped-prod-trigger-lbl');
  if (lbl) { lbl.textContent='+ Agregar otro'; lbl.style.color='var(--bosque)'; }
}

// ══════════════════════════════════════════════════
// 14. GUARDAR / ELIMINAR MOVIMIENTOS
// ══════════════════════════════════════════════════
async function saveMov() {
  const monto = parseFloat(g('s-fin-monto')?.value);
  if (!monto||monto<=0) { toast('Ingresá un monto válido'); return; }
  const provId  = g('s-fin-prov-id')?.value || '';
  const provNom = provId ? dirGetById(provId)?.nombre||'' : '';
  const data = {
    tipo:            S.tipo, monto,
    cat:             g('s-fin-cat')?.value||'Sin categoría',
    fecha:           g('s-fin-fecha')?.value||hoy(),
    desc:            g('s-fin-desc')?.value.trim()||'',
    proveedorId:     provId, proveedorNombre: provNom,
    creadoEn:        new Date().toISOString(),
  };
  try {
    const ref = await addDoc(col('movimientos'), data);
    S.movs.push({...data, _id:ref.id}); S.ottoCache=[];
    closeSheet(); toast(S.tipo==='ingreso'?'✅ Ingreso guardado':'✅ Gasto guardado'); navTo('fin');
    renderHomeBal(); renderMovsFin();
  } catch(e) { console.error(e); toast('Error al guardar'); }
}

async function delMov(id) {
  try {
    await deleteDoc(docRef('movimientos',id));
    S.movs=S.movs.filter(m=>m._id!==id); S.ottoCache=[];
    renderMovsFin(); renderHomeBal(); toast('Eliminado');
  } catch(e) { console.error(e); }
}

function editMov(id) {
  const m = S.movs.find(m=>m._id===id); if (!m) return;

  const _render = (catVal) => {
    const catActual = catVal !== undefined ? catVal : (m.cat || '');
    g('edit-title').textContent = '✏️ Editar movimiento';
    g('edit-body').innerHTML = `
      <div class="tipo-pills" style="margin-bottom:12px;">
        <button class="tipo-pill ing${m.tipo==='ingreso'?' sel':''} rpl" id="ep-pill-ing">
          <span class="material-icons-round">trending_up</span>Ingreso
        </button>
        <button class="tipo-pill gas${m.tipo==='gasto'?' sel':''} rpl" id="ep-pill-gas">
          <span class="material-icons-round">trending_down</span>Gasto
        </button>
      </div>
      <div class="m3-field"><input class="m3-inp" id="ep-monto" type="number" value="${m.monto}" placeholder=" " inputmode="decimal"><label class="m3-lbl">Monto</label></div>
      <span class="field-trigger-lbl" style="margin-top:4px;">Categoría</span>
      <button class="field-trigger rpl${catActual?' filled':''}" id="ep-cat-trigger">
        <span id="ep-cat-lbl" style="color:${catActual?'var(--t1)':'var(--t4)'};">
          ${catActual || 'Seleccionar categoría…'}
        </span>
        <span class="material-icons-round">expand_more</span>
      </button>
      <input type="hidden" id="ep-cat" value="${catActual.replace(/"/g,'&quot;')}">
      <div class="m3-field" style="margin-top:12px;"><input class="m3-inp" id="ep-fecha" type="date" value="${m.fecha||''}" placeholder=" "><label class="m3-lbl">Fecha</label></div>
      <div class="m3-field"><input class="m3-inp" id="ep-desc" value="${(m.desc||'').replace(/"/g,'&quot;')}" placeholder=" "><label class="m3-lbl">Nota</label></div>
      <button class="btn-save rpl" id="ep-save">Guardar cambios</button>`;

    g('ep-cat-trigger').addEventListener('click', () => {
      _openFinCatPickerConCallback(valor => { _render(valor); });
    });

    let tipoEdit = m.tipo;
    g('ep-pill-ing').addEventListener('click',()=>{ tipoEdit='ingreso'; g('ep-pill-ing').classList.add('sel'); g('ep-pill-gas').classList.remove('sel'); });
    g('ep-pill-gas').addEventListener('click',()=>{ tipoEdit='gasto';   g('ep-pill-gas').classList.add('sel'); g('ep-pill-ing').classList.remove('sel'); });
    g('ep-save').addEventListener('click', async () => {
      const monto = parseFloat(g('ep-monto')?.value); if (!monto||monto<=0) return;
      const upd = { tipo:tipoEdit, monto, cat:g('ep-cat')?.value.trim()||m.cat, fecha:g('ep-fecha')?.value||m.fecha, desc:g('ep-desc')?.value.trim()||'' };
      try {
        await updateDoc(docRef('movimientos',id), upd);
        Object.assign(m,upd); S.ottoCache=[];
        closeEdit(); toast('✅ Actualizado'); renderMovsFin(); renderHomeBal();
      } catch(e) { console.error(e); toast('Error'); }
    });
  };

  openEdit('✏️ Editar movimiento', '');
  _render();
}


// ══════════════════════════════════════════════════
// 15. GUARDAR / ELIMINAR PEDIDOS
// ══════════════════════════════════════════════════
async function savePed() {
  const cliId  = g('s-ped-cli-id')?.value||'';
  const cliNom = g('s-ped-cli')?.value||'';
  if (!cliNom) { toast('Seleccioná un cliente'); return; }
  // ── Detección de pedido duplicado ────────────────
  const fechaIngresada = g('s-ped-fecha')?.value || hoy();
  const duplicado = S.pedidos.find(p =>
    !p.archivado &&
    p.cliNom === cliNom &&
    p.fecha === fechaIngresada
  ) || S.pedidos.find(p =>
    !p.archivado &&
    (p.cli || '').toLowerCase() === cliNom.toLowerCase() &&
    p.fecha === fechaIngresada
  );
  if (duplicado) {
    const confirmar = confirm(`⚠️ Ya existe un pedido de "${cliNom}" para el ${fechaIngresada}.

¿Querés guardarlo igual?`);
    if (!confirmar) return;
  }
  // ─────────────────────────────────────────────────
  const empId  = g('s-ped-emp-id')?.value||'';
  const empNom = empId ? dirGetById(empId)?.nombre||'' : '';
  const items  = [];
  g('s-ped-prods')?.querySelectorAll('.prod-row').forEach(row => {
    const n=row.querySelector('.prod-row-name')?.textContent||'';
    const q=parseInt(row.querySelector('.qty-num')?.value||'1');
    if (n) items.push({p:n,q});
  });
  const data = {
    cli:cliNom, cliId,
    empleadoId:empId, empleadoNombre:empNom,
    fecha:g('s-ped-fecha')?.value||hoy(), hora:g('s-ped-hora')?.value||'',
    items, notas:g('s-ped-notas')?.value.trim()||'',
    archivado:false, creadoEn:new Date().toISOString(),
  };
  try {
    const ref = await addDoc(col('pedidos'), data);
    S.pedidos.push({...data,_id:ref.id}); S.ottoCache=[];
    S.pedFecha = data.fecha; // navegar al día del pedido guardado
    closeSheet(); toast('✅ Pedido guardado'); navTo('ped');
    renderPeds(); renderPedWeek(); renderProduceDia();
  } catch(e) { console.error(e); toast('Error al guardar'); }
}

async function archivarPed(id) {
  try {
    await updateDoc(docRef('pedidos',id),{archivado:true});
    const p=S.pedidos.find(p=>p._id===id); if(p) p.archivado=true;
    renderPeds(); renderProduceDia(); toast('✅ Entregado');
  } catch(e) { console.error(e); }
}

async function delPed(id) {
  try {
    await deleteDoc(docRef('pedidos',id));
    S.pedidos=S.pedidos.filter(p=>p._id!==id);
    renderPeds(); renderPedWeek(); renderProduceDia(); toast('Eliminado');
  } catch(e) { console.error(e); }
}

async function reabrirPed(id) {
  try {
    await updateDoc(docRef('pedidos',id),{archivado:false});
    const p=S.pedidos.find(p=>p._id===id); if(p) p.archivado=false;
    renderPeds(); renderPedWeek(); renderProduceDia(); toast('Pedido reabierto');
  } catch(e) { console.error(e); }
}

function editPed(id) {
  const p=S.pedidos.find(p=>p._id===id); if (!p) return;
  const prodsHtml=(p.items||[]).map(i=>`
    <div class="prod-row">
      <span class="prod-row-name">${i.p||''}</span>
      <div class="prod-row-qty">
        <button class="qty-btn rpl" data-a="dec">−</button>
        <span class="qty-num">${i.q||1}</span>
        <button class="qty-btn rpl" data-a="inc">+</button>
      </div>
      <button class="prod-row-del rpl"><span class="material-icons-round" style="font-size:18px">close</span></button>
    </div>`).join('');
  openEdit('✏️ Editar pedido', `
    <div class="m3-field"><input class="m3-inp" id="ep-cli"   value="${(p.cli||'').replace(/"/g,'&quot;')}" placeholder=" "><label class="m3-lbl">Cliente</label></div>
    <div class="inp-row">
      <div class="m3-field"><input class="m3-inp" id="ep-fecha" type="date" value="${p.fecha||''}" placeholder=" "><label class="m3-lbl">Fecha</label></div>
      <div class="m3-field"><input class="m3-inp" id="ep-hora"  type="time" value="${p.hora||''}"  placeholder=" "><label class="m3-lbl">Hora</label></div>
    </div>
    <span class="sec-lbl">Productos</span>
    <div id="ep-prods">${prodsHtml}</div>
    <button class="add-prod-btn rpl" id="ep-add-prod">
      <span class="material-icons-round" style="font-size:16px">add</span>Agregar producto
    </button>
    <div class="m3-field">
      <textarea class="m3-select" id="ep-notas" rows="2" style="resize:none;padding-top:10px;" placeholder="Notas…">${p.notas||''}</textarea>
    </div>
    <button class="btn-save rpl" id="ep-save">Guardar cambios</button>`);

  // Listeners qty en productos existentes
  g('ep-prods').querySelectorAll('.prod-row').forEach(row => {
    row.querySelector('[data-a="dec"]').addEventListener('click',()=>{
      const n=row.querySelector('.qty-num'),v=parseInt(n.value||n.textContent)-1;
      if(v<1) row.remove(); else { n.value ? n.value=v : n.textContent=v; }
    });
    row.querySelector('[data-a="inc"]').addEventListener('click',()=>{
      const n=row.querySelector('.qty-num');
      n.value ? n.value=parseInt(n.value)+1 : n.textContent=parseInt(n.textContent)+1;
    });
    row.querySelector('.prod-row-del').addEventListener('click',()=>row.remove());
  });

  g('ep-add-prod').addEventListener('click',()=>openPedProdPicker(g('ep-prods')));

  g('ep-save').addEventListener('click', async () => {
    const cli=g('ep-cli')?.value.trim(); if(!cli){toast('Ingresá el cliente');return;}
    const items=[];
    g('ep-prods').querySelectorAll('.prod-row').forEach(row=>{
      const n=row.querySelector('.prod-row-name')?.textContent||'';
      const q=parseInt(row.querySelector('.qty-num')?.value||'1');
      if(n) items.push({p:n,q});
    });
    const upd={cli, fecha:g('ep-fecha')?.value||p.fecha, hora:g('ep-hora')?.value||'', items, notas:g('ep-notas')?.value.trim()||''};
    try {
      await updateDoc(docRef('pedidos',id),upd);
      Object.assign(p,upd); S.ottoCache=[];
      closeEdit(); toast('✅ Pedido actualizado'); renderPeds(); renderPedWeek(); renderProduceDia();
    } catch(e) { console.error(e); toast('Error'); }
  });
}

// ══════════════════════════════════════════════════
// 16. GUARDAR / ELIMINAR EVENTOS
// ══════════════════════════════════════════════════
async function saveEv() {
  const tit=g('s-age-tit')?.value.trim(); if(!tit){toast('Ingresá un título');return;}
  const cliId=g('s-age-cli-id')?.value||'';
  const data={
    tit, fecha:g('s-age-fecha')?.value||hoy(), hora:g('s-age-hora')?.value||'',
    clienteId:cliId, cliente:g('s-age-cli')?.value||'',
    prio:g('s-age-prio')?.value||'normal', desc:g('s-age-desc')?.value.trim()||'',
    creadoEn:new Date().toISOString(),
  };
  try {
    const ref=await addDoc(col('eventos'),data);
    S.eventos.push({...data,_id:ref.id}); S.ottoCache=[];
    closeSheet(); toast('✅ Agendado'); navTo('age');
  } catch(e){console.error(e);toast('Error');}
}

async function delEv(id) {
  try {
    await deleteDoc(docRef('eventos',id));
    S.eventos=S.eventos.filter(e=>e._id!==id);
    renderEvs(); renderAgeCalGoogle(); toast('Eliminado');
  } catch(e){console.error(e);}
}

function editEv(id) {
  const e=S.eventos.find(e=>e._id===id); if(!e)return;
  openEdit('✏️ Editar evento',`
    <div class="m3-field"><input class="m3-inp" id="ee-tit"   value="${(e.tit||'').replace(/"/g,'&quot;')}" placeholder=" "><label class="m3-lbl">Título</label></div>
    <div class="inp-row">
      <div class="m3-field"><input class="m3-inp" id="ee-fecha" type="date" value="${e.fecha||''}" placeholder=" "><label class="m3-lbl">Fecha</label></div>
      <div class="m3-field"><input class="m3-inp" id="ee-hora"  type="time" value="${e.hora||''}"  placeholder=" "><label class="m3-lbl">Hora</label></div>
    </div>
    <div class="m3-field"><input class="m3-inp" id="ee-cli" value="${(e.cliente||'').replace(/"/g,'&quot;')}" placeholder=" "><label class="m3-lbl">Cliente</label></div>
    <select class="m3-select" id="ee-prio">
      <option value="normal"  ${e.prio!=='urgente'?'selected':''}>Normal</option>
      <option value="urgente" ${e.prio==='urgente'?'selected':''}>🔴 Urgente</option>
    </select>
    <textarea class="m3-select" id="ee-desc" rows="2" style="resize:none;padding-top:10px;">${e.desc||''}</textarea>
    <button class="btn-save rpl" id="ee-save">Guardar cambios</button>`);
  g('ee-save').addEventListener('click',async()=>{
    const tit=g('ee-tit')?.value.trim(); if(!tit){toast('El título es obligatorio');return;}
    const upd={tit,fecha:g('ee-fecha')?.value||e.fecha,hora:g('ee-hora')?.value||'',cliente:g('ee-cli')?.value.trim()||'',prio:g('ee-prio')?.value||'normal',desc:g('ee-desc')?.value.trim()||''};
    try{await updateDoc(docRef('eventos',id),upd);Object.assign(e,upd);S.ottoCache=[];closeEdit();toast('✅ Actualizado');renderEvs();renderAgeCalGoogle();}
    catch(err){console.error(err);toast('Error');}
  });
}

// ══════════════════════════════════════════════════
// 17. GUARDAR / ELIMINAR TAREAS
// ══════════════════════════════════════════════════
async function saveTask() {
  const tit=g('s-task-tit')?.value.trim(); if(!tit){toast('Ingresá una tarea');return;}
  const data={tit,done:false,fecha:g('s-task-fecha')?.value||'',prio:g('s-task-prio')?.value||'normal',desc:g('s-task-desc')?.value.trim()||'',creadoEn:new Date().toISOString()};
  try{const ref=await addDoc(col('tareas'),data);S.tareas.push({...data,_id:ref.id});S.ottoCache=[];closeSheet();toast('✅ Tarea guardada');navTo('task');}
  catch(e){console.error(e);toast('Error');}
}

async function toggleTask(id) {
  const t=S.tareas.find(t=>t._id===id); if(!t)return; t.done=!t.done;
  try{await updateDoc(docRef('tareas',id),{done:t.done});renderTasks();updateBanner();}
  catch(e){console.error(e);}
}

async function delTask(id) {
  try{await deleteDoc(docRef('tareas',id));S.tareas=S.tareas.filter(t=>t._id!==id);renderTasks();updateBanner();}
  catch(e){console.error(e);}
}

function editTask(id) {
  const t=S.tareas.find(t=>t._id===id); if(!t)return;
  openEdit('✏️ Editar tarea',`
    <div class="m3-field"><input class="m3-inp" id="et-tit"   value="${(t.tit||'').replace(/"/g,'&quot;')}" placeholder=" "><label class="m3-lbl">Tarea</label></div>
    <div class="inp-row">
      <div class="m3-field"><input class="m3-inp" id="et-fecha" type="date" value="${t.fecha||''}" placeholder=" "><label class="m3-lbl">Para cuándo</label></div>
      <select class="m3-select" id="et-prio">
        <option value="normal"  ${t.prio!=='urgente'?'selected':''}>Normal</option>
        <option value="urgente" ${t.prio==='urgente'?'selected':''}>🔴 Urgente</option>
      </select>
    </div>
    <div class="m3-field"><input class="m3-inp" id="et-desc" value="${(t.desc||'').replace(/"/g,'&quot;')}" placeholder=" "><label class="m3-lbl">Nota</label></div>
    <button class="btn-save rpl" id="et-save">Guardar cambios</button>`);
  g('et-save').addEventListener('click',async()=>{
    const tit=g('et-tit')?.value.trim(); if(!tit)return;
    const upd={tit,fecha:g('et-fecha')?.value||'',prio:g('et-prio')?.value||'normal',desc:g('et-desc')?.value.trim()||''};
    try{await updateDoc(docRef('tareas',id),upd);Object.assign(t,upd);S.ottoCache=[];closeEdit();toast('✅ Actualizada');renderTasks();updateBanner();}
    catch(err){console.error(err);toast('Error');}
  });
}

// ══════════════════════════════════════════════════
// 18. RENDER HOME
// ══════════════════════════════════════════════════
function renderHomeBal() {
  const mes  = new Date().toISOString().slice(0,7);
  const hoyStr = hoy();
  const mm   = S.movs.filter(m=>m.fecha?.startsWith(mes));
  const ing  = mm.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
  const gas  = mm.filter(m=>m.tipo==='gasto')  .reduce((s,m)=>s+m.monto,0);
  const bal  = ing - gas; // ganancia = ingresos - gastos

  // h-net: ganancia al día de hoy (balance del mes hasta hoy)
  const hNet = g('h-net');
  if (hNet) {
    hNet.textContent = (bal>=0?'+':'')+fmtARS(bal);
    hNet.style.color = bal>=0 ? 'rgba(255,255,255,1)' : '#FFB3B3';
  }
  // h-ing: ingresos del mes
  if (g('h-ing')) g('h-ing').textContent = '+'+fmtARS(ing);
  // h-bal: gastos del mes (siempre negativo)
  const be = g('h-bal');
  if (be) { be.textContent = '-'+fmtARS(gas); be.className = 'hero-card-val neg'; }

  // Panel finanzas
  if (g('fin-ing')) g('fin-ing').textContent = '+'+fmtARS(ing);
  if (g('fin-gas')) g('fin-gas').textContent = fmtARS(gas);
  const ne = g('fin-net');
  if (ne) { ne.textContent=(bal>=0?'+':'')+fmtARS(bal); ne.className='fin-res-val '+(bal>=0?'pos':'neg'); }
}

function updateBanner() {
  const pend=S.tareas.filter(t=>!t.done).length;
  const urg=S.tareas.filter(t=>!t.done&&t.prio==='urgente').length;
  const b=g('h-banner'); if(!b)return;
  if(!pend)       b.textContent='Sin tareas pendientes esta semana';
  else if(urg)    b.textContent=`${pend} tarea${pend>1?'s':''} · ${urg} urgente${urg>1?'s':''}`;
  else            b.textContent=`${pend} tarea${pend>1?'s':''} pendiente${pend>1?'s':''}`;
}

function renderWeek() {
  const wrap=g('h-week'); if(!wrap)return;
  const today=new Date(); today.setHours(0,0,0,0);
  const mon=new Date(today); mon.setDate(today.getDate()-(today.getDay()||7)+1);
  const days=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
  const DIAS=['L','M','X','J','V','S','D'];
  wrap.innerHTML=days.map((d,i)=>{
    const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const isToday=d.getTime()===today.getTime();
    const total=S.pedidos.filter(p=>p.fecha===ds&&!p.archivado).length+S.eventos.filter(e=>e.fecha===ds).length;
    return `<div class="week-day${total?' rpl':''}" data-fecha="${ds}" style="${total?'cursor:pointer':''}">
      <span class="week-day-lbl">${DIAS[i]}</span>
      <span class="week-day-num${isToday?' today':''}">${d.getDate()}</span>
      <span class="week-day-badge${total?' on':''}">${total||''}</span>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.week-day[data-fecha]').forEach(el=>{
    el.addEventListener('click',()=>{
      const fecha=el.dataset.fecha;
      if(S.pedidos.filter(p=>p.fecha===fecha&&!p.archivado).length>0){
        S.pedFecha=fecha; navTo('ped'); renderPedWeek(); renderPeds(); renderProduceDia();
      }
    });
  });
}

// ══════════════════════════════════════════════════
// 19. RENDER FINANZAS
// ══════════════════════════════════════════════════
function renderMovsFin() {
  const [y,m]=S.finMes.split('-').map(Number);
  const mesNombre=new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
  if(g('fin-mes-lbl'))g('fin-mes-lbl').textContent=mesNombre.charAt(0).toUpperCase()+mesNombre.slice(1);
  const total=S.movs.filter(m=>m.fecha?.startsWith(S.finMes)).length;
  if(g('fin-tx-count'))g('fin-tx-count').textContent=`${total} transacción${total!==1?'es':''}`;
  const ing=S.movs.filter(m=>m.tipo==='ingreso'&&m.fecha?.startsWith(S.finMes)).reduce((s,m)=>s+m.monto,0);
  const gas=S.movs.filter(m=>m.tipo==='gasto'  &&m.fecha?.startsWith(S.finMes)).reduce((s,m)=>s+m.monto,0);
  const net=ing-gas;
  if(g('fin-ing'))g('fin-ing').textContent=fmtARS(ing);
  if(g('fin-gas'))g('fin-gas').textContent=fmtARS(gas);
  const ne=g('fin-net'); if(ne){ne.textContent=(net>=0?'+':'')+fmtARS(net);ne.className='fin-res-val '+(net>=0?'pos':'neg');}

  const movsMes=S.movs.filter(m=>{
    if(!m.fecha?.startsWith(S.finMes))return false;
    if(S.finFiltro==='ingreso')return m.tipo==='ingreso';
    if(S.finFiltro==='gasto')return m.tipo==='gasto';
    return true;
  }).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));

  const list=g('mov-list'); if(!list)return;
  if(!movsMes.length){
    list.innerHTML=`<div class="empty-state"><div class="empty-icon">💸</div><div class="empty-title">Sin movimientos</div><div class="empty-sub">Registrá tu primera venta o gasto.</div></div>`;
    return;
  }
  const grupos={},fechasOrden=[];
  movsMes.forEach(m=>{const k=m.fecha||'Sin fecha';if(!grupos[k]){grupos[k]=[];fechasOrden.push(k);}grupos[k].push(m);});
  // Ordenar fechas de más reciente a más antigua
  const fechasUnicas=[...new Set(fechasOrden)].sort((a,b)=>b.localeCompare(a));
  list.innerHTML=fechasUnicas.map(f=>{
    const ms=grupos[f];
    const totalDia=ms.reduce((s,m)=>s+(m.tipo==='ingreso'?m.monto:-m.monto),0);
    const fechaLabel=f==='Sin fecha'?'Sin fecha':new Date(f+'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
    const fechaCap=fechaLabel.charAt(0).toUpperCase()+fechaLabel.slice(1);
    return `
      <div class="fin-group-hdr">
        <span class="fin-group-fecha">${fechaCap}</span>
        <span class="fin-group-line"></span>
        <span class="fin-group-total ${totalDia>=0?'pos':'neg'}">${totalDia>=0?'+':''}${fmtARS(Math.abs(totalDia))}</span>
      </div>
      <div style="background:var(--surface);border-radius:var(--r14);margin:0 12px 8px;border:1px solid var(--border2);overflow:hidden;box-shadow:var(--s1);">
        ${ms.map(m=>`
          <div class="mov-card" data-id="${m._id}" data-expanded="0">
            <div class="mov-icon" style="background:${m.tipo==='ingreso'?'var(--green-bg)':'var(--red-bg)'}">
              <span class="material-icons-round" style="color:${m.tipo==='ingreso'?'var(--bosque)':'var(--red)'}">
                ${m.tipo==='ingreso'?'trending_up':'trending_down'}
              </span>
            </div>
            <div class="mov-info">
              <div class="mov-cat">${m.cat||'Sin categoría'}</div>
              ${m.desc?`<div class="mov-desc">${m.desc}</div>`:''}
              ${m.proveedorNombre?`<div class="mov-desc">🏭 ${m.proveedorNombre}</div>`:''}
            </div>
            <div class="mov-right">
              <div class="mov-amt ${m.tipo==='ingreso'?'pos':'neg'}">${m.tipo==='ingreso'?'+':'-'}${fmtARS(m.monto)}</div>
            </div>
          </div>
          <div class="mov-actions-row" id="mactions-${m._id}" style="display:none;">
            <button class="mov-action edit rpl" data-id="${m._id}" data-a="edit"><span class="material-icons-round">edit</span>Editar</button>
            <button class="mov-action del  rpl" data-id="${m._id}" data-a="del" ><span class="material-icons-round">delete_outline</span>Eliminar</button>
          </div>`).join('')}
      </div>`;
  }).join('');

  list.querySelectorAll('.mov-card').forEach(card=>{
    card.addEventListener('click',()=>{
      const id=card.dataset.id, actions=g('mactions-'+id); if(!actions)return;
      const open=card.dataset.expanded==='1';
      list.querySelectorAll('.mov-card').forEach(c=>{c.dataset.expanded='0';c.style.background='';});
      list.querySelectorAll('.mov-actions-row').forEach(a=>a.style.display='none');
      if(!open){card.dataset.expanded='1';card.style.background='var(--surface2)';actions.style.display='flex';}
    });
  });
  list.querySelectorAll('[data-a]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      if(btn.dataset.a==='edit') editMov(btn.dataset.id);
      else if(btn.dataset.a==='del'&&confirm('¿Eliminar?')) delMov(btn.dataset.id);
    });
  });
}

function cambiarMesFin(delta) {
  const [y,m]=S.finMes.split('-').map(Number);
  const d=new Date(y,m-1+delta,1);
  S.finMes=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  finCatSel=null; renderMovsFin(); renderHomeBal();
  if(g('fin-view-cats')?.style.display!=='none') renderFinCats();
}

// ─── Vista donut ───
const DONUT_COLORS=['#234136','#5E7A68','#1A7A62','#2E8B57','#3CB371','#20B2AA','#4682B4','#5B4FCF','#8B6914','#B7770D','#C0392B','#E74C3C'];
let finCatTipo='ingreso', finCatSel=null;

function renderFinCats() {
  const movs=S.movs.filter(m=>m.fecha?.startsWith(S.finMes)&&m.tipo===finCatTipo);
  const cats={}; movs.forEach(m=>{const c=m.cat||'Sin categoría';cats[c]=(cats[c]||0)+m.monto;});
  const total=Object.values(cats).reduce((s,v)=>s+v,0);
  const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  if(g('fin-donut-tipo-lbl'))g('fin-donut-tipo-lbl').textContent=finCatTipo==='ingreso'?'INGRESOS ▾':'GASTOS ▾';
  const svg=g('fin-donut-svg'); const cx=100,cy=100,r=82,stroke=18,circ=2*Math.PI*r;
  if(!sorted.length){
    if(svg)svg.innerHTML=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border2)" stroke-width="${stroke}"/>`;
    if(g('fin-donut-amt'))g('fin-donut-amt').textContent=fmtARS(0);
    if(g('fin-cat-list'))g('fin-cat-list').innerHTML=`<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Sin datos</div></div>`;
    return;
  }
  let offset=0;
  const segments=sorted.map(([cat,val],i)=>{const pct=val/total,dash=pct*circ,gap=circ-dash,color=DONUT_COLORS[i%DONUT_COLORS.length],seg={cat,val,pct,dash,gap,offset,color};offset+=dash;return seg;});
  if(svg){
    svg.innerHTML=`<g transform="rotate(-90 ${cx} ${cy})">
      ${segments.map(s=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-dasharray="${s.dash} ${s.gap}" stroke-dashoffset="${-s.offset}" stroke-linecap="round" data-cat="${s.cat.replace(/"/g,'&quot;')}" style="cursor:pointer;opacity:${finCatSel&&finCatSel!==s.cat?'0.35':'1'};transition:opacity .2s"/>`).join('')}
    </g>`;
    svg.querySelectorAll('circle[data-cat]').forEach(el=>{
      el.addEventListener('click',()=>{finCatSel=finCatSel===el.dataset.cat?null:el.dataset.cat;_renderDonutCenter(segments,total);_renderCatList(segments,total);});
    });
  }
  _renderDonutCenter(segments,total); _renderCatList(segments,total);
}

function _renderDonutCenter(segments,total){
  const sel=finCatSel?segments.find(s=>s.cat===finCatSel):null;
  if(g('fin-donut-amt'))g('fin-donut-amt').textContent=fmtARS(sel?sel.val:total);
  if(g('fin-donut-cat'))g('fin-donut-cat').textContent=sel?sel.cat.toUpperCase():(finCatTipo==='ingreso'?'TOTAL INGRESOS':'TOTAL GASTOS');
  if(g('fin-donut-emoji'))g('fin-donut-emoji').textContent=finCatTipo==='ingreso'?'📈':'📉';
  const svg=g('fin-donut-svg'); if(svg) svg.querySelectorAll('circle[data-cat]').forEach(el=>{el.style.opacity=finCatSel&&finCatSel!==el.dataset.cat?'0.35':'1';});
}

function _renderCatList(segments,total){
  const list=g('fin-cat-list'); if(!list)return;
  list.innerHTML=segments.map((s,i)=>`
    <div class="fin-cat-item rpl${finCatSel===s.cat?' sel':''}" data-cat="${s.cat.replace(/"/g,'&quot;')}">
      <div class="fin-cat-dot" style="background:${s.color}"></div>
      <div class="fin-cat-name">${s.cat}</div>
      <div><div class="fin-cat-amt">${fmtARS(s.val)}</div><div class="fin-cat-pct">${(s.pct*100).toFixed(1)}%</div></div>
    </div>`).join('');
  list.querySelectorAll('.fin-cat-item').forEach(el=>{
    el.addEventListener('click',()=>{finCatSel=finCatSel===el.dataset.cat?null:el.dataset.cat;_renderDonutCenter(segments,total);_renderCatList(segments,total);});
  });
}

// ══════════════════════════════════════════════════
// 20. RENDER PEDIDOS
// ══════════════════════════════════════════════════
function renderPedWeek() {
  const wrap=g('ped-week'); if(!wrap)return;
  const today=new Date();today.setHours(0,0,0,0);
  if(!S.pedFecha)S.pedFecha=today.toISOString().split('T')[0];
  const mon=new Date(today);mon.setDate(today.getDate()-(today.getDay()||7)+1);
  const days=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
  const DIAS=['L','M','X','J','V','S','D'];
  const sel=S.pedFecha;
  wrap.innerHTML=days.map((d,i)=>{
    const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const isToday=d.getTime()===today.getTime(),isSel=ds===sel;
    const nDia=S.pedidos.filter(p=>p.fecha===ds&&!p.archivado).length;
    return `<div class="ped-day rpl${isToday&&!isSel?' today':''}${isSel?' sel':''}" data-fecha="${ds}">
      <span class="ped-day-lbl">${DIAS[i]}</span>
      <span class="ped-day-num">${d.getDate()}</span>
      <span class="ped-day-badge${nDia?' on':''}">${nDia||''}</span>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.ped-day').forEach(d=>{
    d.addEventListener('click',()=>{S.pedFecha=d.dataset.fecha;renderPedWeek();renderPeds();renderProduceDia();});
  });
}

function renderPeds() {
  const list=g('ped-list'); if(!list)return;
  const today=hoy();
  let peds=S.pedidos.filter(p=>!p.archivado);
  if(S.pedFecha)peds=peds.filter(p=>p.fecha===S.pedFecha);
  peds=peds.sort((a,b)=>(a.cli||'').localeCompare(b.cli||'','es'));
  const fechaLabel=S.pedFecha?new Date(S.pedFecha+'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'}):'';
  const diff=S.pedFecha?diffDias(S.pedFecha,today):null;
  const cuando=diff===0?'Hoy':diff===1?'Mañana':fechaLabel;
  if(!peds.length){
    list.innerHTML=`<div style="padding:8px 16px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--t4);">${cuando}</div><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Sin pedidos</div><div class="empty-sub">No hay pedidos para este día.</div></div>`;
    renderHistorialPeds(); return;
  }
  list.innerHTML=`<div style="padding:8px 16px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--t4);">${cuando} · ${peds.length} pedido${peds.length>1?'s':''}</div>`+
  peds.map(p=>{
    const diffT=p.fecha?diffDias(p.fecha,today):null;
    const badge=diffT===0?'<span class="ticket-badge hoy">Hoy</span>':diffT===1?'<span class="ticket-badge manana">Mañana</span>':'';
    const prodsHtml=[...(p.items||[])].sort((a,b)=>(a.p||'').localeCompare(b.p||'','es')).map(i=>`
      <div style="display:flex;align-items:baseline;gap:8px;padding:2px 0;">
        <span style="font-size:12px;font-weight:700;color:var(--bosque);min-width:28px;text-align:right;">${i.q}×</span>
        <span style="font-size:13px;color:var(--t1);">${i.p}</span>
      </div>`).join('');
    return `<div class="ticket rpl" data-id="${p._id}" data-a="open" style="cursor:pointer;">
      <div class="ticket-top">
        <div>
          <div class="ticket-cli">${p.cli||'Sin cliente'}</div>
          <div style="font-size:12px;color:var(--t4);margin-top:2px;">${p.fecha?fmt(p.fecha):''}${p.hora?' · '+p.hora:''}</div>
          ${p.notas?`<div style="font-size:11px;color:var(--bosque);margin-top:3px;font-style:italic;">📝 ${p.notas}</div>`:''}
          ${p.empleadoNombre?`<div style="font-size:11px;color:var(--t4);margin-top:2px;">👤 ${p.empleadoNombre}</div>`:''}
        </div>${badge}
      </div>
      <div class="ticket-prods" style="padding:6px 0 8px;">${prodsHtml||'Sin productos'}</div>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-a="open"]').forEach(t=>{t.addEventListener('click',()=>openPedModal(t.dataset.id));});
  renderHistorialPeds();
}

function renderHistorialPeds() {
  const body=g('ped-hist-body'); if(!body)return;
  const archivados=S.pedidos.filter(p=>p.archivado).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).slice(0,30);
  if(!archivados.length){body.innerHTML='<div style="padding:8px 4px;font-size:13px;color:var(--t4);">Sin pedidos entregados aún.</div>';return;}
  body.innerHTML=archivados.map(p=>`
    <div class="ticket archivado" style="margin-bottom:6px;">
      <div class="ticket-top">
        <div>
          <div class="ticket-cli">${p.cli||'Sin cliente'}</div>
          <div style="font-size:12px;color:var(--t4);">${p.fecha?fmt(p.fecha):''}${p.hora?' · '+p.hora:''}</div>
        </div>
        <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:var(--rfull);background:var(--surface2);color:var(--t4);">Entregado</span>
      </div>
      <div class="ticket-prods">${(p.items||[]).map(i=>`${i.q}× ${i.p}`).join(' · ')||'Sin productos'}</div>
      <div style="display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--border2);">
        <button style="flex:1;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r10);padding:7px;font-family:var(--font);font-size:12px;font-weight:600;color:var(--t2);cursor:pointer;text-align:center;" data-id="${p._id}" data-a="reabrir">↩ Reabrir</button>
        <button style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r10);padding:7px 12px;font-family:var(--font);font-size:12px;cursor:pointer;color:var(--red);" data-id="${p._id}" data-a="del">🗑️</button>
      </div>
    </div>`).join('');
  body.querySelectorAll('[data-a]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(btn.dataset.a==='reabrir') reabrirPed(btn.dataset.id);
      else if(btn.dataset.a==='del'&&confirm('¿Eliminar?')) delPed(btn.dataset.id);
    });
  });
}

function renderProduceDia() {
  const wrap=g('ped-produce'); if(!wrap)return;
  if(!S.pedFecha){wrap.style.display='none';wrap.innerHTML='';return;}
  const activos=S.pedidos.filter(p=>!p.archivado&&p.fecha===S.pedFecha);
  if(!activos.length){wrap.style.display='none';wrap.innerHTML='';return;}
  const tots={};
  activos.forEach(p=>(p.items||[]).forEach(i=>{tots[i.p]=(tots[i.p]||0)+i.q;}));
  const diff=diffDias(S.pedFecha,hoy());
  const cuando=diff===0?'Hoy':diff===1?'Mañana':fmt(S.pedFecha);
  wrap.style.display='block';
  wrap.innerHTML=`<div class="card" style="margin:0 0 8px;">
    <div style="padding:12px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--t4);">Producción · ${cuando}</div>
        <div style="font-size:11px;color:var(--t3);">${activos.length} pedido${activos.length>1?'s':''}</div>
      </div>
      ${Object.entries(tots).sort((a,b)=>a[0].localeCompare(b[0],'es')).map(([n,q])=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border2);">
          <span style="font-size:13px;color:var(--t1);">${n}</span>
          <strong style="font-size:16px;color:var(--bosque);">${q}</strong>
        </div>`).join('')}
    </div>
  </div>`;
}

// Modal de pedido expandido
function openPedModal(id) {
  const p=S.pedidos.find(p=>p._id===id); if(!p)return;
  const today=hoy(),diff=p.fecha?diffDias(p.fecha,today):null;
  const cuando=diff===0?'Hoy':diff===1?'Mañana':diff!=null&&diff<0?'Vencido':p.fecha?fmt(p.fecha):'Sin fecha';
  const modal=g('ped-modal'); if(!modal)return;
  modal.innerHTML=`
    <div style="padding:20px 20px 12px;display:flex;align-items:flex-start;justify-content:space-between;">
      <div><div style="font-size:20px;font-weight:700;color:var(--t1);">${p.cli||'Sin cliente'}</div>
           <div style="font-size:12px;color:var(--t3);margin-top:3px;">${cuando}${p.hora?' · '+p.hora:''}${p.empleadoNombre?' · 👤 '+p.empleadoNombre:''}</div></div>
      <button style="background:var(--surface2);border:none;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;" id="ped-modal-close-btn">
        <span class="material-icons-round" style="font-size:20px;color:var(--t3)">close</span>
      </button>
    </div>
    ${(p.items||[]).length?`<div style="padding:0 20px 16px;">
      ${(p.items||[]).sort((a,b)=>a.p.localeCompare(b.p,'es')).map(i=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border2);">
          <span style="font-size:14px;font-weight:500;color:var(--t1);">${i.p}</span>
          <span style="font-size:16px;font-weight:700;color:var(--bosque);">${i.q}×</span>
        </div>`).join('')}
    </div>`:''}
    ${p.notas?`<div style="margin:0 20px 16px;background:var(--surface2);border-radius:var(--r10);padding:10px 14px;font-size:13px;color:var(--t3);">📝 ${p.notas}</div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:12px 20px 24px;border-top:1px solid var(--border2);">
      <button style="display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--surface2);border:none;border-radius:var(--r12);padding:12px 8px;cursor:pointer;" data-id="${p._id}" data-a="edit">
        <span class="material-icons-round" style="font-size:22px;color:var(--bosque)">edit</span>
        <span style="font-size:11px;font-weight:600;color:var(--bosque)">Editar</span>
      </button>
      <button style="display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--surface2);border:none;border-radius:var(--r12);padding:12px 8px;cursor:pointer;" data-id="${p._id}" data-a="arch">
        <span class="material-icons-round" style="font-size:22px;color:var(--teal)">check_circle</span>
        <span style="font-size:11px;font-weight:600;color:var(--teal)">Entregado</span>
      </button>
      <button style="display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--surface2);border:none;border-radius:var(--r12);padding:12px 8px;cursor:pointer;" data-id="${p._id}" data-a="del">
        <span class="material-icons-round" style="font-size:22px;color:var(--red)">delete_outline</span>
        <span style="font-size:11px;font-weight:600;color:var(--red)">Eliminar</span>
      </button>
    </div>`;
  g('ped-modal-overlay').classList.add('on'); modal.classList.add('on');
  g('ped-modal-close-btn').addEventListener('click',closePedModal);
  modal.querySelectorAll('[data-a]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const bid=btn.dataset.id; closePedModal();
      if(btn.dataset.a==='edit')     setTimeout(()=>editPed(bid),200);
      else if(btn.dataset.a==='arch') archivarPed(bid);
      else if(btn.dataset.a==='del'&&confirm('¿Eliminar pedido?')) delPed(bid);
    });
  });
}
function closePedModal(){g('ped-modal-overlay').classList.remove('on');g('ped-modal').classList.remove('on');}

// Producción semanal
let pedSemanaOffset=0;
function renderProdSemanaModal(){
  const today=new Date();today.setHours(0,0,0,0);
  const mon=new Date(today);mon.setDate(today.getDate()-(today.getDay()||7)+1+(pedSemanaOffset*7));
  const sun=new Date(mon);sun.setDate(mon.getDate()+6);
  const activos=S.pedidos.filter(p=>{if(p.archivado||!p.fecha)return false;const fd=new Date(p.fecha+'T00:00:00');return fd>=mon&&fd<=sun;});
  const tots={};activos.forEach(p=>(p.items||[]).forEach(i=>{tots[i.p]=(tots[i.p]||0)+i.q;}));
  const sorted=Object.entries(tots).sort((a,b)=>a[0].localeCompare(b[0],'es'));
  const semLbl=`${mon.toLocaleDateString('es-AR',{day:'numeric',month:'short'})} – ${sun.toLocaleDateString('es-AR',{day:'numeric',month:'short'})}`;
  const sub=g('prod-modal-subtitle');if(sub)sub.textContent=`${semLbl} · ${activos.length} pedido${activos.length!==1?'s':''}`;
  const body=g('prod-modal-body');if(!body)return;
  body.innerHTML=!sorted.length
    ?`<div class="prod-modal-empty">Sin pedidos esta semana</div>`
    :sorted.map(([n,q])=>`<div class="prod-modal-row"><span class="prod-modal-prod">${n}</span><span class="prod-modal-qty">${q}</span></div>`).join('');
}
function openProdSemanaModal(){pedSemanaOffset=0;g('prod-modal-overlay').classList.add('on');g('prod-modal').classList.add('on');renderProdSemanaModal();}
function closeProdModal(){g('prod-modal-overlay').classList.remove('on');g('prod-modal').classList.remove('on');}

// Calendario mes pedidos
let pedCalMes=false,pedMesOffset=0;

// ══════════════════════════════════════════════════
// 21. RENDER AGENDA
// ══════════════════════════════════════════════════
let ageMesOffset=0;
function renderAgeCalGoogle(){
  const diasLbl=g('age-cal-dias'),grid=g('age-cal-grid'),lbl=g('age-mes-lbl');
  if(!grid)return;
  const hoyD=new Date();hoyD.setHours(0,0,0,0);
  const base=new Date(hoyD.getFullYear(),hoyD.getMonth()+ageMesOffset,1);
  const mes=base.getMonth(),anio=base.getFullYear();
  if(lbl)lbl.textContent=base.toLocaleDateString('es-AR',{month:'long',year:'numeric'}).replace(/^\w/,c=>c.toUpperCase());
  const DIAS=['L','M','X','J','V','S','D'];
  if(diasLbl)diasLbl.innerHTML=DIAS.map(d=>`<div class="age-cal-lbl">${d}</div>`).join('');
  const primerDia=new Date(anio,mes,1).getDay()||7;
  const diasMes=new Date(anio,mes+1,0).getDate();
  const selFecha=S.ageFecha;
  let cells='';
  const diasAntes=primerDia-1;
  const mesPrevDias=new Date(anio,mes,0).getDate();
  for(let i=diasAntes;i>0;i--){const d=mesPrevDias-i+1;const prevM=mes===0?12:mes;const prevA=mes===0?anio-1:anio;const ds=`${prevA}-${String(prevM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;cells+=`<div class="age-cal-cell otro-mes" data-fecha="${ds}"><div class="age-cal-num">${d}</div></div>`;}
  for(let d=1;d<=diasMes;d++){
    const ds=`${anio}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isHoy=new Date(anio,mes,d).getTime()===hoyD.getTime(),isSel=ds===selFecha;
    const evsDia=S.eventos.filter(e=>e.fecha===ds).sort((a,b)=>(a.hora||'').localeCompare(b.hora||''));
    const chips=evsDia.slice(0,2).map(e=>`<span class="age-cal-chip${e.prio==='urgente'?' urgente':''}">${(e.tit||'').substring(0,12)}</span>`).join('');
    const masChip=evsDia.length>2?`<span class="age-cal-chip mas">+${evsDia.length-2}</span>`:'';
    cells+=`<div class="age-cal-cell${isHoy?' hoy':''}${isSel?' sel':''}" data-fecha="${ds}"><div class="age-cal-num">${d}</div>${chips}${masChip}</div>`;
  }
  const totalCells=diasAntes+diasMes,filas=Math.ceil(totalCells/7),target=filas*7;
  for(let d=1;d<=target-totalCells;d++){const sigM=mes===11?1:mes+2;const sigA=mes===11?anio+1:anio;const ds=`${sigA}-${String(sigM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;cells+=`<div class="age-cal-cell otro-mes" data-fecha="${ds}"><div class="age-cal-num">${d}</div></div>`;}
  grid.innerHTML=cells;
  grid.querySelectorAll('.age-cal-cell[data-fecha]').forEach(el=>{
    el.addEventListener('click',()=>{S.ageFecha=el.dataset.fecha;renderAgeCalGoogle();renderEvs();setTimeout(()=>g('evs-list')?.scrollIntoView({behavior:'smooth',block:'start'}),100);});
  });
}

function renderEvs(){
  const list=g('evs-list');if(!list)return;
  const today=hoy();
  let evs=[...S.eventos];
  if(S.ageFecha)evs=evs.filter(e=>e.fecha===S.ageFecha);
  else evs=evs.filter(e=>e.fecha>=today).slice(0,5);
  evs.sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
  if(!evs.length){list.innerHTML=`<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Sin eventos</div><div class="empty-sub">Tocá + para agregar un evento.</div></div>`;return;}
  list.innerHTML=`<div class="mov-list">${evs.map(e=>{
    const diff=e.fecha?diffDias(e.fecha,today):null;
    const cuando=diff===0?'Hoy':diff===1?'Mañana':diff!=null&&diff<0?'Vencido':diff!=null?`En ${diff} días`:fmt(e.fecha);
    const descHtml = e.desc ? `<div style="font-size:12px;color:var(--t3);margin-top:6px;padding:8px 10px;background:var(--surface2);border-radius:var(--r10);">📝 ${e.desc}</div>` : '';
    const clienteHtml = e.cliente ? `<div style="font-size:12px;color:var(--t3);margin-top:4px;">👤 ${e.cliente}</div>` : '';
    return `<div class="card ev-card" data-id="${e._id}" data-expanded="0" style="cursor:pointer;">
      <div class="card-row" style="pointer-events:none;">
        <div class="card-icon" style="background:var(--amber-bg)"><span class="material-icons-round" style="color:var(--amber)">event</span></div>
        <div class="card-info">
          <div class="card-title">${e.tit}${e.prio==='urgente'?' 🔴':''}</div>
          <div class="card-sub">${e.hora?e.hora+' · ':''}${e.cliente||''}</div>
        </div>
        <div class="card-right">
          <div class="card-date" style="font-weight:600;color:var(--amber)">${cuando}</div>
          <span class="material-icons-round" style="font-size:16px;color:var(--t4);margin-top:4px;">expand_more</span>
        </div>
      </div>
      <div class="ev-detail" style="display:none;padding:0 12px 4px;">
        ${clienteHtml}${descHtml}
      </div>
      <div class="card-actions ev-actions" style="display:none;">
        <button class="card-action edit rpl" data-id="${e._id}" data-a="edit"><span class="material-icons-round">edit</span>Editar</button>
        <button class="card-action del  rpl" data-id="${e._id}" data-a="del" ><span class="material-icons-round">delete_outline</span>Eliminar</button>
      </div>
    </div>`;
  }).join('')}</div>`;
  // Click en card = expandir/colapsar
  list.querySelectorAll('.ev-card').forEach(card=>{
    card.addEventListener('click', e=>{
      if(e.target.closest('[data-a]')) return; // no colapsar si tocó un botón
      const open = card.dataset.expanded==='1';
      // Colapsar todos
      list.querySelectorAll('.ev-card').forEach(c=>{
        c.dataset.expanded='0';
        c.querySelector('.ev-detail').style.display='none';
        c.querySelector('.ev-actions').style.display='none';
        c.querySelector('.material-icons-round[style*="expand"]').textContent='expand_more';
      });
      if(!open){
        card.dataset.expanded='1';
        card.querySelector('.ev-detail').style.display='block';
        card.querySelector('.ev-actions').style.display='flex';
        card.querySelector('.material-icons-round[style*="expand"]').textContent='expand_less';
      }
    });
  });
  list.querySelectorAll('[data-a]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      if(btn.dataset.a==='edit')editEv(btn.dataset.id);
      else if(btn.dataset.a==='del'&&confirm('¿Eliminar evento?'))delEv(btn.dataset.id);
    });
  });
}

// ══════════════════════════════════════════════════
// 22. RENDER TAREAS
// ══════════════════════════════════════════════════
let taskMesOffset=0;
function renderTasks(){
  const list=g('tasks-list');if(!list)return;
  const today=hoy();
  const pend=S.tareas.filter(t=>!t.done).sort((a,b)=>(a.fecha||'z').localeCompare(b.fecha||'z'));
  const hechas=S.tareas.filter(t=>t.done).slice(0,5);
  if(!pend.length&&!hechas.length){list.innerHTML=`<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Sin tareas</div><div class="empty-sub">Todo al día.</div></div>`;return;}
  const th=t=>{
    const diff=t.fecha?diffDias(t.fecha,today):null;
    const vence=diff===0?'Vence hoy':diff===1?'Mañana':diff!=null&&diff<0?'Vencida':diff!=null?`En ${diff} días`:'';
    return `<div class="task-item">
      <div class="task-check rpl${t.done?' done':''}" data-id="${t._id}" data-a="toggle"></div>
      <div class="task-body">
        <div class="task-title${t.done?' done':''}">${t.tit}${t.prio==='urgente'?'<span class="task-prio">🔴</span>':''}</div>
        ${vence?`<div class="task-meta">${vence}</div>`:''}
      </div>
      <button class="rpl" data-id="${t._id}" data-a="edit" style="background:transparent;border:none;cursor:pointer;color:var(--t4);padding:4px;display:flex;"><span class="material-icons-round" style="font-size:18px">edit</span></button>
      <button class="rpl" data-id="${t._id}" data-a="del"  style="background:transparent;border:none;cursor:pointer;color:var(--t5);padding:4px;display:flex;"><span class="material-icons-round" style="font-size:18px">close</span></button>
    </div>`;
  };
  list.innerHTML=pend.map(th).join('')+(hechas.length?`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--t4);padding:12px 4px 6px;">Completadas</div>${hechas.map(th).join('')}`:'');
  list.querySelectorAll('[data-a]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=btn.dataset.id;
      if(btn.dataset.a==='toggle')toggleTask(id);
      else if(btn.dataset.a==='edit')editTask(id);
      else delTask(id);
    });
  });
}

function renderCalMes(prefix,_offsetKey,fechaKey,_getItems,getDot){
  if(prefix==='age'){renderAgeCalGoogle();return;}
  const grid=g(prefix+'-mes-grid'),lbl=g(prefix+'-mes-lbl');if(!grid)return;
  const hoyD=new Date();hoyD.setHours(0,0,0,0);
  const offset=prefix==='task'?taskMesOffset:pedMesOffset||0;
  const base=new Date(hoyD.getFullYear(),hoyD.getMonth()+offset,1);
  const mes=base.getMonth(),anio=base.getFullYear();
  if(lbl)lbl.textContent=base.toLocaleDateString('es-AR',{month:'long',year:'numeric'}).replace(/^\w/,c=>c.toUpperCase());
  const primerDia=new Date(anio,mes,1).getDay()||7;
  const diasMes=new Date(anio,mes+1,0).getDate();
  const DIAS=['L','M','X','J','V','S','D'];
  let html=DIAS.map(d=>`<div class="cal-mes-dia-lbl">${d}</div>`).join('');
  for(let i=1;i<primerDia;i++)html+=`<div class="cal-mes-dia otro-mes"><span class="cal-mes-num"></span></div>`;
  const selFecha=S[fechaKey];
  for(let d=1;d<=diasMes;d++){
    const ds=`${anio}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=new Date(anio,mes,d).getTime()===hoyD.getTime();
    const isSel=ds===selFecha;
    const hasDot=getDot?getDot(ds):false;
    html+=`<div class="cal-mes-dia${isSel?' sel':''}" data-fecha="${ds}">
      <span class="cal-mes-num${isToday?' today':''}">${d}</span>
      ${hasDot?'<span class="cal-mes-dot"></span>':''}
    </div>`;
  }
  grid.innerHTML=html;
  grid.querySelectorAll('.cal-mes-dia[data-fecha]').forEach(el=>{
    el.addEventListener('click',()=>{
      S[fechaKey]=el.dataset.fecha;
      renderCalMes(prefix,_offsetKey,fechaKey,_getItems,getDot);
      if(prefix==='task'){renderTasks();}
      else if(prefix==='ped'){renderPeds();renderProduceDia();}
    });
  });
}

// ══════════════════════════════════════════════════
// 23. RENDER PANEL USUARIO
// ══════════════════════════════════════════════════
function renderUserPanel(){
  const p=S.perfil||{};const user=auth.currentUser;
  const av=g('user-av-big');
  if(av){if(user?.photoURL)av.innerHTML=`<img src="${user.photoURL}" alt="">`;else av.textContent=(S.nombre?.[0]||'?').toUpperCase();}
  if(g('user-hero-name'))g('user-hero-name').textContent=S.nombre||'—';
  if(g('user-hero-email'))g('user-hero-email').textContent=user?.email||'—';
  const campos={negocio:p.negocio||S.negocio||'—',rubro:p.rubro||'—',desc:p.descripcion||'—',direccion:p.direccion||'—',wsp:p.wsp||'—',ig:p.instagram||'—',web:p.web||'—',pais:p.pais||'Uruguay',moneda:p.moneda||'UYU $',tz:p.tz||'América/Montevideo',email:user?.email||'—',desde:p.creadoEn?new Date(p.creadoEn).toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'}):'—'};
  Object.entries(campos).forEach(([k,v])=>{const el=g('uf-'+k);if(el)el.textContent=v;});
}

function editUserField(field){
  const p=S.perfil||{};
  const LABELS={negocio:'Nombre del negocio',rubro:'Rubro',desc:'Descripción',direccion:'Dirección',wsp:'WhatsApp',ig:'Instagram',web:'Sitio web',pais:'País',moneda:'Moneda',tz:'Zona horaria'};
  const MAP={negocio:p.negocio,rubro:p.rubro,desc:p.descripcion,direccion:p.direccion,wsp:p.wsp,ig:p.instagram,web:p.web,pais:p.pais,moneda:p.moneda,tz:p.tz};
  openEdit(`Editar ${LABELS[field]||field}`,`
    <div class="m3-field"><input class="m3-inp" id="uf-edit-inp" value="${(MAP[field]||'').replace(/"/g,'&quot;')}" placeholder=" " type="text"><label class="m3-lbl">${LABELS[field]||field}</label></div>
    <button class="btn-save rpl" id="uf-edit-save">Guardar</button>`);
  setTimeout(()=>g('uf-edit-inp')?.select(),200);
  g('uf-edit-save').addEventListener('click',async()=>{
    const val=g('uf-edit-inp')?.value.trim()||'';
    const KEY_MAP={negocio:'negocio',rubro:'rubro',desc:'descripcion',direccion:'direccion',wsp:'wsp',ig:'instagram',web:'web',pais:'pais',moneda:'moneda',tz:'tz'};
    const key=KEY_MAP[field];
    if(!S.perfil)S.perfil={};
    S.perfil[key]=val;
    if(field==='negocio'){S.negocio=val;renderDirectorioGrid();}
    try{await setDoc(doc(db,`usuarios/${S.uid}/perfil/datos`),S.perfil,{merge:true});closeEdit();renderUserPanel();if(field==='negocio'&&g('hd-negocio'))g('hd-negocio').textContent=val;toast('✅ Guardado');}
    catch(e){console.error(e);toast('Error al guardar');}
  });
}

async function deleteAccount(){
  if(!confirm('¿Estás seguro de que querés eliminar tu cuenta?\n\nSe borrarán TODOS tus datos. Esta acción es IRREVERSIBLE.'))return;
  if(prompt('Para confirmar, escribí exactamente: ELIMINAR')!=='ELIMINAR'){toast('Cancelado');return;}
  try{
    const colecciones=['movimientos','pedidos','eventos','tareas','notas','perfil','directorio'];
    for(const c of colecciones){const snap=await getDocs(collection(db,`usuarios/${S.uid}/${c}`));for(const d of snap.docs){try{await deleteDoc(d.ref);}catch(e){}}}
    const user=auth.currentUser; if(user)await user.delete();
    toast('Cuenta eliminada.');
    setTimeout(()=>{g('app').classList.remove('on');g('login').classList.add('on');},1500);
  }catch(e){
    if(e.code==='auth/requires-recent-login')toast('Por seguridad, cerrá sesión, volvé a iniciar y repetí el proceso.');
    else toast('Error al eliminar. Intentá de nuevo.');
  }
}

// ══════════════════════════════════════════════════
// 24. NOTAS POST-IT
// ══════════════════════════════════════════════════
function renderNotas(){
  const grid=g('notas-grid');if(!grid)return;
  const notas=S.notas||[];
  if(!notas.length){grid.innerHTML='<div style="font-size:13px;color:var(--t4);padding:4px 0;">Sin notas. Tocá + para agregar.</div>';return;}
  grid.innerHTML=notas.map(n=>`
    <div class="postit" data-id="${n.id}">
      <textarea class="postit-text" data-id="${n.id}" rows="2">${n.texto||''}</textarea>
      <div class="postit-footer">
        <span class="postit-date">${n.fecha?new Date(n.fecha).toLocaleDateString('es-AR',{day:'numeric',month:'short'}):''}</span>
        <button class="postit-del rpl" data-id="${n.id}"><span class="material-icons-round" style="font-size:18px">delete_outline</span></button>
      </div>
    </div>`).join('');
  grid.querySelectorAll('.postit-text').forEach(ta=>{
    let timer=null;
    ta.addEventListener('input',()=>{
      const n=S.notas.find(n=>n.id===ta.dataset.id);if(n)n.texto=ta.value;
      clearTimeout(timer);timer=setTimeout(()=>saveNotas(),1200);
    });
  });
  grid.querySelectorAll('.postit-del').forEach(btn=>{
    btn.addEventListener('click',()=>{S.notas=S.notas.filter(n=>n.id!==btn.dataset.id);renderNotas();saveNotas();});
  });
}

async function saveNotas(){
  if(!S.uid)return;
  try{await setDoc(doc(db,`usuarios/${S.uid}/notas/nota`),{notas:S.notas||[],texto:''});}catch(e){}
}

function addNota(){
  if(!S.notas)S.notas=[];
  S.notas.unshift({id:'n'+Date.now(),texto:'',fecha:new Date().toISOString()});
  renderNotas();saveNotas();
  setTimeout(()=>g('notas-grid')?.querySelector('.postit-text')?.focus(),100);
}

// ══════════════════════════════════════════════════
// 25. OTTO IA
// ══════════════════════════════════════════════════
let chatHistory=[];

// ── Chat OTTO persistido en Firestore ─────────────
// Guarda el historial del chat en usuarios/{uid}/chat/historial
// con una ventana deslizante de 7 días
async function _guardarChat() {
  if (!S.uid || !chatHistory.length) return;
  try {
    const ahora = new Date().toISOString();
    // Limpiar mensajes más viejos de 7 días
    const limite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const mensajes = chatHistory.map((m, i) => ({
      ...m,
      ts: m.ts || ahora,
    })).filter(m => !m.ts || m.ts >= limite);
    await setDoc(
      doc(db, `usuarios/${S.uid}/chat/historial`),
      { mensajes, actualizadoEn: ahora },
      { merge: false }
    );
  } catch(e) { console.warn('[Chat] guardar:', e.message); }
}

async function _cargarChat() {
  if (!S.uid) return;
  try {
    const snap = await getDocs(col('chat'));
    if (!snap.empty) {
      const data = snap.docs[0].data();
      const limite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      chatHistory = (data.mensajes || []).filter(m => !m.ts || m.ts >= limite);
      // Renderizar historial si hay mensajes
      if (chatHistory.length) {
        _renderChatHistory();
      }
    }
  } catch(e) { console.warn('[Chat] cargar:', e.message); }
}

function _renderChatHistory() {
  const box = g('chat-msgs'); if (!box) return;
  box.innerHTML = chatHistory.map(m =>
    m.role === 'user'
      ? `<div class="otto-msg me"><div class="otto-msg-av">${S.nombre?.[0]?.toUpperCase()||'U'}</div><div class="otto-msg-bub me">${m.content}</div></div>`
      : `<div class="otto-msg"><div class="otto-msg-av">O</div><div class="otto-msg-bub">${m.content}</div></div>`
  ).join('');
  setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
}

function buildOttoContext(){
  const hoyStr = hoy();
  const _dn = new Date();
  const mes      = `${_dn.getFullYear()}-${String(_dn.getMonth()+1).padStart(2,'0')}`;
  const mesPrev  = (() => { const d=new Date(_dn.getFullYear(),_dn.getMonth()-1,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
  const mes3atras= (() => { const d=new Date(_dn.getFullYear(),_dn.getMonth()-3,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();

  const allMovs   = S.movs || [];
  const movsMes   = allMovs.filter(m => m.fecha?.startsWith(mes));
  const movsPrev  = allMovs.filter(m => m.fecha?.startsWith(mesPrev));
  const movs3m    = allMovs.filter(m => m.fecha >= mes3atras+'-01');

  const ing     = movsMes.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
  const gas     = movsMes.filter(m=>m.tipo==='gasto')  .reduce((s,m)=>s+m.monto,0);
  const ingPrev = movsPrev.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
  const gasPrev = movsPrev.filter(m=>m.tipo==='gasto')  .reduce((s,m)=>s+m.monto,0);

  const movDetalleMes = movsMes
    .sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''))
    .map(m=>`${m.fecha} ${m.tipo==='ingreso'?'INGRESO':'GASTO'} ${fmtARS(m.monto)} cat:"${m.cat||'Sin cat'}"${m.desc?' nota:"'+m.desc+'"':''}`)
    .join('\n');

  const movDetalle3m = movs3m
    .sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''))
    .map(m=>`${m.fecha} ${m.tipo==='ingreso'?'+':'-'}${fmtARS(m.monto)} [${m.cat||'?'}]${m.desc?' "'+m.desc+'"':''}`)
    .join(' | ');

  const catGastos={};
  movsMes.filter(m=>m.tipo==='gasto').forEach(m=>{ catGastos[m.cat||'?']=(catGastos[m.cat||'?']||0)+m.monto; });
  const resumenCatGastos=Object.entries(catGastos).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`${c}: ${fmtARS(v)}`).join(' | ');

  const catIngresos={};
  movsMes.filter(m=>m.tipo==='ingreso').forEach(m=>{ catIngresos[m.cat||'?']=(catIngresos[m.cat||'?']||0)+m.monto; });
  const resumenCatIngresos=Object.entries(catIngresos).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`${c}: ${fmtARS(v)}`).join(' | ');

  const pedActivos   = S.pedidos.filter(p=>!p.archivado);
  const pedArchivados= S.pedidos.filter(p=>p.archivado);

  const pedDetalleActivos = pedActivos
    .sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''))
    .map(p=>`${p.fecha}${p.hora?' '+p.hora:''} cliente:"${p.cli||'?'}"${p.notas?' nota:"'+p.notas+'"':''} items:[${(p.items||[]).map(i=>`${i.q}x${i.p}`).join(',')}]`)
    .join('\n');

  const pedDetalleArchivados = pedArchivados
    .sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''))
    .slice(0,30)
    .map(p=>`${p.fecha} "${p.cli||'?'}" [${(p.items||[]).map(i=>`${i.q}x${i.p}`).join(',')}]`)
    .join(' | ');

  const cliCount={};
  S.pedidos.forEach(p=>{ if(p.cli) cliCount[p.cli]=(cliCount[p.cli]||0)+1; });
  const topClis=Object.entries(cliCount).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,c])=>`${n}(${c})`).join(', ');

  const prodCount={};
  S.pedidos.forEach(p=>(p.items||[]).forEach(i=>{ prodCount[i.p]=(prodCount[i.p]||0)+i.q; }));
  const topProds=Object.entries(prodCount).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,c])=>`${n}(${c}u)`).join(', ');

  const evsProximos=S.eventos.filter(e=>e.fecha>=hoyStr)
    .sort((a,b)=>a.fecha.localeCompare(b.fecha))
    .map(e=>`${e.fecha}${e.hora?' '+e.hora:''} "${e.tit}"${e.cliente?' cliente:'+e.cliente:''}${e.prio==='urgente'?' URGENTE':''}${e.desc?' nota:"'+e.desc+'"':''}`)
    .join('\n');

  const evsPasados=S.eventos.filter(e=>e.fecha<hoyStr)
    .sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,15)
    .map(e=>`${e.fecha} "${e.tit}"${e.cliente?' ('+e.cliente+')':''}`)
    .join(' | ');

  const tareasPend=S.tareas.filter(t=>!t.done)
    .sort((a,b)=>(a.fecha||'z').localeCompare(b.fecha||'z'))
    .map(t=>`${t.prio==='urgente'?'URGENTE ':''}${t.tit}${t.fecha?' (para '+t.fecha+')':''}${t.desc?' "'+t.desc+'"':''}`)
    .join('\n');

  const tareasHechas=S.tareas.filter(t=>t.done).slice(0,10).map(t=>t.tit).join(', ');

  const dirCompleto=getCatsPrincipales().map(cat=>{
    const items=dirGetByCat(cat._id);
    if(!items.length) return `${cat.nombre}: vacía`;
    const detalle=items.map(e=>{
      const meta=[e.metadata?.telefono,e.metadata?.email,e.metadata?.nota].filter(Boolean).join(', ');
      return `"${e.nombre}"${meta?' ('+meta+')':''}`;
    }).join(', ');
    return `${cat.nombre} (${items.length}): ${detalle}`;
  }).join('\n');

  const notasCompletas=(S.notas||[]).filter(n=>n.texto?.trim())
    .map(n=>`[${n.fecha?new Date(n.fecha).toLocaleDateString('es-AR',{day:'numeric',month:'short'}):'?'}] ${n.texto}`)
    .join('\n');

  return `=== PERFIL DEL NEGOCIO ===
Nombre: ${S.perfil?.negocio||S.negocio||'—'}
Rubro: ${S.perfil?.rubro||'—'} | País: ${S.perfil?.pais||'Uruguay'} | Moneda: ${S.perfil?.moneda||'UYU $'}
Dueño: ${S.nombre||'—'} | Descripción: ${S.perfil?.descripcion||'—'}
Fecha hoy: ${new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}

=== FINANZAS MES ACTUAL (${mes}) ===
Ingresos: ${fmtARS(ing)} | Gastos: ${fmtARS(gas)} | Balance: ${ing-gas>=0?'+':''}${fmtARS(ing-gas)}
Mes anterior: Ingresos ${fmtARS(ingPrev)} | Gastos ${fmtARS(gasPrev)} | Balance: ${ingPrev-gasPrev>=0?'+':''}${fmtARS(ingPrev-gasPrev)}
Por categoría ingresos: ${resumenCatIngresos||'ninguna'}
Por categoría gastos: ${resumenCatGastos||'ninguna'}
Detalle día a día:
${movDetalleMes||'ninguno'}

=== HISTORIAL ÚLTIMOS 3 MESES ===
${movDetalle3m||'ninguno'}

=== PEDIDOS ACTIVOS (${pedActivos.length}) ===
${pedDetalleActivos||'ninguno'}

=== PEDIDOS ENTREGADOS (últimos 30) ===
${pedDetalleArchivados||'ninguno'}
Top clientes: ${topClis||'—'}
Top productos: ${topProds||'—'}

=== AGENDA PRÓXIMA (${S.eventos.filter(e=>e.fecha>=hoyStr).length} eventos) ===
${evsProximos||'ninguno'}
Eventos pasados recientes: ${evsPasados||'ninguno'}

=== TAREAS ===
Pendientes (${S.tareas.filter(t=>!t.done).length}):
${tareasPend||'ninguna'}
Completadas recientemente: ${tareasHechas||'ninguna'}

=== DIRECTORIO COMPLETO ===
${dirCompleto||'vacío'}

=== NOTAS ===
${notasCompletas||'sin notas'}`;
}

async function getOttoInsights(){
  if(S.ottoCache.length&&Date.now()-S.ottoCacheTime<300000)return S.ottoCache;
  if(!S.movs.length&&!S.pedidos.length)return _buildLocalInsights();
  try{
    const ctx=buildOttoContext()+'\n\nGenerá 3 insights breves con emoji sobre este negocio. Rioplatense, máx 2 oraciones. JSON array únicamente.';
    const res=await fetch('/.netlify/functions/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:400,system:'Respondé ÚNICAMENTE con un JSON array de 3 strings.',messages:[{role:'user',content:ctx}]})});
    const data=await res.json();
    const parsed=JSON.parse((data.content?.[0]?.text||'[]').replace(/```json|```/g,'').trim());
    if(Array.isArray(parsed)&&parsed.length){S.ottoCache=parsed;S.ottoCacheTime=Date.now();return parsed;}
  }catch(e){console.warn('OTTO:',e.message);}
  return _buildLocalInsights();
}

function _buildLocalInsights(){
  const mes=new Date().toISOString().slice(0,7);
  const ing=S.movs.filter(m=>m.tipo==='ingreso'&&m.fecha?.startsWith(mes)).reduce((s,m)=>s+m.monto,0);
  const gas=S.movs.filter(m=>m.tipo==='gasto'&&m.fecha?.startsWith(mes)).reduce((s,m)=>s+m.monto,0);
  const activos=S.pedidos.filter(p=>!p.archivado).length;
  const pend=S.tareas.filter(t=>!t.done).length;
  return [
    ing>0?`💰 Este mes facturaste ${fmtARS(ing)} en ingresos. ${ing-gas>0?'¡Estás en positivo!':'Revisá tus gastos para mejorar el margen.'}`:`💡 Todavía no registraste ingresos este mes. Empezá anotando tu primera venta.`,
    activos>0?`📋 Tenés ${activos} pedido${activos>1?'s':''} activo${activos>1?'s':''}. ${activos>3?'Buena carga de trabajo, organizate bien.':'Todo tranquilo por ahora.'}`:`📋 Sin pedidos activos. ¿Tenés entregas pendientes sin registrar?`,
    pend>0?`✅ ${pend} tarea${pend>1?'s':''} pendiente${pend>1?'s':''}. Tachalas a medida que avanzás para no perder el hilo.`:`✅ ¡Tareas al día! Buen trabajo manteniendo todo ordenado.`,
  ];
}

async function renderSlider(){
  const el=g('otto-slides');if(!el)return;
  el.innerHTML=`<div class="otto-slide"><div class="otto-slide-lbl"><span class="otto-pulse"></span>OTTO</div><div style="display:flex;align-items:center;gap:8px;color:var(--t4);font-size:13px;"><div class="typing"><span></span><span></span><span></span></div>Analizando…</div></div>`;
  const slides=await getOttoInsights();
  el.innerHTML=slides.map(s=>`<div class="otto-slide"><div class="otto-slide-lbl"><span class="otto-pulse"></span>OTTO dice</div><div class="otto-slide-txt">${s}</div></div>`).join('');
  const dots=g('otto-dots');
  if(dots)dots.innerHTML=slides.map((_,i)=>`<div class="slider-dot${i===0?' on':''}" data-i="${i}"></div>`).join('');
  goSlide(0);
  if(sliderTimer)clearInterval(sliderTimer);
  sliderTimer=setInterval(()=>{sliderIdx=(sliderIdx+1)%slides.length;goSlide(sliderIdx);},5000);
  const wrap=el.parentElement;
  wrap.ontouchstart=e=>{wrap._sx=e.touches[0].clientX;};
  wrap.ontouchend=e=>{const diff=wrap._sx-e.changedTouches[0].clientX;if(Math.abs(diff)>40){const n=slides.length;sliderIdx=diff>0?(sliderIdx+1)%n:(sliderIdx-1+n)%n;goSlide(sliderIdx);}};
  if(dots)dots.querySelectorAll('.slider-dot').forEach(d=>{d.addEventListener('click',()=>goSlide(parseInt(d.dataset.i)));});
}

function goSlide(idx){
  sliderIdx=idx;const el=g('otto-slides');if(el)el.style.transform=`translateX(-${idx*100}%)`;
  document.querySelectorAll('.slider-dot').forEach((d,i)=>d.classList.toggle('on',i===idx));
}

async function sendMsg(){
  const inp=g('chat-inp');if(!inp)return;
  const msg=inp.value.trim();if(!msg)return;
  inp.value='';
  const box=g('chat-msgs');
  box.innerHTML+=`<div class="otto-msg me"><div class="otto-msg-av">${S.nombre?.[0]?.toUpperCase()||'U'}</div><div class="otto-msg-bub me">${msg}</div></div>`;
  const tid='t'+Date.now();
  box.innerHTML+=`<div class="otto-msg" id="${tid}"><div class="otto-msg-av">O</div><div class="otto-msg-bub"><div class="typing"><span></span><span></span><span></span></div></div></div>`;
  box.scrollTop = box.scrollHeight;
  chatHistory.push({role:'user',content:msg, ts:new Date().toISOString()});
  const system=buildOttoContext()+'\n\nRespondé máximo 3 oraciones. Sin markdown. Sin asteriscos.';
  try{
    const res=await fetch('/.netlify/functions/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:500,system,messages:chatHistory.slice(-10).map(({role,content})=>({role,content}))})});
    const data=await res.json();
    const reply=data.content?.[0]?.text||'No pude responder.';
    document.getElementById(tid)?.remove();
    box.innerHTML+=`<div class="otto-msg"><div class="otto-msg-av">O</div><div class="otto-msg-bub">${reply}</div></div>`;
    setTimeout(()=>{ box.scrollTop = box.scrollHeight; }, 50);
    chatHistory.push({role:'assistant',content:reply, ts:new Date().toISOString()});
    if(chatHistory.length>40)chatHistory=chatHistory.slice(-40);
    _guardarChat();
  }catch(e){
    document.getElementById(tid)?.remove();
    box.innerHTML+=`<div class="otto-msg"><div class="otto-msg-av">O</div><div class="otto-msg-bub">No me pude conectar.</div></div>`;
    chatHistory.pop();
  }
}

async function sendQuickMsg(){
  const inp=g('quick-inp');if(!inp)return;
  const msg=inp.value.trim();if(!msg)return;
  inp.value='';
  const box=g('quick-msgs'),qcb=g('quick-chat-box');
  if(qcb)qcb.classList.add('on');
  box.innerHTML+=`<div class="otto-msg me"><div class="otto-msg-av" style="background:var(--surface3);color:var(--t2)">${S.nombre?.[0]?.toUpperCase()||'U'}</div><div class="otto-msg-bub me">${msg}</div></div>`;
  const tid='q'+Date.now();
  box.innerHTML+=`<div class="otto-msg" id="${tid}"><div class="otto-msg-av">O</div><div class="otto-msg-bub"><div class="typing"><span></span><span></span><span></span></div></div></div>`;
  box.scrollTop = box.scrollHeight;
  const system=buildOttoContext()+'\n\nRespondé máximo 2 oraciones. Sin markdown.';
  try{
    const res=await fetch('/.netlify/functions/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:300,system,messages:[{role:'user',content:msg}]})});
    const data=await res.json();
    const reply=data.content?.[0]?.text||'No pude responder.';
    document.getElementById(tid)?.remove();
    box.innerHTML+=`<div class="otto-msg"><div class="otto-msg-av">O</div><div class="otto-msg-bub">${reply}</div></div>`;
    box.scrollTop=99999;
  }catch(e){
    document.getElementById(tid)?.remove();
    box.innerHTML+=`<div class="otto-msg"><div class="otto-msg-av">O</div><div class="otto-msg-bub">No me pude conectar.</div></div>`;
  }
}

function ottoGoChat(pregunta){
  g('otto-home').style.display='none';
  g('otto-chat').classList.add('on');
  g('otto-back-btn').classList.add('on');
  const box=g('chat-msgs');
  if(pregunta){chatHistory=[];if(box)box.innerHTML='';const inp=g('chat-inp');if(inp)inp.value=pregunta;sendMsg();}
  else setTimeout(()=>g('chat-inp')?.focus(),200);
}
function ottoGoHome(){
  g('otto-home').style.display='block';
  g('otto-chat').classList.remove('on');
  g('otto-back-btn').classList.remove('on');
}
function renderOttoStats(){
  const mes=new Date().toISOString().slice(0,7);
  const ventas=S.movs.filter(m=>m.tipo==='ingreso'&&m.fecha?.startsWith(mes)).reduce((s,m)=>s+m.monto,0);
  if(g('os-ventas'))g('os-ventas').textContent=fmtARS(ventas);
  if(g('os-pedidos'))g('os-pedidos').textContent=S.pedidos.filter(p=>!p.archivado).length;
  if(g('os-tareas'))g('os-tareas').textContent=S.tareas.filter(t=>!t.done).length;
  if(g('os-eventos'))g('os-eventos').textContent=S.eventos.filter(e=>e.fecha>=hoy()).length;
  if(g('otto-hola-nombre'))g('otto-hola-nombre').textContent=S.nombre?.split(' ')[0]||'';
}

// ══════════════════════════════════════════════════
// 26. ONBOARDING
// ══════════════════════════════════════════════════
let obRubro='',obEmoji='',obNegocio='';
function showOb(id){document.querySelectorAll('.ob-screen').forEach(s=>s.classList.remove('on'));const s=g(id);if(s)s.classList.add('on');}

async function finishOnboarding(){
  const negocio=g('obNegocio')?.value.trim()||obNegocio||S.nombre||'';
  const LABELS={panaderia:'Panadería',gastronomia:'Gastronomía',servicios:'Servicios',comercio:'Comercio',construccion:'Construcción'};
  const perfil={negocio:negocio||S.nombre,rubro:LABELS[obRubro]||obRubro||'Mi negocio',emoji:obEmoji||'💼',nombre:S.nombre,onboardingDone:true,creadoEn:new Date().toISOString()};
  S.perfil=perfil;S.negocio=negocio||S.nombre;
  try{await setDoc(doc(db,`usuarios/${S.uid}/perfil/datos`),perfil);}catch(e){}
  g('onboarding').classList.remove('on');
  renderDirectorioGrid();
  toast('¡Bienvenido a OTTO! 🚀');
}

// ══════════════════════════════════════════════════
// 27. AUTH
// ══════════════════════════════════════════════════
async function loginGoogle(){try{await signInWithPopup(auth,gProv);}catch(e){console.error(e);toast('Error al iniciar sesión');}}
async function logoutOtto(){try{await signOut(auth);}catch(e){}g('app').classList.remove('on');g('login').classList.add('on');g('loading').style.display='none';}

// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// 28. inicializarOTTO() + onAuthStateChanged
// ══════════════════════════════════════════════════

/**
 * inicializarOTTO(user)
 * ─────────────────────
 * FIX 3: Función de arranque central con orden garantizado.
 *
 * El problema anterior era que fetchDirectorio() (async/onSnapshot)
 * se llamaba pero loadAllData() bloqueaba con await, y el re-render
 * final podía ejecutarse antes o después del primer snapshot del
 * directorio — no había coordinación.
 *
 * Orden correcto:
 *   1. UI básica visible (skeleton)
 *   2. await fetchDirectorio()  ← espera el PRIMER snapshot
 *   3. await Promise.allSettled([loadAllData, perfil, notas])
 *   4. _renderTodo()            ← render completo con TODO disponible
 *   5. Onboarding si corresponde
 *   6. renderSlider() (puede ser lento, no bloquea)
 */
async function inicializarOTTO(user) {
  S.uid    = user.uid;
  S.nombre = user.displayName || user.email.split('@')[0];

  // ── Paso 1: UI básica y mostrar app ──────────────
  if(g('menu-av'))  g('menu-av').textContent   = S.nombre[0].toUpperCase();
  if(g('menu-name'))g('menu-name').textContent = S.nombre;
  if(g('menu-neg')) g('menu-neg').textContent  = '…';
  if(g('home-hola'))g('home-hola').textContent = `Hola, ${S.nombre.split(' ')[0]} 👋`;

  g('loading').style.display = 'none';
  g('login').classList.remove('on');
  g('app').classList.add('on');

  console.log('[OTTO] paso 2: fetchDirectorio...');
  await fetchDirectorio();
  console.log('[OTTO] paso 2b: fetchCategorias...');
  await fetchCategorias();
  console.log('[OTTO] paso 2c: initCategoriasDefault...');
  await initCategoriasDefault();
  console.log('[OTTO] paso 3: loadAllData...');
  await Promise.allSettled([
    loadAllData(),
    _cargarPerfil(),
    _cargarNotas(),
  ]);
  console.log('[OTTO] paso 4: renderTodo...');
  _renderTodo();

  // ── Paso 4b: Chat historial (después del render, DOM listo) ──
  _cargarChat();

  // ── Paso 5: Onboarding si es nuevo usuario ────────
  if (!S.perfil?.onboardingDone)
    setTimeout(() => { g('onboarding').classList.add('on'); showOb('ob0'); }, 400);

  // ── Paso 6: Slider OTTO (no bloquea) ─────────────
  renderSlider();
}

async function _cargarPerfil() {
  try {
    const snap = await getDocs(col('perfil'));
    if (!snap.empty) {
      S.perfil  = snap.docs[0].data();
      S.negocio = S.perfil.negocio || S.nombre;
    }
  } catch(e) { console.warn('perfil:', e.message); }
}

async function _cargarNotas() {
  try {
    const ns = await getDocs(col('notas'));
    if (!ns.empty) {
      const d = ns.docs[0].data();
      S.notas = d.notas || [];
      if (!S.notas.length && d.texto)
        S.notas = [{ id:'n0', texto:d.texto, fecha:new Date().toISOString() }];
    }
  } catch(e) { console.warn('notas:', e.message); }
}

/** Render completo de todas las secciones */
function _renderTodo() {
  const p = S.perfil, neg = p?.negocio || S.negocio || '';
  if (neg) {
    ['hd-negocio','menu-neg','perfil-neg'].forEach(id => {
      const el = g(id); if (el) el.textContent = neg;
    });
    if (g('perfil-rubro'))
      g('perfil-rubro').textContent = (p?.emoji||'💼')+' '+(p?.rubro||'Mi negocio');
    if (g('otto-hola-nombre'))
      g('otto-hola-nombre').textContent = S.nombre.split(' ')[0];
  }
  renderDirectorioGrid();
  renderHomeBal();
  updateBanner();
  renderWeek();
  renderMovsFin();
  renderPedWeek();
  renderPeds();
  renderProduceDia();
  renderEvs();
  renderTasks();
  renderAgeCalGoogle();
  renderCalMes('task', taskMesOffset, 'taskFecha', null,
    ds => S.tareas.some(t => t.fecha===ds && !t.done));
  renderNotas();
  renderOttoStats();
}

// ── Punto de entrada de autenticación ───────────
onAuthStateChanged(auth, async user => {
  if (user) {
    await inicializarOTTO(user);
  } else {
    g('loading').style.display = 'none';
    g('login').classList.add('on');
    // Cancelar listener del directorio al hacer logout
    if (S.dirUnsub) { S.dirUnsub(); S.dirUnsub = null; }
  }
});

// ══════════════════════════════════════════════════
// 29. EVENT LISTENERS
// ══════════════════════════════════════════════════

// Auth
g('btnGoogle')?.addEventListener('click', loginGoogle);
g('menu-logout')?.addEventListener('click', logoutOtto);

// Navegación
g('hd-logo-btn')?.addEventListener('click', () => navTo('home'));
g('nav-home-btn')?.addEventListener('click', () => navTo('home'));
g('nav-otto-btn')?.addEventListener('click', () => navTo('otto'));
document.querySelectorAll('.menu-item[data-nav]').forEach(btn => {
  btn.addEventListener('click', () => navTo(btn.dataset.nav));
});
g('nav-menu-btn')?.addEventListener('click', openMenu);
g('menu-overlay')?.addEventListener('click', closeMenu);

// Home
g('h-fin-btn')?.addEventListener('click', () => navTo('fin'));
g('h-week-btn')?.addEventListener('click', () => {
  S.pedFecha=hoy(); navTo('ped'); renderPedWeek(); renderPeds(); renderProduceDia();
});
g('notas-add-btn')?.addEventListener('click', addNota);

// FAB
g('nav-fab')?.addEventListener('click', toggleFab);
g('fab-overlay')?.addEventListener('click', closeFab);
document.querySelectorAll('.fab-btn[data-sheet]').forEach(btn => {
  btn.addEventListener('click', () => { closeFab(); setTimeout(()=>openSheet(btn.dataset.sheet),60); });
});

// Sheets
g('sheet-overlay')?.addEventListener('click', closeSheet);
['fin','ped','age','task'].forEach(t => g('s-'+t+'-close')?.addEventListener('click', closeSheet));

// Tipo ingreso/gasto
g('pill-ing')?.addEventListener('click', () => setTipo('ingreso'));
g('pill-gas')?.addEventListener('click', () => setTipo('gasto'));
document.querySelectorAll('.quick-amt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.quick-amt').forEach(b=>b.classList.remove('sel'));
    btn.classList.add('sel');
    const mi=g('s-fin-monto');if(mi)mi.value=btn.dataset.val;
  });
});

// Guardar
g('s-fin-save')?.addEventListener('click', saveMov);
g('s-fin-monto')?.addEventListener('keydown', e=>{if(e.key==='Enter')saveMov();});
g('s-ped-save')?.addEventListener('click', savePed);
g('s-age-save')?.addEventListener('click', saveEv);
g('s-task-save')?.addEventListener('click', saveTask);
g('s-task-tit')?.addEventListener('keydown', e=>{if(e.key==='Enter')saveTask();});

// ── PICKERS CONECTADOS AL DIRECTORIO ──
// Los pickers buscan la categoría dinámica por nombre al abrirse
// Así funcionan aunque el usuario renombre sus categorías

function _dpBindDinamico({ triggerId, lblId, hiddenIdId, hiddenNombreId,
                           catNombre, titulo, onSelect }) {
  const trigger = g(triggerId); if (!trigger) return;
  trigger.addEventListener('click', () => {
    // Buscar la categoría dinámica por nombre en tiempo real
    const cat = getCatsPrincipales().find(c =>
      c.nombre.toLowerCase() === catNombre.toLowerCase()
    );
    // Si no existe la categoría aún, catId=null → muestra todo el directorio + botón agregar
    const catId = cat?._id || null;
    dpOpen({
      categoria:  catId,
      titulo:     titulo || `Seleccionar ${catNombre}`,
      selectedId: g(hiddenIdId)?.value || null,
      onSelect: ent => {
        const lbl = g(lblId);
        if (lbl) { lbl.textContent=ent.nombre; lbl.style.color='var(--t1)'; }
        trigger.classList.add('filled');
        if (g(hiddenIdId)) g(hiddenIdId).value = ent._id || ent.id;
        if (hiddenNombreId && g(hiddenNombreId)) g(hiddenNombreId).value = ent.nombre;
        if (onSelect) onSelect(ent);
      },
    });
  });
}

// Picker de cliente en pedido — busca la cat "Clientes" dinámicamente
_dpBindDinamico({
  triggerId: 'ped-cli-trigger', lblId: 'ped-cli-trigger-lbl',
  hiddenIdId: 's-ped-cli-id', hiddenNombreId: 's-ped-cli',
  catNombre: 'Clientes', titulo: 'Seleccionar cliente',
});
// Picker de empleado en pedido
_dpBindDinamico({
  triggerId: 'ped-emp-trigger', lblId: 'ped-emp-trigger-lbl',
  hiddenIdId: 's-ped-emp-id',
  catNombre: 'Empleados', titulo: 'Seleccionar empleado',
});
// Picker de cliente en agenda
_dpBindDinamico({
  triggerId: 'age-cli-trigger', lblId: 'age-cli-trigger-lbl',
  hiddenIdId: 's-age-cli-id', hiddenNombreId: 's-age-cli',
  catNombre: 'Clientes', titulo: 'Cliente (opcional)',
});
// Categoría de finanza (dos niveles con categorías dinámicas)
g('fin-cat-trigger')?.addEventListener('click', openFinCatPicker);
// Productos en pedido
g('ped-prod-trigger')?.addEventListener('click', openPedProdPicker);

// Picker directorio — eventos globales del DOM
g('dp-close')?.addEventListener('click', dpClose);
g('dp-overlay')?.addEventListener('click', dpClose);
g('dp-search')?.addEventListener('input', () => {
  _dpQuery=g('dp-search').value;
  g('dp-search-clear').classList.toggle('on', !!_dpQuery);
  _dpRenderList();
});
g('dp-search')?.addEventListener('keydown', e => {
  if(e.key==='Enter'&&_dpQuery.trim()) _dpOpenCreate(_dpQuery.trim());
});
g('dp-search-clear')?.addEventListener('click', () => {
  g('dp-search').value=''; _dpQuery='';
  g('dp-search-clear').classList.remove('on');
  _dpRenderList(); g('dp-search').focus();
});
g('dp-create-back')?.addEventListener('click', () => {
  g('dp-create-modal').classList.remove('on'); _dpRenderList();
});
g('dp-create-save')?.addEventListener('click', _dpGuardarNuevo);

// Edit sheet
g('edit-overlay')?.addEventListener('click', closeEdit);
g('edit-close')?.addEventListener('click', closeEdit);

// Pedido modal
g('ped-modal-overlay')?.addEventListener('click', closePedModal);

// Producción semanal
g('ped-semana-btn')?.addEventListener('click', openProdSemanaModal);

// ── Compartir pedidos por WhatsApp ───────────────
function compartirPedidosWsp() {
  const fecha   = S.pedFecha;
  const activos = S.pedidos.filter(p => !p.archivado && (!fecha || p.fecha === fecha));

  if (!activos.length) {
    toast('No hay pedidos para compartir');
    return;
  }

  // Formatear fecha legible
  const fechaLabel = fecha
    ? new Date(fecha+'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})
        .replace(/^\w/, c => c.toUpperCase())
    : 'Todos los pedidos activos';

  // ── Sección 1: Pedidos individuales ──────────────
  const pedidosOrdenados = [...activos].sort((a,b) => {
    // Primero por hora, luego por cliente
    const ha = a.hora || '99:99';
    const hb = b.hora || '99:99';
    return ha.localeCompare(hb) || (a.cli||'').localeCompare(b.cli||'','es');
  });

  const lineaPedidos = pedidosOrdenados.map((p) => {
    const hora   = p.hora ? ` — ${p.hora}` : '';
    const items  = (p.items||[])
      .sort((a,b) => a.p.localeCompare(b.p,'es'))
      .map(i => `   ${i.q}× ${i.p}`)
      .join('\n');
    const notas  = p.notas ? `\n   📝 ${p.notas}` : '';
    return `*${p.cli||'Sin cliente'}*${hora}\n${items}${notas}`;
  }).join('\n\n');

  // ── Sección 2: Totales de producción ─────────────
  const totales = {};
  activos.forEach(p => {
    (p.items||[]).forEach(i => {
      totales[i.p] = (totales[i.p]||0) + i.q;
    });
  });

  const lineaTotales = Object.entries(totales)
    .sort((a,b) => a[0].localeCompare(b[0],'es'))
    .map(([prod, qty]) => `${prod} x *${qty}*`)
    .join('\n');

  // ── Armar mensaje completo ───────────────────────
  const empleado = (() => {
    // Buscar el empleado en el directorio
    const catEmpleados = getCatsPrincipales().find(c => c.nombre.toLowerCase() === 'empleados');
    if (catEmpleados) {
      const emp = dirGetByCat(catEmpleados._id)[0];
      if (emp?.metadata?.telefono) return emp.metadata.telefono.replace(/\D/g,'');
    }
    return '';
  })();

  const msg =
`📋 *PEDIDOS — ${fechaLabel}*

${lineaPedidos}

━━━━━━━━━━━━━━
📦 *PRODUCCIÓN TOTAL*

${lineaTotales}

_Enviado desde OTTO_`;

  const encoded = encodeURIComponent(msg);
  const url = empleado
    ? `https://wa.me/${empleado}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  window.open(url, '_blank');
}

g('ped-wsp-btn')?.addEventListener('click', compartirPedidosWsp);
g('prod-modal-overlay')?.addEventListener('click', closeProdModal);
g('prod-modal-close')?.addEventListener('click', closeProdModal);
g('prod-sem-prev')?.addEventListener('click', () => { pedSemanaOffset--; renderProdSemanaModal(); });
g('prod-sem-next')?.addEventListener('click', () => { pedSemanaOffset++; renderProdSemanaModal(); });
g('prod-sem-today')?.addEventListener('click', () => { pedSemanaOffset=0; renderProdSemanaModal(); });

// Finanzas tabs y navegación
document.querySelectorAll('.fin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.fin-tab').forEach(t=>t.classList.remove('sel'));
    tab.classList.add('sel'); S.finFiltro=tab.dataset.filter; renderMovsFin();
  });
});
g('fin-prev-btn')?.addEventListener('click', () => cambiarMesFin(-1));
g('fin-next-btn')?.addEventListener('click', () => cambiarMesFin(1));
g('fin-vista-lista')?.addEventListener('click', () => {
  g('fin-view-lista').style.display='block'; g('fin-view-cats').style.display='none';
  g('fin-vista-lista').classList.add('sel'); g('fin-vista-cats').classList.remove('sel');
});
g('fin-vista-cats')?.addEventListener('click', () => {
  g('fin-view-lista').style.display='none'; g('fin-view-cats').style.display='block';
  g('fin-vista-lista').classList.remove('sel'); g('fin-vista-cats').classList.add('sel');
  finCatSel=null; renderFinCats();
});
g('fin-donut-tipo-btn')?.addEventListener('click', () => {
  finCatTipo=finCatTipo==='ingreso'?'gasto':'ingreso'; finCatSel=null; renderFinCats();
});

// Calendario pedidos (toggle semana/mes)
g('ped-mes-btn')?.addEventListener('click', () => {
  pedCalMes=!pedCalMes;
  const btn=g('ped-mes-btn'),strip=g('ped-week-strip'),mesWrap=g('ped-mes-wrap');
  if(pedCalMes){
    strip.style.display='none'; mesWrap.style.display='block';
    btn.classList.add('mes'); btn.innerHTML='<span class="material-icons-round">view_week</span>Semana';
    renderCalMes('ped','pedMesOffset','pedFecha',null,ds=>S.pedidos.some(p=>p.fecha===ds&&!p.archivado));
  }else{
    strip.style.display='block'; mesWrap.style.display='none';
    btn.classList.remove('mes'); btn.innerHTML='<span class="material-icons-round">calendar_month</span>Mes';
    renderPedWeek();
  }
});
g('ped-mes-prev')?.addEventListener('click', () => { if(typeof pedMesOffset!=='undefined')pedMesOffset--; renderCalMes('ped','pedMesOffset','pedFecha',null,ds=>S.pedidos.some(p=>p.fecha===ds&&!p.archivado)); });
g('ped-mes-next')?.addEventListener('click', () => { if(typeof pedMesOffset!=='undefined')pedMesOffset++; renderCalMes('ped','pedMesOffset','pedFecha',null,ds=>S.pedidos.some(p=>p.fecha===ds&&!p.archivado)); });

// Historial pedidos
g('ped-hist-btn')?.addEventListener('click', () => {
  const body=g('ped-hist-body'),arrow=g('ped-hist-arrow');if(!body)return;
  const open=body.classList.toggle('on');
  if(arrow)arrow.textContent=open?'expand_less':'expand_more';
  if(open)renderHistorialPeds();
});

// Agenda
g('age-mes-prev')?.addEventListener('click', () => { ageMesOffset--; renderAgeCalGoogle(); });
g('age-mes-next')?.addEventListener('click', () => { ageMesOffset++; renderAgeCalGoogle(); });
g('age-mes-today')?.addEventListener('click', () => { ageMesOffset=0; S.ageFecha=hoy(); renderAgeCalGoogle(); renderEvs(); });

// Tareas calendario
g('task-mes-prev')?.addEventListener('click', () => { taskMesOffset--; renderCalMes('task','taskMesOffset','taskFecha',null,ds=>S.tareas.some(t=>t.fecha===ds&&!t.done)); });
g('task-mes-next')?.addEventListener('click', () => { taskMesOffset++; renderCalMes('task','taskMesOffset','taskFecha',null,ds=>S.tareas.some(t=>t.fecha===ds&&!t.done)); });

// Mi Negocio
let mnSearchTimer=null;
g('mn-search-inp')?.addEventListener('input', () => {
  clearTimeout(mnSearchTimer);
  mnSearchTimer=setTimeout(()=>renderDirectorioGrid(g('mn-search-inp').value),250);
});

// Panel usuario
document.querySelectorAll('.user-field-edit[data-field]').forEach(btn => {
  btn.addEventListener('click', () => editUserField(btn.dataset.field));
});
g('btn-delete-account')?.addEventListener('click', deleteAccount);

// OTTO
document.querySelectorAll('.otto-card-chip[data-q], .otto-q-item[data-q]').forEach(el => {
  el.addEventListener('click', () => ottoGoChat(el.dataset.q));
});
g('otto-back-btn')?.addEventListener('click', ottoGoHome);
g('otto-home-send')?.addEventListener('click', () => {
  const inp=g('otto-home-inp');if(!inp||!inp.value.trim())return;
  const q=inp.value.trim();inp.value='';ottoGoChat(q);
});
g('otto-home-inp')?.addEventListener('keydown', e => {
  if(e.key==='Enter'){const inp=g('otto-home-inp');if(inp&&inp.value.trim()){const q=inp.value.trim();inp.value='';ottoGoChat(q);}}
});
g('chat-send')?.addEventListener('click', sendMsg);
g('chat-inp')?.addEventListener('keydown', e=>{if(e.key==='Enter'&&!e.shiftKey)sendMsg();});
g('quick-send')?.addEventListener('click', sendQuickMsg);
g('quick-inp')?.addEventListener('keydown', e=>{if(e.key==='Enter')sendQuickMsg();});

// Onboarding
g('ob-start-btn')?.addEventListener('click', () => showOb('ob1'));
g('ob-skip-btn')?.addEventListener('click', () => g('onboarding').classList.remove('on'));
g('obNegocio')?.addEventListener('input', () => { const btn=g('ob1-btn');if(btn)btn.disabled=!g('obNegocio').value.trim(); });
g('obNegocio')?.addEventListener('keydown', e => { if(e.key==='Enter'&&g('obNegocio').value.trim())showOb('ob2'); });
g('ob1-btn')?.addEventListener('click', () => {
  obNegocio=g('obNegocio')?.value.trim()||'';
  if(obNegocio){if(g('ob-done-title'))g('ob-done-title').textContent=`¡Listo, ${obNegocio}!`;if(g('ob-done-sub'))g('ob-done-sub').textContent=`OTTO ya conoce ${obNegocio} y está listo.`;}
  showOb('ob2');
});
g('ob1-skip')?.addEventListener('click', () => showOb('ob2'));
document.querySelectorAll('.ob-rubro-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.ob-rubro-item').forEach(i=>i.classList.remove('sel'));
    item.classList.add('sel');obRubro=item.dataset.rubro;obEmoji=item.dataset.emoji;
    const btn=g('ob2-btn');if(btn)btn.disabled=false;
    setTimeout(()=>showOb('ob3'),300);
  });
});
g('ob2-btn')?.addEventListener('click', () => showOb('ob3'));
g('ob3-btn')?.addEventListener('click', finishOnboarding);
setTimeout(()=>{if(g('ob3')?.classList.contains('on'))finishOnboarding();},3000);

// Teclado iOS: sheet sube con el teclado
if('visualViewport' in window){
  window.visualViewport.addEventListener('resize', () => {
    const sheets=document.querySelectorAll('.sheet.on');
    sheets.forEach(s=>{
      const gap=window.innerHeight-window.visualViewport.height;
      s.style.transform=gap>100?`translateY(-${gap}px)`:'';
    });
  });
}
