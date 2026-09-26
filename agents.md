# agents.md — Cotizador Spazio Vitale · Backend + Frontend (csvbkn / csvdemo)

> Documento de contexto para agentes IA. Proyecto: **Cotizador Spazio Vitale** (muebles / mesones COMPAC, melamina, tableros, tapacantos, mano de obra).
> Última verificación: 2026-09-26, leyendo código real con Read/Glob (package.json, index.js, models/, routes/, middleware/, utils/, .env.example, tests/). Fusiona guía backend 2026-09-26 (165 líneas, `csvdemo/agents.md`) + guía full-stack 2026-09-24 (182 líneas, `csvbkn/agents.md`).
> Nota de rutas: el código backend verificado vive en `C:\Users\USUARIO\Desktop\csv\csvbkn\` (index.js, routes/, models/, etc). `C:\Users\USUARIO\Desktop\csv\csvdemo\` contenía solo `agents.md` duplicado por error. Este archivo fusionado se escribe en **ambas** rutas (`csvbkn/agents.md` y `csvdemo/agents.md`) para eliminar la divergencia. Si `csvdemo` sigue vacío de código, copiar el backend allí o tomar `csvbkn` como fuente de verdad.

## 1. Dónde está todo

- Raíz local (no es un solo git): `C:\Users\USUARIO\Desktop\csv\`
  - `csvbkn/` — backend Node Express + MongoDB (repo `git+https://github.com/CrisAguirre/csvbkn.git`, tiene su propio `.git`)
  - `csvdemo/` — clon/duplicado: actualmente solo `agents.md`. No ejecutar `npm` aquí hasta copiar el backend.
  - `cotizadorspaziovitale/` — frontend Angular 16.1.7 (su propio `.git`)
  - Raíz tiene `.git/` + `.kilo/` (`git status` muestra `?? cotizadorspaziovitale/ ?? csvbkn/`)
- Producción:
  - Backend: `https://csvbkn.onrender.com/api` (Render free tier, cold start ~50s; calentar con `GET /api/ping`)
  - Frontend apunta a prod incluso en local: `src/environments/environment.ts` y `environment.prod.ts` → `apiUrl: 'https://csvbkn.onrender.com/api'`

## 2. Descripción del proyecto

Backend REST para el cotizador de **Spazio Vitale**. Expone autenticación JWT en cookie httpOnly, CRUD de materiales, configuración global de precios (AIU + IVA), cotizaciones con wizard (5 pasos en frontend), tiempos de mano de obra (MO), temporales (borradores del wizard), manual-entries (log de ítems manuales `_isManual`) y auditoría de logins/logouts (Activity).
Despliegue Render: bind obligatorio a `0.0.0.0` y `PORT` de entorno. TZ forzada a `America/Bogota` en `index.js:2`. Conexión Mongo en background **después** de `app.listen` para no bloquear el puerto.

## 3. Stack y versiones (verificado en package.json backend)

- `engines.node`: `22.x` · `type: commonjs` · `main: index.js`
- `express ^5.2.1` · `mongoose ^9.6.2` · `jsonwebtoken ^9.0.3` · `bcryptjs ^3.0.3`
- `zod ^4.4.3` · `winston ^3.19.0` + `winston-daily-rotate-file ^5.0.0` + `morgan ^1.11.0`
- `@e965/xlsx ^0.20.3` · `cors ^2.8.6` · `cookie-parser ^1.4.7` · `dotenv ^17.4.2`
- Dev: `jest ^30.4.2` · `eslint ^10.8.1` + `@eslint/js ^10.0.1` + `globals ^17.11.0`
- Frontend: Angular **16.1.7**, `ng serve → :4200`, `pdfmake` (PDF), `playwright` (e2e `mesones.spec.ts`), karma 24/24 SUCCESS. Chrome en `C:\Program Files\Google\Chrome\Application\chrome.exe`. `karma.conf.js` creado 2026-09-18 (no venía en repo).

