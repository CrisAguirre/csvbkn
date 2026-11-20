# agents.md — Cotizador Spazio Vitale · Backend + Frontend (csvbkn / cotizadorspaziovitale)

> Documento de contexto para agentes IA. Proyecto: **Cotizador Spazio Vitale** (muebles / mesones COMPAC, melamina, tableros, tapacantos, mano de obra).
> Última verificación: 2026-11-20, con `node_modules` instalados. Backend: jest 6 suites / 34 tests propios + eslint 0. Frontend: tsc app+spec 0, `npm run build` OK sin exceder presupuestos, karma 29/29 SUCCESS, Playwright de Proyectos (multiselect y equipo responsable) OK.
> Cambio 2026-11-19 (integridad de precio en insumos): la marca y el color de la melamina se persisten en `SupplyItem` (`brand`, `provider`, `color`, `materialId`, `materialCode`) y la base de M.O. por m² pasó de transitoria (`_sqmPerSheet`/`_laborMinutes`, borradas al guardar) a persistida (`sqmPerSheet`/`laborMinutes`). El calculador usa los campos persistidos con respaldo legacy. Se reconstruye el selector al reabrir (`hydrateSupplyItems`) y ya no se cambia de variante en silencio si el color/marca no existe. Además, `loadQuotation()` dejó de recalcular al leer y `saveQuotation()` no re-guarda una cotización sin cambios. Verificado: jest 23 tests, eslint 0, tsc 0, build prod sin warnings, karma 25/25.
> Cambio 2026-11-19 (Proyectos / UI + multiselect):
> 1. `actors.operarios` es **lista de correos** (`[String]`): el backend acepta string legacy o arreglo y normaliza (trim, sin vacíos, deduplicado); el frontend lo expone con `app-multi-select` en “Nuevo proyecto” y en el panel “Equipo responsable” del detalle.
> 2. `MultiSelectComponent` reutilizable (chips + buscador + panel desplegable) corregido para no cerrarse al seleccionar (`trackByValue` + `event.composedPath()`); `operariosOptions` combina usuarios `diseno` y `admin`.
> 3. Panel “Equipo responsable” editable con borrador `teamDraft` (cancelar no pierde datos); guarda con `PUT /api/projects/:id` enviando solo `{title, clientName, actors}`.
> 4. UI de Proyectos alineada al lenguaje visual corporativo: `.page-header` centrado, `.card glass-panel`, `h3` dorado, labels muted 13–14px sin mayúsculas, badges/chips, checkboxes nativos con `accent-color`, stepper con acento dorado y responsive claro/oscuro.
> Cambio 2026-11-09 (backend + frontend):
> 1. Nuevo modo **Cotización de Diseños** (`wizardConfig.clientPriceMode='design'`): `Quotation.designs[]` (`description, hours, hourlyRate, total`), `calculateDesignTotals` en backend y espejo en frontend (subtotal por horas + descuento + IVA 19% + viáticos), wizard 3 “Diseños” / 4 “Resumen”, PDF y vista con tabla “Servicios de Diseño”.
> 2. `Config.paymentTerms`: la cuota 2 pasa de “ABONO INICIAL DEL 35%” a “SEGUNDO ABONO DEL 35%”; `index.js` migra el texto en la config global existente al arrancar.
> 3. Insumos con `color`; jerarquía de muebles: MESONES en `M2` (ÁREA SOCIAL y ESCRITORIO); en el PDF de cliente los mesones muestran solo título, cantidad y precio (sin descripción/medidas/desglose sensible).
> 4. `calculateProductsTotals` devuelve el objeto `totals`; `POST/PUT /api/quotations` marcan `markModified('designs')`; nuevo test de liquidación de diseños.
> Cambio 2026-11-06:
> 1. Frontend: corrección de compilación en Vercel (presupuestos CSS en `angular.json`: `anyComponentStyle` subido a 20kb/30kb e `initial` a 3.5mb/5mb) y fix de advertencia `NG8107` en `proyectos.component.html` (`q.client.name`).
> 2. Proyectos refinado: desglose completo de etapas 6 (Fabricación/Producción: submódulos 6.1 a 6.6) y 7 (Entrega e Instalación: submódulos 7.1 a 7.4) alineado a `fabricacion y entrega.md`; `actors.operarios` admite selección múltiple (array de correos con nuevo `MultiSelectComponent`).
> 3. Módulo Configuración: reubicación de la descarga del manual PDF directamente en la cabecera (`.page-header` / `.header-actions`) de `settings.component.html`, optimizando la jerarquía visual y eliminando tarjetas redundantes.
> 4. Proyecto Modelo y Documento Técnico: script `seed-demo-project.js` (crea proyecto modelo concluido con los 26 submódulos diligenciados) y manual integral `documento-tecnico-proyectos-y-control.md` con diagramas e imágenes ilustrativas.
> Cambio 2026-10-09: nuevo módulo **Proyectos** (monitor secuencial 7 etapas + estado en tiempo real por paso + tablero global).
> Cambio 2026-09-29: visibilidad global + autor (createdByEmail) + duplicar como mía, sin editar ajenas.
> Nota de rutas: raíz local `C:\Users\USUARIO\Desktop\csv\` → backend `C:\Users\USUARIO\Desktop\csv\csvbkn\` y frontend `C:\Users\USUARIO\Desktop\csv\cotizadorspaziovitale\` (cada uno con su propio `.git`; la raíz `csv/` no es un repo único). `csvdemo/` ya no existe como fuente; ignorar referencias viejas a `csvdemo/agents.md`.

## 1. Dónde está todo

- Raíz local (no es un solo git): `C:\Users\USUARIO\Desktop\csv\`
  - `csvbkn/` — backend Node Express + MongoDB (repo `git+https://github.com/CrisAguirre/csvbkn.git`, tiene su propio `.git`)
  - `cotizadorspaziovitale/` — frontend Angular 16.1.7 (su propio `.git`; `node_modules` instalado 2026-11-19)
  - La raíz `csv/` no contiene un `.git` propio: cada subcarpeta es un repo independiente.
- Producción:
  - Backend: `https://csvbkn.onrender.com/api` (Render free tier, cold start ~50s; calentar con `GET /api/ping`)
  - Frontend apunta a prod incluso en local: `src/environments/environment.ts` y `environment.prod.ts` → `apiUrl: 'https://csvbkn.onrender.com/api'`

## 2. Descripción del proyecto

Backend REST para el cotizador de **Spazio Vitale**. Expone autenticación JWT en cookie httpOnly, CRUD de materiales, configuración global de precios (AIU + IVA), cotizaciones con wizard (5 pasos en frontend), tiempos de mano de obra (MO), temporales (borradores del wizard), manual-entries (log de ítems manuales `_isManual`), auditoría de logins/logouts (Activity) y **proyectos** (monitor secuencial de 7 etapas del local comercial con estado en tiempo real por paso).
Despliegue Render: bind obligatorio a `0.0.0.0` y `PORT` de entorno. TZ forzada a `America/Bogota` en `index.js:2`. Conexión Mongo en background **después** de `app.listen` para no bloquear el puerto.

## 3. Stack y versiones (verificado en package.json backend)

- `engines.node`: `22.x` · `type: commonjs` · `main: index.js`
- `express ^5.2.1` · `mongoose ^9.6.2` · `jsonwebtoken ^9.0.3` · `bcryptjs ^3.0.3`
- `zod ^4.4.3` · `winston ^3.19.0` + `winston-daily-rotate-file ^5.0.0` + `morgan ^1.11.0`
- `@e965/xlsx ^0.20.3` · `cors ^2.8.6` · `cookie-parser ^1.4.7` · `dotenv ^17.4.2`
- Dev: `jest ^30.4.2` · `eslint ^10.8.1` + `@eslint/js ^10.0.1` + `globals ^17.11.0`
- Frontend: Angular **16.1.7**, `ng serve → :4200`, `pdfmake` (PDF), `playwright` (e2e `mesones.spec.ts`), karma 25/25 SUCCESS (2026-11-19). Chrome en `C:\Program Files\Google\Chrome\Application\chrome.exe`. `karma.conf.js` creado 2026-09-18 (no venía en repo). `node_modules` instalados 2026-11-19 (backend 488 paquetes, frontend 1060).

