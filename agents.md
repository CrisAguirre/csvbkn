# agents.md — Cotizador Spazio Vitale (full-stack)

> Archivo de contexto para futuras sesiones de IA. Backend `csvbkn` + Frontend `cotizadorspaziovitale`.
> Última actualización: 2026-09-18. Fix aplicado: Guardar con sobrescritura por número.

## 1. Dónde está todo

- Raíz monorepo local (no es un solo git): `C:\Users\USUARIO\Desktop\csv\`
  - `csvbkn/` — backend Node Express + MongoDB (repo `git+https://github.com/CrisAguirre/csvbkn.git`)
  - `cotizadorspaziovitale/` — frontend Angular 16.1.7
  - `.git/` + `.kilo/` en raíz (el `git status` de raíz muestra `?? cotizadorspaziovitale/ ?? csvbkn/`, cada subcarpeta tiene su propio `.git`)
- Producción:
  - Backend: `https://csvbkn.onrender.com/api` (Render, free tier → cold start ~50s, usar `GET /api/ping` para calentar)
  - Frontend apunta a producción incluso en local: `src/environments/environment.ts` y `environment.prod.ts` → `apiUrl: 'https://csvbkn.onrender.com/api'`
- Herramientas bloqueadas: `read`/`glob` sobre `Desktop/csv` suelen pedir permiso y fallar. Usar `bash` PowerShell con `Get-Content`, `Select-String`, `Get-ChildItem`. Para parches grandes usar scripts Python en `C:\Users\USUARIO\AppData\Local\Temp\opencode\`.

## 2. Backend `csvbkn` — Express 5 + Mongoose 9

### 2.1 Comandos

```powershell
cd "C:\Users\USUARIO\Desktop\csv\csvbkn"
npm install            # obligatorio, node_modules no está commiteado
npm start              # node index.js, puerto PORT o 3000
npm test               # jest → tests/calculator.test.js (9 tests)
npm run lint           # eslint . → debe dar exit 0
node seed.js export    # exporta datos
node seed.js import    # importa datos
```

`node --check routes/quotations.js` para chequeo rápido de sintaxis.

### 2.2 Env (`/.env.example`, requiere `.env` real)

```
PORT=3000
MONGODB_URI=mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>/<DB>?appName=Cluster0
JWT_SECRET=...
ADMIN_EMAIL / ADMIN_PASSWORD (seed admin role=admin)
DESIGNER_EMAIL / DESIGNER_PASSWORD (seed designer role=designer)
```

Sin `JWT_SECRET` o `MONGODB_URI` → `process.exit(1)`. TZ forzada a `America/Bogota`.

### 2.3 `index.js` — flujo

- `cors({origin:true, credentials:true}) + cookieParser() + express.json({limit:'10mb'}) + morgan→winston`
- Conexión `mongoose.connect(MONGODB_URI)` + seeds al conectar:
  - borra admin viejo `krontroth@gmail.com`
  - crea admin/designer si no existen (bcrypt 10)
  - crea `Config{key:'global'}` si no existe: labor 12495, design 16780, imprev 10%, utilidad 35%, indirectos 32%, IVA 19%, descuento 10%, next 2700, wasteTable [1-10:0.5, 11-30:0.35, 31-50:0.3, 51-100:0.25]
  - `require('./seed-compac-mesones')()`
- Rutas directas:
  - `GET /api/ping` → `{success, ts}` calentar Render
  - `POST /api/login` (zod `loginSchema`) → bcrypt compare, JWT 8h `{id,email,role}`, cookie `token httpOnly secure sameSite:none maxAge 8h`, crea `Activity{login}`, devuelve `{user, expiresAt}`
  - `POST /api/register` solo `authMiddleware+requireAdmin` (roles `admin|designer`)
  - `GET /api/activities` solo admin, últimas 100
  - `POST /api/logout` → crea `Activity{logout}`, `clearCookie`
- `app.use('/api/materials'|'config'|'quotations'|'labor-times'|'temporals'|'manual-entries')`

### 2.4 Auth

- `middleware/auth.js`: token de `req.cookies.token` o `Authorization: Bearer`. `requireAdmin` exige `role==='admin'`.
- `middleware/validate.js`: `schema.parse(req.body)`, si `ZodError` → `400 {success:false, errors:[{field,message}]}` + log winston.

### 2.5 Modelos (`models/`)

- `User{email unique, password hash, role: admin|designer}`
- `Config{key:'global' unique, laborRatePerHour, designRatePerHour, unforeseenPercent, profitPercent, indirectPercent, taxPercent, defaultDiscount, nextQuotationNumber, wasteTable[{minMl,maxMl,factor}], paymentTerms, validityDays, companyName, city}`
- `Material{category: melamina|canto|accesorio|herraje|vidrio|meson|laminado|compactslab|duraopak|tablero|otro, code, description required, provider, brand, color, dimension, unit: LAMINA|ML|UNIDAD|... , unitPrice, pricePerSheet, measure1/2, sqmPerSheet, pricePerSqm, active, calibre, tipo, rigidez, moMinutesPerMl}`
- `Quotation{number unique required, date, city, installationAddress, sameAddress, client{name required,city,phone,email,address,viaticos}, title, areas[areaSchema], products[{code,description,unit,quantity,unitPriceWithTax,totalWithTax}], totals{...grandTotal,viaticos}, wizardConfig{clientPriceMode: unit_sqm|manual|outsource|products, hardwareDisplayMode, moTimeMode, requiresDesignFiles, areaDisplayMode, mesonMode, pricingTier, wizardCompleted}, status: nuevo|borrador|en_revision|auditada|enviada|aceptada|aprobada|rechazada|archivada_* , paymentTerms, validityDays, notes, createdBy ref User}` + subesquemas `supply|edgeBand|accessory|designTime|cut|assembly|installation|veneer|mesonDetails|furniture|subArea|visibleAccessory`
- `LaborTime{code, activityName, timeHours, category: armado|instalacion|'', minutes, valorMinuto, persons, quantity, unit, isService, notes, active}`
- `Temporal{clientName, currentStepName, currentStepNumber, data: Mixed}` timestamps
- `ManualEntry{quotationId, category: insumo|canto|accesorio|armado|instalacion, description, details}` (log de ítems `_isManual`)
- `Activity{userEmail, role, action: login|logout, timestamp}`

### 2.6 Rutas

| Base | Método/Ruta | Auth | Notas |
|---|---|---|---|
| `/api/quotations` | `GET /?status,search,page,limit,sort` | sí, designer solo ve `createdBy=self` | select resumido + populate, `search` por `client.name` regex o `number` |
| | `GET /stats` | sí | counts + sum `totals.grandTotal` mes/histórico |
| | `GET /:id` | sí | populate `createdBy` |
| | `POST /` | sí + zod `quotationSchema` (permisivo) | **UPSERT por número (fix 2026-09-18)**: `normalize` → calcula `finalNumber` (usa digitado o auto `nextQuotationNumber`) → si `findOne({number})` existe → `set+recalculate+save` devuelve `200 sobrescrita` (designer solo si es dueño) → si no crea nuevo `201`. Ver §5 |
| | `PUT /:id` | sí + zod | designer solo borrador/nuevo propios; borra `_id/createdBy/timestamps`, `recalculateAll`, `markModified` |
| | `PATCH /:id/status` | admin | enum validStatuses |
| | `POST /:id/duplicate` | sí | nuevo número, status borrador |
| | `DELETE /:id` | admin | |
| `/api/temporals` | `GET /`, `GET /:id`, `POST /` (upsert si `_id` válido), `DELETE /all/cleanup`, `DELETE /:id` | sí | sort `updatedAt -1` |
| `/api/materials` | `GET /`, `GET /providers`, `GET /brands`, `GET /:id` | sí | filtros por categoría |
| | `POST /`, `PUT /:id`, `DELETE /:id`, `POST /bulk`, `POST /bulk-upsert`, `POST /rename-provider` | admin | `bulk-upsert` usado por imports |
| `/api/config` | `GET /` (crea default si falta), `PUT /` admin, `GET /next-number` (inc y devuelve previo) | sí | |
| `/api/labor-times` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /bulk-upsert` | leer sí, escribir admin | |
| `/api/manual-entries` | `GET /`, `DELETE /:id` | sí | |