## 4. Estructura backend (raíz `csvbkn/`)

```
index.js                 # app Express, seeds de arranque, auth directo (/login,/register,/activities,/logout,/ping)
models/                  # User, Config, Material, Quotation, LaborTime, Temporal, ManualEntry, Activity
routes/                  # materials, config, quotations, labor, temporals, manualEntries
middleware/              # auth.js, validate.js
utils/                   # calculator.js, schemas.js, logger.js
tests/calculator.test.js # 9 tests jest
logs/                    # application-*.log, error-*.log (winston daily-rotate, creado si falta)
seed.js                  # export/import (ver §11)
seed-managed-users.js    # DESTRUCTIVO: purga usuarios fuera de lista (ver §11)
seed-compac-mesones.js   # inserta 11 mesones COMPAC solo si no existen
import-excel.js / import-mo.js / import-tableros.js / import-tapcantos.js
read-compac.js, test-val.js
.env.example, eslint.config.mjs, package.json
```

## 5. Variables de entorno (.env.example + index.js:31-38)

```
PORT=3000
MONGODB_URI=mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>/<DB>?appName=Cluster0
JWT_SECRET=your_super_secret_jwt_key
ADMIN_EMAIL / ADMIN_PASSWORD       # seed admin role=admin (solo si no existe)
DESIGNER_EMAIL / DESIGNER_PASSWORD # seed legacy role=designer (luego purgado si no está en lista gestionada)
# Opcionales seed gestionado: COMERCIAL_PASSWORD, CONTABILIDAD1_PASSWORD, CONTABILIDAD2_PASSWORD, DISENO_PASSWORD
```

Sin `JWT_SECRET` o `MONGODB_URI` → `console.error + process.exit(1)`. En Render: Dashboard → Environment.

## 6. Modelos (models/)

- **User**: `{email unique lowercase trim required, password hash required, role default 'admin'}` + timestamps. Roles válidos app: `admin|comercial|contabilidad|diseno` (validado en `POST /api/register` y `registerSchema`); seed arranque aún crea legacy `designer` si `DESIGNER_*` seteado (tratar logs viejos `designer` como no-admin).
- **Config**: `{key:'global' unique, laborRatePerHour 12495, designRatePerHour 16780, unforeseenPercent 10, profitPercent 35, indirectPercent 32, taxPercent 19, defaultDiscount 10, nextQuotationNumber 2700, wasteTable[{minMl,maxMl,factor}], paymentTerms (60/35/5), validityDays 3, companyName 'Spazio Vitales sas', city}`. Seed `index.js:131-158`, wasteTable `[1-10:0.5, 11-30:0.35, 31-50:0.3, 51-100:0.25]`.
- **Material**: `{category: melamina|canto|accesorio|herraje|vidrio|meson|laminado|compactslab|duraopak|tablero|otro (required, index), code, description required, provider, brand, color, dimension, unit: LAMINA|ML|UNIDAD|SERVICIO|KIT|TIROS|TIRO|M2|SER|JUEGO default UNIDAD, unitPrice, pricePublic/pricePublicVol/priceIndustrial (escalonados Duropak), pricePerSheet, measure1/2, sqmPerSheet, pricePerSqm, active, calibre, tipo, rigidez, moMinutesPerMl}`.
- **Quotation**: `{number unique required, date, city, installationAddress, sameAddress, client{name required,city,phone,email,address,viaticos}, title, areas[areaSchema], products[{code,description,unit,quantity,unitPriceWithTax,totalWithTax}], totals{...grandTotal,viaticos, porcentajes AIU}, wizardConfig{clientPriceMode: unit_sqm|manual|outsource|products, hardwareDisplayMode, moTimeMode, requiresDesignFiles, areaDisplayMode, mesonMode, pricingTier, wizardCompleted}, status: nuevo|borrador|en_revision|auditada|enviada|aceptada|aprobada|rechazada|archivada_aceptada|archivada_rechazada, paymentTerms, validityDays, notes, createdBy ref User}` + subesquemas `supply|edgeBand|accessory|designTime|cut|assembly|installation|veneer|mesonDetails|furniture|subArea|visibleAccessory`.
- **LaborTime**: `{code required unique, activityName required, timeHours default 0, category: armado|instalacion|'', minutes, valorMinuto, persons 1, quantity 1, unit: ML|M2|UNIDAD|LAMINA|SERVICIO, isService, notes, active}` + timestamps.
- **Temporal**: `{clientName default 'Sin Nombre', currentStepName, currentStepNumber, data: Mixed}` + timestamps. Borrador del wizard.
- **ManualEntry**: `{quotationId ref Quotation required, category: insumo|canto|accesorio|armado|instalacion required, description required, details: Mixed}` + índices `{category:1, description:'text'}`, `{quotationId:1}`. Log de ítems `_isManual`.
- **Activity**: `{userEmail required, role required, action: login|logout required, timestamp default now}`.