## 4. Estructura backend (raíz `csvbkn/`)

```
index.js                 # app Express, seeds de arranque, auth directo (/login,/register,/activities,/logout,/ping)
models/                  # User, Config, Material, Quotation, LaborTime, Temporal, ManualEntry, Activity, Project
routes/                  # materials, config, quotations, labor, temporals, manualEntries, projects
middleware/              # auth.js, validate.js
utils/                   # calculator.js, schemas.js, logger.js, projectFlow.js
tests/calculator.test.js # 10 casos jest (1 suite)
logs/                    # application-*.log, error-*.log (winston daily-rotate, creado si falta)
seed.js                  # export/import (ver §11)
seed-managed-users.js    # DESTRUCTIVO: purga usuarios fuera de lista (ver §11)
seed-compac-mesones.js   # inserta 11 mesones COMPAC solo si no existen
seed-demo-project.js     # crea/actualiza proyecto modelo 100% concluido (7 etapas / 26 submódulos)
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
- **Config**: `{key:'global' unique, laborRatePerHour 12495, designRatePerHour 16780, unforeseenPercent 10, profitPercent 35, indirectPercent 32, taxPercent 19, defaultDiscount 10, nextQuotationNumber 2700, wasteTable[{minMl,maxMl,factor}], paymentTerms (60/35/5; cuota 2 “SEGUNDO ABONO DEL 35%”), validityDays 3, companyName 'Spazio Vitales sas', city}`. Seed `index.js:131-158`, wasteTable `[1-10:0.5, 11-30:0.35, 31-50:0.3, 51-100:0.25]`. Al arrancar, `connectDB()` migra configs existentes que aún digan “ABONO INICIAL DEL 35%” al texto nuevo.
- **Material**: `{category: melamina|canto|accesorio|herraje|vidrio|meson|laminado|compactslab|duraopak|tablero|otro (required, index), code, description required, provider, brand, color, dimension, unit: LAMINA|ML|UNIDAD|SERVICIO|KIT|TIROS|TIRO|M2|SER|JUEGO default UNIDAD, unitPrice, pricePublic/pricePublicVol/priceIndustrial (escalonados Duropak), pricePerSheet, measure1/2, sqmPerSheet, pricePerSqm, active, calibre, tipo, rigidez, moMinutesPerMl}`.
- **Quotation**: `{number unique required, date, city, installationAddress, sameAddress, client{name required,city,phone,email,address,viaticos}, title, areas[areaSchema], products[{code,description,unit,quantity,unitPriceWithTax,totalWithTax}], designs[{description,hours,hourlyRate,total}] (modo design), totals{...grandTotal,viaticos, porcentajes AIU}, wizardConfig{clientPriceMode: unit_sqm|manual|outsource|products|design, hardwareDisplayMode, moTimeMode, requiresDesignFiles, areaDisplayMode, mesonMode, pricingTier, wizardCompleted}, status: nuevo|borrador|en_revision|auditada|enviada|aceptada|aprobada|rechazada|archivada_aceptada|archivada_rechazada, paymentTerms, validityDays, notes, createdBy ref User required, createdByEmail String '' (snapshot desde 2026-09-29)}` + subesquemas `supply (incluye color)|edgeBand|accessory|designTime|cut|assembly|installation|veneer|mesonDetails|furniture|subArea|visibleAccessory`.
- **LaborTime**: `{code required unique, activityName required, timeHours default 0, category: armado|instalacion|'', minutes, valorMinuto, persons 1, quantity 1, unit: ML|M2|UNIDAD|LAMINA|SERVICIO, isService, notes, active}` + timestamps.
- **Temporal**: `{clientName default 'Sin Nombre', currentStepName, currentStepNumber, data: Mixed, createdBy ref User default null (null = legacy sin autor), createdByEmail String ''}` + timestamps. Borrador del wizard. Legacy previos a 2026-09-29 tienen `createdBy=null` → UI muestra `Sin registro`.
- **ManualEntry**: `{quotationId ref Quotation required, category: insumo|canto|accesorio|armado|instalacion required, description required, details: Mixed}` + índices `{category:1, description:'text'}`, `{quotationId:1}`. Log de ítems `_isManual`.
- **Activity**: `{userEmail required, role required, action: login|logout required, timestamp default now}`.
- **Project** (monitor secuencial, `models/Project.js`): `{title required, clientName required, clientPhone/Email/Address, contactSource: redes|almacen|recomendacion|recurrente|otro, currentStage: inicio|analisis|presentacion|contratacion|preparacion|produccion|instalacion, stageHistory[{stage,changedBy,changedByEmail,changedAt,notes}], stageStates{inicio..instalacion: {status: pendiente|en_curso|completado|devuelto|bloqueado, updatedAt, updatedByEmail, notes}}, actors{asesorComercial,contadora,operarios:[String],disenador,asesorDiseno}, quotationId ref Quotation?, requirement (et1), quotationRef (et2), feedback (et3), contractNumber+designStatus pendiente|en_proceso|aprobado (et4), insumosRequested+insumosNotes (et5), productionNotes + 6.1-6.6 fabricación (et6: contractPlansSigned, contractSigned, appliancesConfirmed, appliancesNotes, orderMelamines/Edges/Fittings/Countertop, orderEstimatedArrival, orderFollowupNotes, targetDeliveryDate, measurementsRectificationDate, mepPlansReady, cuttingListScheduled, productionTasksScheduled, estimatedCompletionDate, mepPlansVerifiedOnSite, rectificationNotes, cutAndEdgePlansDone, assemblyPlansDone, materialsAvailabilityVerified, cuttingDone, edgingDone, assemblyDone, fittingsInstalled, workshopCompletionDone), 7.1-7.4 entrega/instalación (et7: civilWorkFinished, civilWorkNotes, qualityControlFormSigned, qualityControlNotes, deliveryFormSigned, deliveryDate, finalAmount, finalPaymentReceived, deliveryNotes, maintenanceManualDelivered, customerFollowupNotes), priority, notes, active, createdBy, createdByEmail}` + timestamps + índice text `{title,clientName}`. Legacy sin `stageStates` → front deriva de `currentStage`. `operarios` normalizado a array de correos.

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

Routers (`app.use` en `index.js:228-235`):

| Base | Método/Ruta | Auth | Notas |
|---|---|---|---|
| `/api/quotations` | `GET /?status,search,page,limit,sort` | sí, **global desde 2026-09-29 (todos ven todas, sin filtro createdBy)** | select resumido + `createdBy,createdByEmail` + populate, `search` por `client.name` regex o `number` |
| | `GET /stats` | sí, **global (sin filtro por rol)** | counts + suma `totals.grandTotal` mes/histórico |
| | `GET /:id` | sí, global | populate `createdBy` |
| | `POST /` + `quotationSchema` | sí | **UPSERT por número**: `normalizeQuotation` (strip transitorios) → `finalNumber` → si existe → `set+recalculateAll+save` (marca `totals/wizardConfig/products/designs`) → `200 sobrescrita` (no-admin solo si dueño, si no `403`; `createdBy/createdByEmail` se preservan) → si no crea `201` con `createdBy=req.user.id, createdByEmail=req.user.email` |
| | `PUT /:id` + `quotationSchema` | sí | no-admin solo borrador/nuevo propios (`403` si ajena); borra `_id/createdBy/createdByEmail/timestamps`, `recalculateAll`, `markModified('totals/wizardConfig/products/designs')` |
| | `PATCH /:id/status` + `updateQuotationStatusSchema` | admin | enum 10 estados |
| | `POST /:id/duplicate` | sí, cualquiera (incluso ajenas) | nuevo número, status borrador, **`createdBy/createdByEmail = usuario que duplica`** |
| | `DELETE /:id` | admin | |
| `/api/temporals` | `GET /`, `GET /:id` | sí, **global con `populate(createdBy)`** | sort `updatedAt -1` |
| `/api/temporals` | `POST /` (upsert si `_id` válido) | sí, **solo dueño/admin si tiene creador; legacy sin creador lo toma quien lo retoma** | crea con `createdBy/createdByEmail=req.user`; update preserva creador salvo legacy |
| `/api/temporals` | `DELETE /all/cleanup` | **admin (desde 2026-09-29, antes cualquier auth)** | |
| `/api/temporals` | `DELETE /:id` | sí, **solo dueño/admin si tiene creador; legacy cualquiera** | |
| `/api/materials` | `GET /`, `GET /providers`, `GET /brands`, `GET /:id` | sí | filtros por categoría |
| | `POST /`, `PUT /:id`, `DELETE /:id`, `POST /bulk`, `POST /bulk-upsert`, `POST /rename-provider` | admin | `bulk-upsert` usado por scripts import |
| `/api/config` | `GET /` (crea default si falta), `PUT /`, `GET /next-number` (inc y devuelve previo) | leer sí, escribir admin | |
| `/api/labor-times` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /bulk-upsert` | leer sí, escribir admin | |
| `/api/manual-entries` | `GET /`, `DELETE /:id` | sí | |
| `/api/projects` | `GET /?search,stage,contactSource,active,page,limit` | sí, **global (todos los actores ven todo en tiempo real)** | populate `createdBy`, sort `updatedAt -1` |
| `/api/users` | `GET /` | sí | lista `{email,role}` para selects de responsables |
| | `GET /:id` | sí, global | populate `createdBy + quotationId` |
| | `POST /` + `projectSchema` | sí | crea con `createdBy/Email=req.user`, `stageStates=initialStageStates(currentStage)` + historial inicial |
| | `PUT /:id` + `projectSchema` | sí | preserva `createdBy/Email/stageHistory/stageStates`; si cambia `currentStage` valida `isValidTransition + missingExitRequirements` y recalcula `stageStates` |
| | `PATCH /:id/stage` + `updateProjectStageSchema{stage,notes?,feedback?}` | sí | secuencial +/-1 (admin salta); exige puertas por etapa; `presentacion→analisis` guarda `feedback`; recalcula `stageStates` + historial |
| | `PATCH /:id/stage-state` + `updateStageStateSchema{stage,status,notes?}` | sí (`bloqueado` solo admin) | marca Estado de un paso sin mover `currentStage`; historial `Estado <stage> → <status>` |
| | `PATCH /:id/step` + `updateProjectStepSchema{stage,substep?,status?,responsible?,notes?,kind?,reason?}` | sí, **permiso por rol (403 si no responsable/admin)** | actualiza detalle de un subpaso (tiempo real); bloquea campos sensibles para no-admin; soporta `kind` (normal/solicitud_ajuste/ajuste_aplicado) y `reason` |
| | `DELETE /:id` | admin | |