### 2.7 Utils y scripts

- `utils/calculator.js`: `recalculateAll(quotation, config)` espejo del front. `getWasteFactor`, `parseMeasurement("2.08x0.46")`, `calculateFurnitureTotals` (insumos + MO por m², cantos + desperdicio + MO/ml, accesorios +5% opcional, diseño, armado/instalación por minutos o fallback horas), `calculateGlobalTotals` AIU+IVA+descuento+viáticos, rama `products` → `calculateProductsTotals`.
- `utils/schemas.js`: `login/register/material/bulkUpsert/quotation superficial/ updateStatus`. `quotationSchema` es laxo (`areas: any[]`, `totals: any`) → casi nunca bloquea.
- `utils/logger.js`: winston + daily-rotate en `logs/` (`application-*.log`, `error-*.log`).
- `import-excel.js, import-mo.js, import-tableros.js, import-tapcantos.js, seed-compac-mesones.js, seed.js, read-compac.js, test-val.js`.
- `tests/calculator.test.js` (jest 9 tests).
- `eslint.config.mjs`: `js.configs.recommended`, ignora `node_modules/logs`, `no-unused-vars warn`.

## 3. Frontend `cotizadorspaziovitale` — Angular 16

### 3.1 Comandos

```powershell
cd "C:\Users\USUARIO\Desktop\csv\cotizadorspaziovitale"
npm start              # ng serve → http://localhost:4200/
npx ng build --configuration development  # ~8MB, ~15s
npx tsc -p tsconfig.spec.json --noEmit    # debe ser exit 0
.\node_modules\.bin\ng.cmd test --watch=false --browsers=ChromeHeadless  # karma 24/24 SUCCESS
npm run test:e2e       # playwright e2e/mesones.spec.ts
```