## 7. Endpoints

Auth directo en `index.js` (sin router auth separado):

| Método/Ruta | Auth | Notas |
|---|---|---|
| `GET /` | no | `{success, service:'csvbkn', ts}` healthcheck Render |
| `GET /api/health` | no | `{mongoState 0-3, ts}` |
| `GET /api/ping` | no | `{success, ts}` calentar Render frío |
| `POST /api/login` + `loginSchema` | no | bcrypt compare, JWT 8h `{id,email,role}`, cookie `token httpOnly secure sameSite:none maxAge 8h`, crea `Activity{login}`, devuelve `{user:{email,role}, expiresAt}` |
| `POST /api/register` + `registerSchema` | `authMiddleware+requireAdmin` | valida rol `admin\|comercial\|contabilidad\|diseno`, bcrypt 10, 201 |
| `GET /api/activities` | admin | últimas 100 por `timestamp -1` |
| `POST /api/logout` | `authMiddleware` | crea `Activity{logout}`, `clearCookie(token, httpOnly secure sameSite:none)` |

Routers (`app.use` en `index.js:267-272`):

| Base | Método/Ruta | Auth | Notas |
|---|---|---|---|
| `/api/quotations` | `GET /?status,search,page,limit,sort` | sí, no-admin solo `createdBy=self` | select resumido + populate, `search` por `client.name` regex o `number` |
| | `GET /stats` | sí | counts + suma `totals.grandTotal` mes/histórico |
| | `GET /:id` | sí | populate `createdBy` |
| | `POST /` + `quotationSchema` | sí | **UPSERT por número**: `normalizeQuotation` (strip transitorios) → `finalNumber` (digitado o auto `nextQuotationNumber`) → si `findOne({number})` existe → `set+recalculateAll+save` → `200 sobrescrita` (no-admin solo si dueño) → si no crea `201` |
| | `PUT /:id` + `quotationSchema` | sí | no-admin solo borrador/nuevo propios; borra `_id/createdBy/timestamps`, `recalculateAll`, `markModified` |
| | `PATCH /:id/status` + `updateQuotationStatusSchema` | admin | enum 10 estados |
| | `POST /:id/duplicate` | sí | nuevo número, status borrador |
| | `DELETE /:id` | admin | |
| `/api/temporals` | `GET /`, `GET /:id`, `POST /` (upsert si `_id` válido), `DELETE /all/cleanup`, `DELETE /:id` | sí | sort `updatedAt -1` |
| `/api/materials` | `GET /`, `GET /providers`, `GET /brands`, `GET /:id` | sí | filtros por categoría |
| | `POST /`, `PUT /:id`, `DELETE /:id`, `POST /bulk`, `POST /bulk-upsert`, `POST /rename-provider` | admin | `bulk-upsert` usado por scripts import |
| `/api/config` | `GET /` (crea default si falta), `PUT /`, `GET /next-number` (inc y devuelve previo) | leer sí, escribir admin | |
| `/api/labor-times` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /bulk-upsert` | leer sí, escribir admin | |
| `/api/manual-entries` | `GET /`, `DELETE /:id` | sí | |

## 8. Lógica de negocio (utils/calculator.js — verificado)

Exports: `recalculateAll, calculateFurnitureTotals, calculateGlobalTotals` (+ `getWasteFactor`, `parseMeasurement`, `calculateProductsTotals` internos/exportados parciales).
- `getWasteFactor(quantity, wasteTable)`: busca rango `[minMl,maxMl]`; si excede usa factor del `maxMl` mayor; sin tabla → `0`.
- `parseMeasurement("2.08x0.46")`: normaliza `,`→`.`, minúsculas; si contiene `x|*` multiplica `p1*p2`; si no `parseFloat`; vacío/NaN → `1`.
- `calculateFurnitureTotals(furniture, config)`: insumos (`quantity*unitPrice` + MO por m²), cantos (`quantity + waste + MO/ml`: `waste=quantity*factor`, `moTotal=totalMl*moMinutesPerMl*valorMinuto`), accesorios (+5% si `apply5Percent`), diseño (`quantity*laborRate`), armado/instalación por minutos o fallback horas; acumula `totalSupplies/totalEdgeBands/.../totalCost` y `areaSqm`.
- `calculateGlobalTotals(totalCost, totalSqm, config, existingTotals, mesonSubtotal, mesonTax, viaticos)`: respeta `%` del payload si vienen (`??` config/defaults 10/35/32/19/descuento), `unforeseen/profit/indirect = totalCost*%`, `subtotal = cost+AIU+mesones`, IVA, descuento, `grandTotal + viáticos`. Rama `products` → `calculateProductsTotals`.
- `recalculateAll(quotation, config)`: itera `areas[].furniture`, llama `calculateFurnitureTotals`, suma `globalTotalSqm (areaSqm*quantity)`, asigna `quotation.totals = calculateGlobalTotals(...)`. Espejo del front `quotation-calculator.service.ts`.
- Normalización en `routes/quotations.js`: `stripTransientKeys(obj)` borra recursivamente claves que empiezan con `_` (ej. `_isManual`, `_lamina*`, `_canto*`, `_activity*`), `normalizeQuotation(data)` lo aplica antes de `recalculateAll`. Ítems manuales se registran además en `ManualEntry`.

## 9. Auth y roles (middleware/auth.js, index.js:179-264)

- `authMiddleware`: token de `req.cookies.token` o `Authorization: Bearer <jwt>`; `jwt.verify(token, JWT_SECRET)` → `req.user={id,email,role}`; sin token o inválido → `401`.
- `requireAdmin`: exige `req.user.role==='admin'` → si no `403`.
- Roles: `admin|comercial|contabilidad|diseno`. Quotations: no-admin solo ve/edita propias (`createdBy=self`); `PATCH status` y `DELETE` solo admin. Materials/labor escritura solo admin, lectura autenticada.
- Cookie: `httpOnly:true, secure:true, sameSite:'none', maxAge 8h`. JWT `expiresIn:'8h'`. CORS `cors({origin:true, credentials:true})`, `express.json({limit:'10mb'})`, `cookieParser()`, `morgan→winston`.

## 10. Validaciones Zod (utils/schemas.js + middleware/validate.js)

- `loginSchema`: `{email: email, password: min(1)}`.
- `registerSchema`: `{email, password: min(6), role: enum admin|comercial|contabilidad|diseno}`.
- `materialSchema`: `{category enum 11 valores, description min(1) required, code/provider/brand/color/dimension/calibre/tipo/rigidez opcionales, unit enum 10 valores default UNIDAD, unitPrice/pricePerSheet/measure1/2/moMinutesPerMl nonnegative opcionales, active boolean}`.
- `bulkUpsertSchema`: `{materials: any[].min(1), replaceProvider?}`.
- `quotationSchema`: **permisivo a propósito** — `{clientName?, documentId?, phone?, address?, status enum 10?, validityDays int+?, paymentTerms?, areas: any[]?, totals: any?}`; casi nunca bloquea, el cálculo lo rehace el servidor.
- `updateQuotationStatusSchema`: `{status enum 10 estados}`.
- `validate(schema)`: `schema.parse(req.body)`; si `ZodError` → `400 {success:false, message:'Datos inválidos...', errors:[{field,message}]}` + `logger.error`; otro error → `500`.

## 11. Scripts seed / import

- `seed.js`: `node seed.js export|import`. Exporta `Material+LaborTime+Config` a `../scripts/seed-data.json`; import hace `deleteMany` + `insertMany` (destructivo en esas 3 colecciones).
- `seed-managed-users.js` (**DESTRUCTIVO, corre en cada arranque** `index.js:123-129`): `KEEP_ADMIN='spaziovitale.gerencia@gmail.com'`; `MANAGED_USERS=[comercial@, contabilidad1@, contabilidad2@, diseno@]` (password por env o defaults `Spazio2026N*`, bcrypt 10); `deleteMany({email:{$nin:keep}})` borra TODO lo demás, luego crea/resetea password+rol de las 4. No correr en dev con usuarios locales sin respaldo.
- `seed-compac-mesones.js` (seguro, `index.js:160-166`): inserta 11 materiales COMPAC (`category:'meson', provider:'COMPAC'`, `measure 1.53x3.66`, `unit M2`) **solo si** `countDocuments({category:'meson',provider:'COMPAC'})===0`.
- `import-excel.js / import-mo.js / import-tableros.js / import-tapcantos.js`: bulk-upsert por `POST /api/materials/bulk-upsert`; requieren token admin + API caliente.
- Arranque `index.js:connectDB()`: borra viejo `krontroth@gmail.com`, seed admin/designer por env, `seed-managed-users`, `Config global` si falta, `seed-compac-mesones`.

## 12. Tests y lint backend

- `tests/calculator.test.js` — **9 tests** jest: `getWasteFactor` (3: sin tabla→0, rangos, excede→máx), `calculateFurnitureTotals` (2: insumos, cantos con desperdicio+MO), mesones (1), `calculateGlobalTotals` (1: AIU+IVA+descuento), `recalculateAll` extremo a extremo (1) + respeta/sobrescribe totales manipulados (1).
- `npm test` → `jest`. `npm run lint` → `eslint .` (config `eslint.config.mjs`: `js.configs.recommended`, ignora `node_modules/**,logs/**`, `no-unused-vars warn` con `argsIgnorePattern ^_`).
- `utils/logger.js`: winston + daily-rotate (`logs/error-%DATE%.log`, `logs/application-%DATE%.log`, 20m/14d/zip) + consola siempre (Render necesita consola para diagnosticar Timeouts).

## 13. Frontend `cotizadorspaziovitale` — Angular 16 (rescatado de guía 2026-09-24)

- Rutas (`app.module.ts`): `/login` pública; resto bajo `MainLayoutComponent+authGuard`: `dashboard, price-list (roleGuard admin), quotations, quotations/new (wizard 5 pasos), quotations/view/:id, quotations/:id, settings/admin, activity/admin`. `** → /login`.
- Guards: `auth.guard` (localStorage `user+expiresAt`), `role.guard` (`expectedRole:'admin'`). Header/activity muestran etiquetas ES.
- Interceptor `auth.interceptor`: solo `withCredentials:true` si `url.startsWith(environment.apiUrl)`; `401` → logout + `/login`. Ojo: APIs externas (TRM datos.gov.co) sin credentials.
- Servicios: `auth, config, material (preloadAllMaterials), quotation (CRUD + stats), quotation-calculator (espejo back), quotation-logic (jerarquía muebles), quotation-validation (vs 2604), labor-time, temporal, supplier-import, pdf-generator (pdfmake), theme, toast`.
- Modelos `models/interfaces.ts`: `Material, LaborTime, AppConfig, SupplyItem(+_lamina*), EdgeBandItem(+_canto*), AccessoryItem, DesignTimeItem, AssemblyItem/InstallationItem(+_activity*), MesonDetails, Furniture(areaSqm, type standard|custom|meson), Area, Quotation, WizardConfig{clientPriceMode: unit_sqm|manual|outsource|products|'', hardwareDisplayMode, moTimeMode, requiresDesignFiles:null|bool, areaDisplayMode, mesonMode, pricingTier, wizardCompleted}`.
- Componentes: `sidebar (muestra temporales + resume/delete)`, `header`, `material-picker`, `toast`, `main-layout`. Páginas: `login, dashboard (stats + TRM), price-list (CRUD), settings, quotation-list (activas/archivadas, filtro, sort, duplicate, PDF), quotation-view, quotation-wizard, activity`.
- Wizard (`TOTAL_STEPS=5`, `maxSteps=4` en products): 1 Cliente (`quotationForm` name/city/phone/email), 2 Config (5 preguntas: precio, diseño, áreas, mesones, lista precios; en manual se omite 5, en products solo 1), 3 Muebles (áreas + furniture + meson toggle + 7 secciones: supplies, edgeBands, designTime, accessories, assembly, installation + subAreas/visibles), 4 Presupuesto (valida `isStepValid(4)`: mesón precio>0, sin `Est.` ni `unitPrice<=0`), 5 Resumen AIU (edita % imprev/util/indirect/IVA/recargo, `grandTotal`). `autoSave()` en cada `next/prev`: si `activeQuotation._id` existe NO guarda temporal; si no `POST /temporals`. Botonera: Siguiente deshabilitado si `!isStepValid`, Guardar solo en `maxSteps`.
- `src/assets/data/`: `implementation_plan.md`, `excel-formulas.md`, `proveedores-precios.md`, Excels/DOCs, `src/assets/Precios proveedores/`.
- Tests front: `*.spec.ts` + `quotation-wizard-save.spec.ts` (5 tests sanitize/overwrite). Total 24 karma SUCCESS. `npx tsc -p tsconfig.spec.json --noEmit` debe ser exit 0. `npm run test:e2e` → playwright `e2e/mesones.spec.ts`.

## 14. Flujo temporal → cotización + fix 2026-09-18 (crítico, rescatado antiguo)

1. Usuario avanza wizard → `autoSave()` crea/actualiza `Temporal`.
2. Sidebar lista `temporals$` → `resumeTemporal(id)` → `/quotations/new?temporalId=id` → `loadTemporal` (`activeQuotation = temporal.data`).
3. Resumen → `saveQuotation()` → éxito → `deleteTemporal+refreshTemporals()` + `navigate(['/quotations'])`.
4. Si ya existe cotización con mismo `number` → **sobrescribir**, no duplicar.
- Fix síntoma: tras 5 pasos, Guardar no creaba ni desde temporal ni nueva. Causa: solo hacía `PUT` con `_id`; desde temporal siempre `POST`; si `number` duplicado (unique) → `400 E11000`. Solución: front `sanitizeQuotation()` + `GET /quotations?search=<number>` → `PUT existing._id` else `POST` (`handleSaveError` log `[saveQuotation:ctx]`); back `stripTransientKeys()` + `POST` upsert por `findOne({number})` (403 si no-admin ajeno). Verificado con `ng build`, `tsc --noEmit`, `eslint`, `jest`, `karma 24/24`.

## 15. Errores típicos

- `400 Datos inválidos` → `logs/error-*.log` + Network → `errors[]` zod (casi nunca es quotation, es login/material).
- `400 E11000 duplicate key {number}` → ya cubierto por upsert; si aparece, revisar que front/back estén desplegados.
- `401 Token no proporcionado/inválido` → cookie `secure+sameSite:none` exige HTTPS; en local con API prod funciona por `withCredentials`, pero si expiró (8h) → relogin. Interceptor redirige a `/login`.
- `403` → rol no-admin editando ajena o `requireAdmin`.
- `500 Error al obtener número` → `Config{key:'global'}` falta y no se pudo crear.
- Guardar se queda cargando → consola `[saveQuotation:*]`; `isLoading` debe resetearse.
- Render dormido → primer `POST` tarda; calentar con `GET /api/ping`.
- `node_modules` backend ausente tras clone → `npm install` primero.
- Karma `Found 1 load error` + `TS2741/TS2739` → faltan `address/viaticos/installationAddress/sameAddress` en fixtures; ya corregidos.
- `node --check routes/quotations.js` para chequeo rápido de sintaxis backend.

## 16. Reglas y advertencias para agentes

1. **Acceso archivos**: `Get-Content` directo vía PowerShell sobre `Desktop/csv` está bloqueado/falla por permisos en este entorno; preferir herramientas **Read/Glob/Write/Edit** del agente. Si Read falla, usar `bash` + scripts Python en `C:\Users\USUARIO\AppData\Local\Temp\opencode\`.
2. **Seeds destructivos**: `seed-managed-users.js` borra usuarios fuera de lista en cada arranque; `seed.js import` vacía Material/LaborTime/Config. No ejecutar sin respaldo/`export` previo. Envs de Render son prod: no hacer seeds/imports contra prod sin orden explícita.
3. **Cookie `secure:true + sameSite:none` exige HTTPS**: ante `401` hacer relogin (JWT 8h) y no "arreglarlo" quitando `secure`.
4. **`quotationSchema` permisivo**: no confiar en Zod para cotizaciones; fuente de verdad es `recalculateAll` del servidor.
5. **Render free**: primer request ~50s; calentar con `GET /api/ping`. No mover `connectDB()` antes del `listen`.
6. No crear `*.md` ni archivos sin pedirlo (excepción: este `agents.md` pedido explícito). Preferir editar existentes.
7. Tras cada cambio: `npx eslint` + `npm test` (back) y `tsc --noEmit` + `ng build` (front); `ng test` solo si se tocaron specs/wizard.
8. No commitear/pushear sin orden. `git -C ... status/diff/log --oneline -10` antes de cualquier commit.
9. Sanitizar siempre payloads wizard (claves `_ *`) y respetar upsert por `number` + borrado de temporal + `refreshTemporals()`. No cambiar `apiUrl`, CORS, cookies, ni enums `status/wizardConfig/clientPriceMode` sin confirmar.
10. Respuestas cortas, con `ruta:línea` cuando se cite código, y verificar ejecutando.

## 17. Comandos útiles

```powershell
cd "C:\Users\USUARIO\Desktop\csv\csvbkn"  # backend real verificado (csvdemo está vacío de código)
npm install
npm start            # node index.js, PORT o 3000, host 0.0.0.0
npm test             # jest → tests/calculator.test.js (9 tests)
npm run lint         # eslint . → exit 0 esperado
node seed.js export  # exporta a ../scripts/seed-data.json
node seed.js import  # DESTRUCTIVO: vacía y recarga Material/LaborTime/Config
node --check routes/quotations.js
```

```powershell
cd "C:\Users\USUARIO\Desktop\csv\cotizadorspaziovitale"
npm start            # ng serve → http://localhost:4200/
npx ng build --configuration development
npx tsc -p tsconfig.spec.json --noEmit
.\node_modules\.bin\ng.cmd test --watch=false --browsers=ChromeHeadless
npm run test:e2e
```

> Fin agents.md fusionado 2026-09-26. Fuentes: `csvdemo/agents.md` (165 líneas, backend verificado) + `csvbkn/agents.md` (182 líneas, full-stack histórico 2026-09-24). Duplicado `csvdemo/` dejado intencionalmente con copia idéntica; fuente de verdad de código: `csvbkn/`.