## 8. Lógica de negocio (utils/calculator.js — verificado)

Exports: `recalculateAll, calculateFurnitureTotals, calculateGlobalTotals, calculateProductsTotals, calculateDesignTotals` (+ `getWasteFactor`, `parseMeasurement`).
- `getWasteFactor(quantity, wasteTable)`: busca rango `[minMl,maxMl]`; si excede usa factor del `maxMl` mayor; sin tabla → `0`.
- `parseMeasurement("2.08x0.46")`: normaliza `,`→`.`, minúsculas; si contiene `x|*` multiplica `p1*p2`; si no `parseFloat`; vacío/NaN → `1`.
- `calculateFurnitureTotals(furniture, config)`: insumos (`quantity*unitPrice` + MO por m²), cantos (`quantity + waste + MO/ml`: `waste=quantity*factor`, `moTotal=totalMl*moMinutesPerMl*valorMinuto`), accesorios (+5% si `apply5Percent`), diseño (`quantity*laborRate`), armado/instalación por minutos o fallback horas; acumula `totalSupplies/totalEdgeBands/.../totalCost` y `areaSqm`.
- `calculateGlobalTotals(totalCost, totalSqm, config, existingTotals, mesonSubtotal, mesonTax, viaticos)`: respeta `%` del payload si vienen (`??` config/defaults 10/35/32/19/descuento), `unforeseen/profit/indirect = totalCost*%`, `subtotal = cost+AIU+mesones`, IVA, descuento, `grandTotal + viáticos`. Rama `products` → `calculateProductsTotals`.
- `recalculateAll(quotation, config)`: si `wizardConfig.clientPriceMode==='design'` liquida con `calculateDesignTotals` y retorna; si no, itera `areas[].furniture`, llama `calculateFurnitureTotals`, suma `globalTotalSqm (areaSqm*quantity)`, asigna `quotation.totals = calculateGlobalTotals(...)`. Espejo del front `quotation-calculator.service.ts`.
- `calculateDesignTotals(quotation, config)`: `total = round(hours*hourlyRate)` por ítem, `subtotal = Σtotal`, `discountAmount = round(subtotal*%)`, `taxAmount = round((subtotal-descuento)*taxPercent)` (default 19), `grandTotal = base+IVA+viáticos`; los % AIU quedan en 0. `calculateProductsTotals` ahora retorna el objeto `totals` (no la cotización).
- Normalización en `routes/quotations.js`: `stripTransientKeys(obj)` borra recursivamente claves que empiezan con `_` (ej. `_isManual`, `_lamina*`, `_canto*`, `_activity*`), `normalizeQuotation(data)` lo aplica antes de `recalculateAll`. Ítems manuales se registran además en `ManualEntry`.

## 8b. Lógica de Proyectos (utils/projectFlow.js — lógica vigente al 2026-11-19)