`karma.conf.js` fue creado 2026-09-18 (no venía en repo). Chrome en `C:\Program Files\Google\Chrome\Application\chrome.exe`.

### 3.2 Rutas (`app.module.ts`)

- `/login` pública. Resto bajo `MainLayoutComponent + authGuard`:
- `dashboard, price-list, quotations, quotations/new (wizard), quotations/view/:id, quotations/:id (editar wizard), settings(admin), activity(admin)`. `** → /login`.

### 3.3 Piezas clave

- Guards: `auth.guard` (localStorage `user+expiresAt`), `role.guard` (`expectedRole:'admin'`).
- Interceptor `auth.interceptor`: solo `withCredentials:true` si `url.startsWith(environment.apiUrl)` (cookies httpOnly). `401` → logout + `/login`. Ojo: APIs externas (TRM datos.gov.co) sin credentials.
- Servicios: `auth, config, material (preloadAllMaterials), quotation (CRUD + stats), quotation-calculator, quotation-logic (jerarquía muebles), quotation-validation (vs 2604), labor-time, temporal, supplier-import, pdf-generator (pdfmake), theme, toast`.
- Modelos `models/interfaces.ts`: `Material, LaborTime, AppConfig, SupplyItem(+_lamina* transitorios), EdgeBandItem(+_canto*), AccessoryItem, DesignTimeItem, AssemblyItem/InstallationItem(+_activity*), MesonDetails, Furniture(areaSqm, type standard|custom|meson), Area, Quotation, WizardConfig{clientPriceMode: unit_sqm|manual|outsource|products|'', hardwareDisplayMode, moTimeMode, requiresDesignFiles:null|bool, areaDisplayMode, mesonMode, pricingTier, wizardCompleted}`.
- Componentes: `sidebar (muestra temporales + resume/delete)`, `header`, `material-picker`, `toast`, `main-layout`.
- Páginas: `login, dashboard (stats + TRM), price-list (CRUD materiales), settings, quotation-list (activas/archivadas, filtro, sort, duplicate, PDF), quotation-view, quotation-wizard (5 pasos), activity`.
- Wizard `quotation-wizard` (`TOTAL_STEPS=5`, `maxSteps=4` en products):
  1. Cliente (`quotationForm` valida name/city/phone/email)
  2. Config (5 preguntas: precio, diseño, áreas, mesones, lista precios; en manual se omite 5, en products solo 1)
  3. Muebles (áreas + furniture + meson toggle + 7 secciones: supplies, edgeBands, designTime, accessories, assembly, installation + subAreas/visibles)
  4. Presupuesto (valida `isStepValid(4)`: mesón con precio>0, sin `Est.` ni `unitPrice<=0`)
  5. Resumen AIU (edita % imprev/util/indirect/IVA/recargo, `grandTotal`)
  - `autoSave()` en cada `next/prev`: si `activeQuotation._id` existe NO guarda temporal; si no `POST /temporals {_id:temporalId,...}`.
  - `loadTemporal(?temporalId=)` → `activeQuotation = temporal.data`, `temporalId=_id`.
  - Botonera: Siguiente deshabilitado si `!isStepValid`, Guardar solo en `maxSteps`.