- `STAGES = [inicio, analisis, presentacion, contratacion, preparacion, produccion, instalacion]` + `STAGE_LABELS`, `STAGE_ACTORS` (responsable por etapa), `ROLE_ACTORS` (admin todo; comercial=asesor_comercial; contabilidad=contadora; diseno=disenador+asesor_diseno+operarios).
- `STAGE_DETAILS`: 1 Inicio (contacto + requerimiento) · 2 Análisis (genera cotización) · 3 Presentación (socializa + feedback → avanza a 4 o vuelve a 2) · 4 Contratación (contrato + planos/diseños) · 5 Preparación (insumos + previas) · 6 Producción (fabricación) · 7 Instalación (entrega + pago final).
- `STAGE_STATES = [pendiente|en_curso|completado|devuelto|bloqueado]` + `STAGE_STATE_LABELS`. `initialStageStates(currentStage,email)`: actual `en_curso`, previas `completado`, siguientes `pendiente`. `computeStageStatesOnTransition(prev,from,to,email,notes)`: avance `from=completado→to=en_curso`; retroceso `from=devuelto→to=en_curso` + intermedias a `pendiente`.
- `isValidTransition(from,to,isAdmin)`: `+/-1` salvo admin (cubre `presentacion↔analisis` y `presentacion→contratacion`).
- `missingExitRequirements(from,project,notes)`: `inicio→requirement`, `analisis→quotationId|quotationRef`, `presentacion→notes|feedback`, `contratacion→contractNumber+designStatus=aprobado`, `preparacion→insumosRequested`, `produccion→productionNotes|workshopCompletionDone` (registra avance o finalización de taller), `instalacion→[]`. `routes/projects.js` devuelve `400 + errors[]` si falta; `sanitizeProjectInput` borra `quotationId/deliveryDate` vacíos para evitar cast-error; `normalizeActors` normaliza `actors.operarios` a array único de correos (acepta string legacy, hace `trim`, descarta vacíos y deduplica con `Set`).

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
- `projectSchema`: `{title min1, clientName min1, clientPhone/Email/Address?, contactSource?, currentStage?, stageNotes?, actors{asesorComercial,contadora,operarios: string|string[],disenador,asesorDiseno}?, quotationId?, requirement?, quotationRef?, feedback?, contractNumber?, designStatus?, insumosRequested?, insumosNotes?, productionNotes?, campos 6.1-6.6 fabricación (contractPlansSigned, contractSigned, appliancesConfirmed, appliancesNotes, orderMelamines/Edges/Fittings/Countertop, orderEstimatedArrival, orderFollowupNotes, targetDeliveryDate, measurementsRectificationDate, mepPlansReady, cuttingListScheduled, productionTasksScheduled, estimatedCompletionDate, mepPlansVerifiedOnSite, rectificationNotes, cutAndEdgePlansDone, assemblyPlansDone, materialsAvailabilityVerified, cuttingDone, edgingDone, assemblyDone, fittingsInstalled, workshopCompletionDone), campos 7.1-7.4 instalación (civilWorkFinished, civilWorkNotes, qualityControlFormSigned, qualityControlNotes, deliveryFormSigned, deliveryDate, finalAmount, finalPaymentReceived, deliveryNotes, maintenanceManualDelivered, customerFollowupNotes), priority?, notes?, active?}`.
- `updateProjectStageSchema`: `{stage enum 7, notes?, feedback?}`. `updateStageStateSchema`: `{stage enum 7, status: pendiente|en_curso|completado|devuelto|bloqueado, notes?}`.
- `validate(schema)`: `schema.parse(req.body)` **sin reasignar** el resultado (solo valida); si `ZodError` → `400 {success:false, message:'Datos inválidos...', errors:[{field,message}]}` + `logger.error`; otro error → `500`. Por eso claves no declaradas (`products`, `designs`, `wizardConfig`) llegan intactas a la ruta.

## 11. Scripts seed / import

- `seed.js`: `node seed.js export|import`. Exporta `Material+LaborTime+Config` a `../scripts/seed-data.json`; import hace `deleteMany` + `insertMany` (destructivo en esas 3 colecciones).
- `seed-managed-users.js` (**DESTRUCTIVO, corre en cada arranque** `index.js:123-129`): `KEEP_ADMIN='spaziovitale.gerencia@gmail.com'`; `MANAGED_USERS=[comercial@, contabilidad1@, contabilidad2@, diseno@]` (password por env o defaults `Spazio2026N*`, bcrypt 10); `deleteMany({email:{$nin:keep}})` borra TODO lo demás, luego crea/resetea password+rol de las 4. No correr en dev con usuarios locales sin respaldo.
- `seed-compac-mesones.js` (seguro, `index.js:160-166`): inserta 11 materiales COMPAC (`category:'meson', provider:'COMPAC'`, `measure 1.53x3.66`, `unit M2`) **solo si** `countDocuments({category:'meson',provider:'COMPAC'})===0`.
- `seed-demo-project.js` (seguro): crea o actualiza en base de datos un proyecto modelo 100% concluido ("Cocina Integral e Isla Cuarzo COMPAC - Residencia Altamira 402") con las 7 etapas y sus 26 submódulos diligenciados con datos reales técnicos y comerciales para capacitación y referencia del equipo.
- `import-excel.js / import-mo.js / import-tableros.js / import-tapcantos.js`: bulk-upsert por `POST /api/materials/bulk-upsert`; requieren token admin + API caliente.
- Arranque `index.js:connectDB()`: borra viejo `krontroth@gmail.com`, seed admin/designer por env, `seed-managed-users`, `Config global` si falta (y migra `paymentTerms` a “SEGUNDO ABONO DEL 35%” si aún dice “ABONO INICIAL”), `seed-compac-mesones`.

## 12. Tests y lint backend

- `tests/calculator.test.js` — **10 casos** en la suite propia (`Calculator Utils`): `getWasteFactor`, `calculateFurnitureTotals`, mesones, `calculateGlobalTotals`, `recalculateAll` (incluye liquidación `clientPriceMode==='design'`). Corrida 2026-11-19: `npm test` reporta **2 suites / 19 tests passed** porque jest también descubre la copia git-excluded `.kilo/worktrees/cerulean-raja/tests/calculator.test.js` (9 casos); para medir solo el proyecto, ejecutar en una copia limpia o añadir `testPathIgnorePatterns: ['<rootDir>/.kilo/']`.
- `npm test` → `jest`. `npm run lint` → `eslint .` (config `eslint.config.mjs`: `js.configs.recommended`, ignora `node_modules/**,logs/**`, `no-unused-vars warn` con `argsIgnorePattern ^_`).
- `utils/logger.js`: winston + daily-rotate (`logs/error-%DATE%.log`, `logs/application-%DATE%.log`, 20m/14d/zip) + consola siempre (Render necesita consola para diagnosticar Timeouts).

## 13. Frontend `cotizadorspaziovitale` — Angular 16 (verificado 2026-11-19 con `node_modules` instalados: tsc app+spec 0, `ng build --configuration development` y `npm run build` OK, karma 25/25 SUCCESS, Playwright de Proyectos OK)

- Rutas (`app.module.ts`): `/login` pública; resto bajo `MainLayoutComponent+authGuard`: `dashboard, price-list (roleGuard admin), quotations, quotations/new (wizard 5 pasos), quotations/view/:id, quotations/:id, proyectos (todos los roles), settings/admin, activity/admin`. `** → /login`.
- Guards: `auth.guard` (localStorage `user+expiresAt`), `role.guard` (`expectedRole:'admin'`). Header/activity muestran etiquetas ES.
- Interceptor `auth.interceptor`: solo `withCredentials:true` si `url.startsWith(environment.apiUrl)`; `401` → logout + `/login`. Ojo: APIs externas (TRM datos.gov.co) sin credentials.
- Servicios: `auth`, `config`, `material` (preloadAllMaterials), `quotation` (CRUD + stats), `quotation-calculator` (espejo back, incluye `calculateDesignTotals`), `quotation-logic` (jerarquía muebles), `quotation-validation` (vs 2604), `labor-time`, `temporal`, `supplier-import`, `pdf-generator` (pdfmake; modo design con tabla “Servicios de Diseño” y totales; en cotizaciones normales los mesones se imprimen solo con título/cantidad/precio, sin desglose sensible), `theme`, `toast`, `project` (CRUD + advanceStage + updateStageState + updateStep), `user` (lista de usuarios por rol).
- Modelos `models/interfaces.ts`: `... , Project{title,clientName,contactSource,currentStage,stageHistory,stageStates?, stageDetails?, stepUpdates?, actors{asesorComercial?,contadora?,operarios?: string[],disenador?,asesorDiseno?}, quotationId?, requirement?, quotationRef?, feedback?, contractNumber?, designStatus?, insumosRequested?, insumosNotes?, productionNotes?, needType?, designBudget?, designPaymentReceived?, receptionNotes?, designElaborationNotes?, designPresentationNotes?, materialsConfirmed?, quotationSocializationNotes?, appliancesSocializationNotes?, contractElaborated?, plansElaborated?, documentsSignedClient?, documentsSignedAdmin?, payment60Received?, designerDocumentSent?, materialsOrderReady?, materialsChecklistDone?, contractPlansSigned?, contractSigned?, appliancesConfirmed?, appliancesNotes?, orderMelamines?, orderEdges?, orderFittings?, orderCountertop?, orderEstimatedArrival?, orderFollowupNotes?, targetDeliveryDate?, measurementsRectificationDate?, mepPlansReady?, cuttingListScheduled?, productionTasksScheduled?, estimatedCompletionDate?, mepPlansVerifiedOnSite?, rectificationNotes?, cutAndEdgePlansDone?, assemblyPlansDone?, materialsAvailabilityVerified?, cuttingDone?, edgingDone?, assemblyDone?, fittingsInstalled?, workshopCompletionDone?, civilWorkFinished?, civilWorkNotes?, qualityControlFormSigned?, qualityControlNotes?, deliveryFormSigned?, deliveryDate?, finalAmount?, finalPaymentReceived?, deliveryNotes?, maintenanceManualDelivered?, customerFollowupNotes?}, ProjectStage, ContactSource, StageStateStatus, StepUpdateEntry, StageDetailInfo`. Además: `WizardConfig.clientPriceMode` incluye `'design'`; `DesignItem{description,hours,hourlyRate,total}` + `Quotation.designs?: DesignItem[]`; `SupplyItem.color?`.
- Componentes: `sidebar (+📁 Proyectos global + 📊 Control + temporales globales + autor 👤 + resume/delete con 403)`, `header`, `material-picker`, `toast`, `main-layout`, `multi-select` (selector múltiple reutilizable con chips + buscador + panel desplegable; `@Input options/selected/placeholder/searchPlaceholder/emptyText/disabled`, `@Output selectedChange`; `trackByValue` evita recrear opciones y `event.composedPath()` evita cerrar el panel al hacer clic dentro). Páginas: `login, dashboard (stats globales + TRM), price-list (CRUD), settings (CRUD + botón de descarga del manual PDF integrado en .page-header con responsive), quotation-list (activas/archivadas, filtro, sort por N°/fecha/cliente/ciudad/total/estado/creador, columna Creada por, duplicar 📋, PDF, editar solo propia, eliminar solo admin), quotation-view (muestra Creada por), quotation-wizard (isReadOnly + banner Solo lectura, save bloqueado en ajenas), activity, proyectos (tablero global en tiempo real, stepper consultivo, permisos por rol, ajustes, submódulos 1.1 a 7.4), control (KPIs, alertas, distribución, proyectos en ejecución)`.
- Wizard (`TOTAL_STEPS=5`, `maxSteps=4` en products/design): 1 Cliente (`quotationForm` name/city/phone/email), 2 Config (5 preguntas: precio, diseño, áreas, mesones, lista precios; en manual se omite 5; en products/design solo 1), 3 **Muebles** (áreas + furniture + meson toggle + 7 secciones: supplies, edgeBands, designTime, accessories, assembly, installation + subAreas/visibles), **3 Productos y servicios** (`isProductsMode`) o **3 Diseños** (`isDesignMode`: tabla editable `designs[]` con descripción/horas/tarifa; `addDesign()` usa `designRatePerHour`; válido si hay ≥1 ítem con descripción y horas>0), 4 **Presupuesto** (valida `isStepValid(4)`: mesón precio>0, sin `Est.` ni `unitPrice<=0`) o **Resumen** (products/design), 5 Resumen AIU (edita % imprev/util/indirect/IVA/recargo, `grandTotal`). `autoSave()` en cada `next/prev`: si `activeQuotation._id` existe NO guarda temporal; si no `POST /temporals` (con manejo 403 → suelta `_id` y crea copia propia). `loadTemporal` ajeno → `temporalId=undefined` + toast copia. `loadQuotation` ajena no-admin → `isReadOnly=true` + toast + Guardar deshabilitado. Botonera: Siguiente deshabilitado si `!isStepValid`, Guardar solo en `maxSteps` y si `!isReadOnly`.
- `src/assets/data/`: `implementation_plan.md`, `excel-formulas.md`, `proveedores-precios.md`, Excels/DOCs, `src/assets/Precios proveedores/`.
- Tests front: `*.spec.ts` + `quotation-wizard-save.spec.ts` (5 tests sanitize/overwrite + mock AuthService admin). Corrida 2026-11-19: **25/25 karma SUCCESS**. `npx tsc -p tsconfig.spec.json --noEmit` debe ser exit 0. `npm run test:e2e` → playwright `e2e/mesones.spec.ts`.
- Proyectos (`pages/proyectos/proyectos.component.ts|html|css`, `services/project.service.ts`): tablero global (todos ven todo, sin filtro por dueño) con filtros `search/stage/contactSource/state`, tabla `Trabajo/Cliente/Etapa/Estado del paso/Progreso%`, stepper 7 pasos **consultivo** (clic muestra detalle, no cambia etapa) con badge de Estado + ⛔ bloquear (admin) por paso, panel detalle por etapa (descripción + checklist + submódulos 1.1–7.4 completos basados en manual de fábrica `fabricacion y entrega.md`: 6.1 a 6.6 en Producción y 7.1 a 7.4 en Instalación/Entrega, selector múltiple de operarios con `app-multi-select`, forms detallados + actualización de pasos en tiempo real), `missingFor()` espejo back (etapa 6 pasa con `productionNotes` o `workshopCompletionDone`), `advanceSelected/nextStage/prevStage/sendBackToAnalisis/saveStageData`, permisos por rol, campos sensibles bloqueados con solicitud de ajuste al admin, auto-refresh 15s, progreso `% completado/7`, historial + actualizaciones por paso. `OnDestroy` limpia timer. UI 2026-11-19: `.page-header` centrado, cards `glass-panel`, `h3` dorado, labels muted 13–14px sin mayúsculas, chips/badges y checkboxes con `accent-color`, stepper con acento dorado, responsive claro/oscuro. Panel “Equipo responsable”: lectura en chips + edición con `toggleTeamEdit()` y borrador `teamDraft` (cancelar descarta cambios); operarios con `app-multi-select` (`operariosOptions` = usuarios `diseno`+`admin`); `operariosOf()` tolera string legacy y normaliza a lista; `saveActors()` hace `PUT /api/projects/:id` con `{title, clientName, actors}` y refresca `selected`.
- Presupuestos de build en `angular.json`: `anyComponentStyle` configurado en `20kb` warning y `30kb` error (soporta `proyectos.component.css` de ~17.6 kB / 17,608 bytes, aún bajo el warning, sin fallar el build en Vercel); `initial` en `3.5mb` warning y `5mb` error (build producción 2026-11-19: initial 2.96 MB / 924.75 kB transfer, sin warnings). Plantilla `proyectos.component.html:401` corregida a `q.client.name` (sin `?.`, eliminando warning `NG8107`).

## 14. Flujo temporal → cotización + fix 2026-09-18 + visibilidad global 2026-09-29