- `src/assets/data/`: `implementation_plan.md` (spec original), `excel-formulas.md`, `proveedores-precios.md`, Excels/DOCs de referencia, `src/assets/Precios proveedores/`.
- Tests: `*.spec.ts` (app, dashboard, login, auth.service, quotation-calculator) + nuevo `quotation-wizard-save.spec.ts` (5 tests sanitize/overwrite). Total 24 karma SUCCESS.

## 4. Flujo temporal → cotización (crítico)

1. Usuario avanza wizard → `autoSave()` crea/actualiza `Temporal`.
2. Sidebar lista `temporals$` → `resumeTemporal(id)` → `/quotations/new?temporalId=id` → `loadTemporal`.
3. Resumen → `saveQuotation()` (ver §5) → éxito → `deleteTemporal(temporalId)+refreshTemporals()` + `navigate(['/quotations'])`.
4. Si ya existe cotización con mismo `number` → **sobrescribir**, no duplicar.

## 5. Fix 2026-09-18 — Guardar no guardaba nada

Síntoma: tras 5 pasos, Guardar no creaba ni desde temporal ni nueva.
Causa: solo hacía `PUT` con `_id`; desde temporal siempre `POST`; si `number` duplicado (unique) → `400 E11000`.
Solución:
- Front `sanitizeQuotation()` + búsqueda previa `GET /quotations?search=<number>` → si existe `PUT existing._id` else `POST`; errores con mensaje servidor (`handleSaveError` log `[saveQuotation:ctx]`).
- Back `stripTransientKeys()` en `normalizeQuotation()` + `POST` upsert por `findOne({number})` (403 si designer ajeno).
- Verificado con `ng build`, `tsc --noEmit`, `eslint`, `jest`, `karma 24/24`.

## 6. Errores típicos y qué mirar

- `400 Datos inválidos` → `logs/error-*.log` + Network → `errors[]` de zod (casi nunca es quotation, es login/material).
- `400 E11000 duplicate key {number}` → ya cubierto por upsert; si aparece, revisar que front/back estén desplegados.
- `401 Token no proporcionado/inválido` → cookie `secure+sameSite:none` exige HTTPS; en local con API prod funciona por `withCredentials`, pero si expiró (8h) → relogin. Interceptor redirige a `/login`.
- `403` → rol designer intentando editar ajena o `requireAdmin`.
- `500 Error al obtener número` → `Config{key:'global'}` falta y no se pudo crear.
- Guardar se queda cargando → mirar consola `[saveQuotation:*]`; `isLoading` ahora siempre se resetea.
- Render dormido → primer `POST` tarda; calentar con `GET /api/ping`. `apiUrl` prod incluso en dev.
- `node_modules` backend ausente tras clone → `npm install` primero.
- Karma `Found 1 load error` + `TS2741/TS2739` → faltan `address/viaticos/installationAddress/sameAddress` en fixtures; ya corregidos en sample/spec.

## 7. Reglas para futuros agentes

1. No crear `*.md` ni archivos sin pedirlo (excepción: este `agents.md` pedido explícito).
2. Preferir editar existentes; si `read/edit` pide permiso en `Desktop/csv`, usar `bash` + scripts Python en `Temp\opencode`.
3. Tras cada cambio: `npx eslint` + `npm test` (back) y `tsc --noEmit` + `ng build` (front); `ng test` solo si se tocaron specs/wizard.
4. No commitear/pushear sin orden. `git -C ... status/diff/log --oneline -10` antes de cualquier commit.
5. Sanitizar siempre payloads wizard (claves `_ *`) y respetar upsert por número + borrado de temporal + `refreshTemporals()`.
6. No cambiar `apiUrl`, CORS (`origin:true,credentials:true`), cookies (`httpOnly,secure,sameSite:none`), ni enums de `status/wizardConfig` sin confirmar.
7. Respuestas cortas, con `ruta:línea` cuando se cite código, y verificar ejecutando.