1. Usuario avanza wizard → `autoSave()` crea/actualiza `Temporal` con autor.
2. Sidebar lista `temporals$` global con `👤 autor` → `resumeTemporal(id)` → `/quotations/new?temporalId=id` → `loadTemporal` (si ajeno: `temporalId=undefined` + toast copia; `activeQuotation = temporal.data`).
3. Resumen → `saveQuotation()` (bloqueado si `isReadOnly`) → éxito → `deleteTemporal+refreshTemporals()` + `navigate(['/quotations'])`.
4. Si ya existe cotización con mismo `number` → **sobrescribir solo si dueño/admin**, si no `403` (ver §7).
5. Lista `quotations` global con columna `Creada por` (`createdByEmail||createdBy.email||Sin registro`); editar/ciclo de vida solo propias (`canEdit()` por email, admin todo); **duplicar 📋** cualquiera → copia a tu nombre.
- Fix 2026-09-18 síntoma: tras 5 pasos, Guardar no creaba ni desde temporal ni nueva. Causa: solo hacía `PUT` con `_id`; desde temporal siempre `POST`; si `number` duplicado (unique) → `400 E11000`. Solución: front `sanitizeQuotation()` + `GET /quotations?search=<number>` → `PUT existing._id` else `POST` (`handleSaveError` log `[saveQuotation:ctx]`); back `stripTransientKeys()` + `POST` upsert por `findOne({number})` (403 si no-admin ajeno). Verificado con `ng build`, `tsc --noEmit`, `eslint`, `jest`, `karma 24/24`.

## 14b. Flujo proyectos (monitor secuencial 7 etapas + estado por paso, 2026-10-09)

1. Crear en `📁 Proyectos → Nuevo proyecto` (título + cliente + fuente `redes|almacen|recomendacion|recurrente` + prioridad + actores) → `POST /api/projects` → `stageStates.inicio=en_curso`.
2. Etapa actual muestra descripción + checklist + form de su puerta de salida → `💾 Guardar datos etapa` (`PUT /:id`) → `Siguiente` (`PATCH /:id/stage`) valida puertas; si falta → `400/ warn` con campo (`requirement|quotation|feedback|contractNumber+design|insumos|productionNotes`).
3. Presentación: `✓ Aprobar → Contratación` o `↩ Devolver a Análisis` (ambas exigen feedback; la devolución marca `presentacion=devuelto, analisis=en_curso`).
4. Cualquier paso puede marcarse `bloqueado` (⛔, solo admin) vía `PATCH /:id/stage-state`; historial registra `Estado <stage> → <status>`.
5. Tablero global auto-refresca 15s: todos los actores ven `Etapa + Estado del paso + Progreso% + updatedByEmail + updatedAt`; filtro por Estado; `selected` se re-sincroniza por `_id` sin perder detalle.
6. Equipo responsable: el detalle muestra los responsables en chips; `✎ Editar equipo` habilita selects + multiselect de operarios sobre `teamDraft`; `Guardar equipo` → `PUT /:id` con payload mínimo → toast + refresco; `Cancelar` descarta el borrador.
7. Verificación Playwright (2026-11-19): el multiselect permanece abierto al seleccionar y muestra chips; la edición del equipo guarda `operarios` como arreglo (`["diseno@spaziovitale.com","operario1@spaziovitale.com","operario2@spaziovitale.com"]`); capturas en tema oscuro/claro y móvil en `C:\Users\USUARIO\AppData\Local\Temp\opencode\`.

## 14c. Cotización de Diseños (modo `design`, 2026-11-09)

1. En Configuración (paso 2) se elige “Cotización de diseños” → `clientPriceMode='design'`; el wizard queda en 4 pasos: Cliente → Configuración → Diseños → Resumen (sin preguntas 2–5 de muebles).
2. Paso 3: “+ Agregar ítem de diseño” crea `{description, hours, hourlyRate = config.designRatePerHour, total}`; `recalculate()` usa `QuotationCalculatorService` → `calculateDesignTotals` (subtotal por horas, descuento, IVA, viáticos). `isStepValid(3)` exige ≥1 ítem con descripción y horas>0.
3. Guardar usa el mismo flujo existente (upsert por `number`); el backend recalcula con `calculateDesignTotals` y `POST/PUT` marcan `markModified('designs')`.
4. Vista y PDF muestran “Servicios de Diseño” (descripción, horas, tarifa/hora, total) + subtotal/descuento/IVA/viáticos/total.
5. En cotizaciones normales, el PDF imprime los mesones solo con título, cantidad y precio unitario/total (sin descripción, medidas ni desglose interno).

## 15. Errores típicos

- `400 Datos inválidos` → `logs/error-*.log` + Network → `errors[]` zod (casi nunca es quotation, es login/material).
- `400 E11000 duplicate key {number}` → ya cubierto por upsert; si aparece, revisar que front/back estén desplegados.
- `401 Token no proporcionado/inválido` → cookie `secure+sameSite:none` exige HTTPS; en local con API prod funciona por `withCredentials`, pero si expiró (8h) → relogin. Interceptor redirige a `/login`.
- `403` → (a) no-admin editando cotización ajena (`PUT /:id`, upsert `POST /`), (b) editando/borrando temporal ajeno (`POST /temporals`, `DELETE /temporals/:id`), (c) `requireAdmin` (`PATCH status`, `DELETE quotation`, `DELETE temporals/all/cleanup`, `DELETE project`, `PATCH project stage-state→bloqueado`).
- Proyectos `400 Faltan requisitos...` → completar puerta de la etapa actual (ver §8b/14b); `403 no secuencial` → avanzar/retroceder de a 1 (admin puede saltar).
- `500 Error al obtener número` → `Config{key:'global'}` falta y no se pudo crear.
- Guardar se queda cargando → consola `[saveQuotation:*]`; `isLoading` debe resetearse. Si `isReadOnly`, Guardar deshabilitado a propósito.
- Render dormido → primer `POST` tarda; calentar con `GET /api/ping`.
- `node_modules` ausente tras clone → `npm install` primero (front 1060 paquetes, ~34s).
- Karma `Found 1 load error` + `TS2741/TS2739` → faltan `address/viaticos/installationAddress/sameAddress` en fixtures; ya corregidos. Spec wizard requiere mock `AuthService` (admin) por nuevo constructor con `isReadOnly`.
- Multiselect se cerraba al seleccionar un operario → Angular recreaba las opciones en cada cambio y el clic se interpretaba como “fuera”. Fix: `trackByValue` en el `*ngFor` y `event.composedPath()` en `onDocumentClick()`; `Escape` cierra el panel.
- `operarios` como string en documentos legacy → el front lo tolera con `operariosOf()` (convierte a `[valor]`, trim, filtra vacíos) y el back con `normalizeActors()` (acepta string o arreglo, deduplica). No asumir siempre `string[]` al leer datos viejos.
- Mesones: la unidad correcta es `M2`; al marcar un mueble como mesón el wizard fuerza `unit='M2'`. En el PDF de cliente el mesón va solo con título/cantidad/precio (sin desglose).
- `jest-haste-map: Haste module naming collision: csvbkn` al correr `npm test` → hay un worktree/duplicado bajo `.kilo/worktrees/cerulean-raja` (git-excluded) con su propio `package.json` y tests; jest lo cuenta como segunda suite (19 tests en total). No es un fallo del proyecto: ignorar `.kilo` con `testPathIgnorePatterns` o ejecutar en una copia sin worktrees.
- `node --check routes/quotations.js` y `routes/temporals.js` para chequeo rápido backend.
- Proyectos: `node --check models/Project.js && node --check routes/projects.js && node --check utils/projectFlow.js && node --check utils/schemas.js`; lógica pura verificable con `node -e "require('./utils/projectFlow')"` (`initialStageStates/computeStageStatesOnTransition/missingExitRequirements`).
- `Budget exceeded maximum budget` en build Angular (`npm run build` en Vercel o local): `angular.json` define presupuestos por componente (`anyComponentStyle`) e `initial`. Estilos extensos como `proyectos.component.css` superan el límite original de 10kb (hoy ~17.6 kB); se soluciona elevando en `angular.json` `anyComponentStyle` a `maximumWarning: 20kb, maximumError: 30kb` e `initial` a `maximumWarning: 3.5mb, maximumError: 5mb`.
- `warning NG8107: The left side of this optional chain operation does not include 'null' or 'undefined'`: Angular template type checking estricto no permite `?.` en expresiones donde el tipo TypeScript no incluye null/undefined (ej. `q.client?.name` cuando `client: QuotationClient`). Se reemplaza por `.` directo (`q.client.name`).

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
cd "C:\Users\USUARIO\Desktop\csv\csvbkn"  # backend
npm install
npm start            # node index.js, PORT o 3000, host 0.0.0.0
npm test             # jest → proyecto: 1 suite/10 casos; con .kilo/worktrees: 2 suites/19
npm run lint         # eslint . → exit 0 esperado
node seed.js export  # exporta a ../scripts/seed-data.json
node seed.js import  # DESTRUCTIVO: vacía y recarga Material/LaborTime/Config
node --check routes/quotations.js
node --check routes/temporals.js
node --check routes/projects.js
```

```powershell
cd "C:\Users\USUARIO\Desktop\csv\cotizadorspaziovitale"
npm start            # ng serve → http://localhost:4200/
npm run build        # compilación de producción con presupuestos en angular.json
npx ng build --configuration development
npx tsc -p tsconfig.spec.json --noEmit
.\node_modules\.bin\ng.cmd test --watch=false --browsers=ChromeHeadless
npm run test:e2e
```

> Fin agents.md actualizado 2026-11-19. Cambios recientes: (1) Multiselect de operarios + panel “Equipo responsable” editable con `teamDraft`; `actors.operarios` normalizado a `[String]` (string legacy soportado) y UI de Proyectos alineada al lenguaje visual corporativo (`.page-header`, cards glass, chips, badges, checkboxes, stepper dorado); (2) Modo Cotización de Diseños (`clientPriceMode='design'`, `designs[]`, `calculateDesignTotals` en back/front, wizard 3 Diseños / 4 Resumen, PDF y vista “Servicios de Diseño”); (3) `paymentTerms` cuota 2 “SEGUNDO ABONO DEL 35%” con migración de la config global existente; (4) Insumos con `color`, MESONES en `M2` y PDF de mesones sin desglose sensible; (5) Presupuestos `angular.json` (20kb/30kb y 3.5mb/5mb), manual PDF en la cabecera de Configuración, `seed-demo-project.js` y documento técnico. Verificación 2026-11-19: backend jest 2 suites/19 tests (10 propios + 9 del worktree `.kilo`) + eslint 0; frontend tsc app+spec 0, build dev y prod OK sin warnings de presupuesto, karma 25/25 y Playwright de Proyectos OK. Auditoría previa 2026-09-29: (1) CORS `origin:true + credentials:true` refleja cualquier origen — endurecer a whitelist de dominios front en prod; (2) sin rate-limit en `/api/login` — agregar express-rate-limit; (3) UI gates por email/localStorage son cosméticos, enforcement real en backend por id/JWT — OK; (4) `seed-managed-users` resetea passwords en cada arranque — no correr contra prod sin aviso.

## 18. Auditoría 2026-09-29 (resumen)

- Backend: JWT 8h cookie httpOnly secure sameSite:none OK; `authMiddleware` acepta cookie o Bearer OK; `requireAdmin` OK; quotations global-read + owner-write + admin-delete OK; temporals owner-check robusto a populate (`_id?.toString()||toString()`) OK; `quotationSchema` permisivo + `recalculateAll` OK; seeds destructivos documentados OK; hallazgos: CORS abierto + sin rate-limit (ver Fin).
- Frontend: `authGuard` localStorage + `roleGuard` expectedRole OK; interceptor solo `withCredentials` a backend propio OK + 401→login OK; `canEdit()` por email + `isAdmin()` por role OK cosmético; wizard `isReadOnly` + copia de temporal ajeno OK; specs con mock AuthService OK 24/24.

## 19. Backup y restauración (Fase 0, 2026-11-19)

- `scripts/backup.js`: exporta todas las colecciones a NDJSON en EJSON (preserva `ObjectId`, `Date`, `Decimal128`), guarda los **índices** de cada colección, comprime con gzip y cifra con **AES-256-GCM**. Genera `manifest.json` con conteo, `ndjsonSha256`, `idsSha256` e índices por colección, más el SHA-256 del archivo.
- `scripts/restore.js`: `--dry-run` descifra y compara contra el manifiesto sin escribir; sin flag restaura (exige `--yes`, rechaza la misma base de origen), recrea índices y revalida conteos y `_id`. Nunca restaurar sobre `spaziovitale` sin orden explícita.
- La clave del backup **no** se guarda en la carpeta ni en el repo: en esta máquina está en `C:\Users\USUARIO\AppData\Local\Temp\opencode\spaziovitale-backup-key.txt`; moverla a un gestor de contraseñas. Sin la clave el backup es irrecuperable.
- `.env` local creado con `MONGODB_URI` de producción (ya en `.gitignore`); no commitear ni compartir.
- Backup verificado 2026-11-19_1252: 10 colecciones / 1764 documentos / 0.11 MB, SHA-256 `78eb4e1acf...`. Restauración probada en `spaziovitale_verificacion` (conteos, `_id` e índices OK) y base de prueba eliminada.
- Hallazgos de datos para las siguientes fases: `Config.laborRatePerHour=12495` → 208.25/min (no 250); 46 cotizaciones (43 `nuevo`, 2 `aceptada`, 1 `borrador`), todas `clientPriceMode=manual`; 27/46 con `paymentTerms` "ABONO INICIAL DEL 35%"; 36 con `hardwareDisplayMode=table`; 415 herrajes con precio guardado; 147 insumos y **0 con marca persistida** (la marca histórica no es recuperable de forma fiable, solo cruzando el catálogo de materiales); 0 con `presentedAt`. Existe una colección vacía `_diag_tmp_quotations` (artefacto de diagnóstico, sin datos).
- Nota técnica: no usar `for await` sobre un `Transform` propio para NDJSON; el iterador del stream devuelve el búfer acumulado completo, no cada `push`. Usar `readline` o `readable.read(size)`.

## 20. Fix marca/color de melamina y estabilidad de precio (2026-11-19)

Causa raíz confirmada:

- `applySupplyMaterial()` escribía el **proveedor** en `providerColor` y nunca `color` ni la marca; `SupplyItem` no tenía `brand` y Mongoose descartaba el campo en silencio.
- `_sqmPerSheet`/`_laborMinutes` son transitorios: `sanitizeQuotation()` (front) y `stripTransientKeys()` (back) los borran al guardar. Al reabrir, la mano de obra por m² desaparecía y el total bajaba.
- `resolveSupplyMaterial()` devolvía `filtered[0]`: si la marca/color elegida no existía, cambiaba de variante (y de precio) sin avisar.

Cambios aplicados:

- `models/Quotation.js`: `supplyItemSchema` con `brand`, `provider`, `materialId`, `materialCode`, `color`, `sqmPerSheet`, `laborMinutes`.
- `utils/calculator.js` y `quotation-calculator.service.ts`: usan `sqmPerSheet`/`laborMinutes` persistidos; los `_` quedan como respaldo legacy.
- Wizard: `applySupplyMaterial()` persiste identidad y base de M.O.; `hydrateSupplyItems()` reconstruye `_lamina/_colorGroup/_brand/_materialLabel` al abrir; `brandsFor()` filtra marcas por color; `resolveSupplyMaterial()` no reasigna si la combinación no existe en el catálogo.
- Tests: `tests/calculator.test.js` (M.O. con campos persistidos + respaldo legacy) y `tests/quotation-schema.test.js` (round-trip del esquema y documentos legacy).

> Cambio 2026-11-19 (Fases 2–4 del plan de 8 necesidades): `presentedAt`/versionado con edición solo admin, redacción de precios de herrajes para no-admin en API/PDF/pantalla, minuto de M.O. a 250 (config + 53 LaborTime), botón Restablecer, fusión de cotizaciones (7 días, solo admin) y texto “Segundo Abono del 35%” en 27 cotizaciones. Verificado: jest 34 tests, eslint 0, tsc 0, build OK, karma 29/29. **Sin commits ni push.**

## 23. Herrajes 26142*: estado final y PDF alterno (2026-11-20)

**Estado correcto = el de ayer en la tarde.** La tarde del 19 se eliminaron herrajes intencionalmente (17 en 261425, 22 en 261428, 22 en 2614212, etc.) y se agregaron otros (conector LED, touch, fuente 12V 20A en 261421…). La copia `safe/backup.ndjson.gz.enc` (12:53 del 19) es **anterior** a esos cambios y no es fuente de verdad.

- Copia `safe/antes-reparacion-2026-11-20\` (14:59 del 20, SHA-256 `2c0feaf1…`): captura exactamente el estado de ayer en la tarde. Es la referencia para las 26142*.
- Error corregido: `scripts/restore-hardware-26142.js` había reintroducido 119 herrajes borrados ayer desde la copia de las 12:53. **No volver a ejecutarlo.**
- `scripts/revert-hardware-repair.js` revirtió esos 13 documentos desde la copia de las 14:59. Verificado: **15/15 cotizaciones 26142\* idénticas** a esa copia en herrajes, precios, totales y modo.
- El paso 4 (Presupuesto) conserva su código original: tabla de herrajes con precios, sumados al total por `recalculateAll`. El modo `hardwareDisplayMode` afecta **solo** al PDF.
- PDF alterno para admin: `PdfGeneratorService.generateHardwarePricesPdf()` clona la cotización y fuerza `hardwareDisplayMode='table'` sin mutar el documento; botones 📄💲 en el listado y “PDF herrajes con precios” en el wizard.

## 21. Snapshot de precio por ítem (2026-11-19)

Para que **editar** una cotización antigua no reprecie ítems no tocados (y para poder subir la M.O. a 250 sin afectar históricos):

- `supplyItemSchema.effectiveUnitPrice`: precio unitario efectivo congelado (material + M.O./m²). Si es > 0, manda sobre `unitPrice` en `calculator.js` y en `quotation-calculator.service.ts`. Se calcula la primera vez y se persiste.
- `edgeBandItemSchema.valorMinuto`: valor del minuto congelado del canto; se usa en vez de la tarifa global si es > 0.
- El wizard deriva estos valores al abrir (`hydrateSupplyItems`): `effectiveUnitPrice = totalPrice / qty` y `valorMinuto = moTotal / (total × moMinutesPerMl)`. No inventa datos: solo conserva el precio ya acordado.
- Se invalidan explícitamente al cambiar de material (`applySupplyMaterial`, `applyEdgeMaterial`) o al editar precio/modalidad (`onSupplyPriceChange`, `onSupplyModeChange`), para que esos ítems sí se recalculen con la tarifa vigente.
- Tests: 4 nuevos casos en `tests/calculator.test.js` (precio congelado, persistencia entre recálculos, canto con tarifa congelada) y schema de Mongoose. Verificado: jest 27 tests, eslint 0, tsc app+spec 0, build prod OK, karma 28/28.

## 22. Presentación, versionado, herrajes, 250, reset y fusión (2026-11-19)

**Presentación y versionado** (`models/Quotation.js`, `routes/quotations.js`, `utils/quotation-versioning.js`):
- `presentedAt`, `presentedBy`, `version`, `versionHistory[{version,changedAt,changedBy,changedByEmail,reason,snapshot}]`.
- `POST /api/quotations/:id/present` (dueño o admin) marca el punto de inflexión. Pasar a estado `enviada` también lo marca.
- PUT / POST-upsert: si `presentedAt` existe, los no-admin reciben 403; un admin edita y `recordVersion()` guarda la versión anterior **en el mismo documento** (nunca duplica). El payload no puede falsificar `presentedAt/version/versionHistory`.
- La copia (`/duplicate`) nace como borrador sin presentación ni historial. Front: badge `vN · presentada`, botón 📤, `canEdit()` y `checkReadOnly()` respetan `presentedAt`.

**Herrajes sin precios para no-admin** (`utils/hardware-redaction.js`):
- `GET /:id`, respuestas de POST/PUT/duplicate/present redactan `unitPrice/totalPrice/laborRate/totalWithTax` de `accessories` para no-admin.
- El servidor captura y restaura las bases de precio antes de `recalculateAll`, para que editar cantidades como no-admin no destruya precios.
- PDF: columna “Total” y “Subtotal Herrajes” solo para admin. El dropdown “Tabla separada con precios” solo para admin (si una cotización vieja la traía, se conmuta a `included`).
- **Aclaración final 2026-11-19:** el dropdown `hardwareDisplayMode` del paso 3 afecta **únicamente al PDF**. El **paso 4 (Presupuesto) NO se modificó**: se restauró byte a byte desde `e3bb7e4` (tabla de herrajes original, columnas de precio y línea “Accesorios: $” intactas, `isStepValid(4)` original). `canSeeHardwarePrices` solo se usa en el panel “Herrajes por mueble” del paso 3. Los intentos de acoplar el paso 4 al modo o al rol fueron revertidos a petición del usuario. Tests: 29/29 karma.

**Minuto a 250**: `scripts/set-labor-rate-250.js --apply` ejecutado en producción: `Config.laborRatePerHour 12495 → 15000` y 53 `LaborTime.valorMinuto 208.25 → 250` (idempotente, verificado en second run). Defaults de `Config.js` e `index.js` actualizados a 15000. Cotizaciones históricas intactas gracias al snapshot por ítem.

**Restablecer** (wizard): `captureInitialState()` al abrir/crear (incluye paso del wizard) y `resetChanges()` restaura el estado, rehidrata y vuelve al paso inicial (nuevas → paso 1). Botón “↺ Restablecer cambios” en la barra de acciones.

**Fusión** (`utils/quotation-merge.js`): `GET /:id/merge-candidates` (solo admin) lista cotizaciones del mismo cliente en ±7 días; `POST /:id/merge` crea UNA cotización consolidada con nuevo número, agrupando áreas/muebles y sumando cantidades e ítems, con `mergedFrom` para auditoría. Los números de origen NO van en `notes` (que sí se imprime en el PDF). Front: botón 🔗 + modal con `app-multi-select`.

**Condiciones comerciales**: `scripts/fix-payment-terms.js --apply` corrigió 27 cotizaciones de “ABONO INICIAL DEL 35%” a “Segundo Abono del 35%”, sin tocar totales. La config global ya tenía el texto nuevo desde 2026-11-09.

Pendiente conocido: las 46 cotizaciones históricas no tienen `sqmPerSheet`/`laborMinutes` ni marca/color. Desde el 2026-11-19 la **lectura está congelada**: `loadQuotation()` ya no llama a `recalculate()`, `loadConfig()` no sobrescribe porcentajes ni totales de una cotización con `_id`, `nextStep()` recalcula solo si hay cambios reales (`recalculateIfChanged`), `initialSnapshot` detecta cambios reales y `saveQuotation()` no re-guarda una cotización sin cambios; `buildMOActivities()` ya no rellena `minutes/valorMinuto` al leer. Verificado contra producción: las 46 cotizaciones tienen `totals` completos (ninguna con `grandTotal` 0), así que se muestran tal cual se guardaron. Riesgo remanente: al **editar** una cotización histórica con insumos por m² (119 de 139 sin base de M.O.), el recálculo explícito aún puede repreciar ítems no tocados; se cierra con el snapshot por cotización (config + totales) en la siguiente fase. No se inventaron marcas.
