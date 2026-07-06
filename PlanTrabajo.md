# 🗺️ PlanTrabajo — Ruta de ejecución del EFT (documento de avance VIVO)

> **Qué es este documento:** el CÓMO y EN QUÉ ORDEN. Cada paso indica la sección del
> `Informe_EFT.txt` que lo documenta y la foto que se captura ahí (♻️ reciclada de P3 o 📸 nueva).
> **Cuando preguntes "¿en qué parte vamos?", la respuesta sale de aquí.**
> Estados: ✅ hecho · 🔄 en curso · ⬜ pendiente. El checklist de requisitos vive en [PautaExamen.md](PautaExamen.md).

**Última actualización:** 2026-07-05 — Fases A, B y **C COMPLETAS**. Infra AWS creada
(VPC, EKS `tienda-eks`, node group 2×t3.medium, 3 repos ECR, Account ID `618629205592`).
Pipeline completo **verde** (fix: `trivy-action@master`). App expuesta por ELB
(`af52da...elb.amazonaws.com`). Mejora seguridad: NetworkPolicy `db-allow-backend-only`
aplicada con enforcement VPC CNI ON (bloquea frontend→DB, permite backend→DB).
**SIGUIENTE:** Fase D — evidencias nuevas (pipeline/ELB/HPA/NetworkPolicy), reestructurar
informe a 9 puntos EFT, prueba de carga HPA, CloudWatch, diagrama, DOCX y PPT.

---

## FASE A — Montaje del proyecto y repo Git

| # | Paso | Estado | Sección informe | Foto |
|---|---|---|---|---|
| A1 | Copiar base reutilizable desde Prueba3 (código, k8s, workflow, fotos, informe TXT) | ✅ | — | — |
| A2 | Crear `PautaExamen.md` + `PlanTrabajo.md` | ✅ | — | — |
| A3 | `git init` + commit inicial `feat(app): base tienda perritos (frontend+backend+db+k8s)` — `154ed23` | ✅ | §Repositorio | — |
| A4 | Repo GitHub público `tienda-perritos-eft` creado + push exitoso (8 commits, HEAD `83225d4`). Fotos IE2_compose_up/IE2_app_local/IE3_npm_test_local ya en `fotos/` | ✅ | §Repositorio | 📸 luego (estructura repo/commits, para IE1) |
| A5 | Adaptar `README.md` al EFT | ✅ | — | — |

**Commits planificados (IE1 evalúa el historial — uno por etapa, convención `tipo(área): descripción`):**
1. `feat(app): base tienda perritos...` (A3)
2. `build(docker): dockerfiles multietapa + .dockerignore` (B2)
3. `feat(compose): entorno de desarrollo local con docker-compose` (B1)
4. `test(backend): tests unitarios API con jest + supertest` (B3)
5. `ci(pipeline): etapa de test + escaneo trivy` (B4)
6. `docs(readme): guía EFT` (A5)
7. …infra/ajustes/docs según avancen C y D.

---

## FASE B — Brechas técnicas (lo nuevo del EFT)

| # | Paso | Estado | Sección informe | Foto |
|---|---|---|---|---|
| B1 | `docker-compose.yml`: servicios db (healthcheck) → backend (depends_on) → frontend (8080:80), red `perritos`, volumen BD, password vía `.env` — commit `dc3730d` | ✅ | §2 Contenedores | 📸 `IE2_compose_up.png` |
| B2 | Backend Dockerfile **multietapa** (`deps` → runtime, `USER node`) + `.dockerignore` ×3 — commit `fdf4268`. Imágenes: frontend 93MB, backend 192MB | ✅ | §2 Contenedores + §8 Seguridad | — |
| B3 | Tests: `backend/app.js` (exporta app) separado de `server.js` (listen); Jest+supertest, mock de `mysql2/promise`; 7 tests verdes — commit `796d99d` | ✅ | §4 CI/CD | 📸 `IE3_npm_test_local.png` |
| B4 | Pipeline: job `test` (node, sin secrets) → `build-and-deploy` con `needs: test` + 3 pasos **Trivy** (HIGH/CRITICAL, informativo) entre build y push — commit `891ab86` | ✅ | §4 CI/CD + §8 Seguridad | 📸 luego en C (corrida real) |
| B5 | Verificación local: 7/7 tests + `docker compose up --build` → health ok, 5 productos semilla, POST/DELETE OK vía proxy nginx, backend corre como `node` (non-root) | ✅ | §2 Contenedores | 📸 `IE2_app_local.png` |

---

## FASE C — Infraestructura AWS desde 0 (receta P3, usuario por consola, Claude guía)

> ⚠️ El Learner Lab nuevo puede tener **otro Account ID** → actualizar registry en los 3 `k8s/*-deployment.yaml` (C5).
> ⚠️ Al cerrar cada sesión: node group a 0. Antes de la demo: revivir 2/2 (~5 min). Costo encendido ≈ $22/día.

| # | Paso | Estado | Sección informe | Foto |
|---|---|---|---|---|
| C1 | VPC `tienda-vpc` 10.0.0.0/16, 2 AZ, 2 públicas + 4 privadas, 1 NAT | ⬜ | §5 Infraestructura | ♻️ `IE1_01..05` (misma receta; recapturar solo si cambia algo) |
| C2 | Clúster EKS `tienda-eks`: LabRole, auth API, endpoint público y privado, observabilidad OFF, complementos CoreDNS/kube-proxy/VPC CNI/**Metrics Server**. ⚠️ En el add-on **VPC CNI** activar **Enable Network Policy** (necesario para C9) | ⬜ | §5 Infra + §9 Orquestación | ♻️ `IE1_06..14` |
| C3 | Node group `tienda-nodes`: AL2023, t3.medium, 2/2/4, 4 subredes privadas, SSH off | ⬜ | §5 Infra | ♻️ `IE1_15..20` |
| C4 | 3 repos ECR (`tienda-frontend/backend/db`, Mutable, AES-256) | ⬜ | §3 Registro | ♻️ `IE2_01_ecr_repos.png` |
| C5 | Actualizar Account ID en `k8s/*-deployment.yaml` + commit | ⬜ | §3 Registro | — |
| C6 | GitHub Environment `production` + 7 secrets (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_REGION, EKS_CLUSTER_NAME, EKS_NAMESPACE, MYSQL_ROOT_PASSWORD — usar una fuerte esta vez) | ⬜ | §6 Secretos | ♻️ `IE5_01/IE5_02` (renombrar) |
| C7 | Push a main → pipeline completo verde | ⬜ | §4 CI/CD | 📸 `IE3_job_test_actions.png`, `IE3_trivy_scan.png`, `IE3_pipeline_verde.png`, `IE3_ecr_tags.png` |
| C8 | EXTERNAL-IP del ELB → app en navegador | ⬜ | §5 Infra + §9 | 📸 `IE5_app_elb.png` (♻️ referencia: IE2_02/03/04 de P3) |
| C9 | **MEJORA seguridad:** aplicar `k8s/db-networkpolicy.yaml` (aísla la BD: solo backend→3306) + prueba de bloqueo desde frontend. Requiere Enable Network Policy en VPC CNI (C2) | ⬜ | §5 Infra + §8 Seguridad | 📸 `IE1_21_networkpolicy_db.png` (nueva) |

---

## FASE D — Evidencias, informe y presentación

| # | Paso | Estado | Sección informe | Foto |
|---|---|---|---|---|
| D1 | Reestructurar `Informe_EFT.txt` a los 9 puntos del EFT, con slots `[FOTO: nombre.png]` 1:1 con `fotos/` | ⬜ | todo | — |
| D2 | Depurar/renombrar fotos recicladas según el mapa de abajo | ⬜ | todo | — |
| D3 | Prueba de carga (busybox wget loop a `/api/health`) → HPA escala → scale-down | ⬜ | §9 Orquestación | 📸 `IE4_hpa_escalando.png` (♻️ referencia IE3_01..04 P3) |
| D4 | Verificación: CRUD en nube, autorrecuperación (borrar pod), logs `kubectl` | ⬜ | §7 Observabilidad + IE5 | 📸 `IE5_crud_cloud.png` (♻️ IE7_01..04 P3) |
| D5 | CloudWatch: activar logs API/Audit → captura → **desactivar** | ⬜ | §7 Observabilidad | 📸 `IE5_cloudwatch.png` |
| D6 | Actualizar `arquitectura.svg` (agregar compose local + etapa test + Trivy) → PNG | ⬜ | §4 + diagrama | — |
| D7 | Convertir `Informe_EFT.txt` → **`Informe_EFT.docx`** (Word exigido) con fotos y diagrama embebidos | ⬜ | — | — |
| D8 | Presentación PPT (10–15 min): arquitectura → compose local → pipeline en vivo → EKS/HPA → seguridad/observabilidad → mejoras | ⬜ | — | — |
| D9 | Subir informe + link repo + PPT al **AVA** · ensayo de defensa (preguntas §6 de PautaExamen) | ⬜ | — | — |

---

## 🖼️ Mapa de reciclaje de fotos P3 → EFT

La rúbrica cambió de numeración: lo que en P3 era IE1(infra)/IE2(LB)/IE3(HPA)/IE4(pipeline)/IE5(secrets)/IE6(logs)/IE7(verificación)
en el EFT es IE1(git+diagrama)/IE2(contenedores local)/IE3(pipeline)/IE4(nube+EKS)/IE5(verificación)/IE6(presentación).

| Fotos P3 (en `fotos/`) | Contenido | Sirven para EFT | Acción |
|---|---|---|---|
| `IE1_01..20` (20) | VPC, wizard EKS, node group, nodos EC2 | **IE4** (infra/orquestación) | ♻️ Reciclar si la infra nueva queda idéntica (misma receta); renombrar a `IE4_*` en D2 |
| `IE2_01` | Repos ECR | **IE3** (registro imágenes) | ♻️ Renombrar |
| `IE2_02..04` | EXTERNAL-IP + app por ELB | **IE5** (funcionalidad) | ⚠️ La URL del ELB será NUEVA → recapturar (C8); las de P3 solo de respaldo |
| `IE3_01..04` | HPA métricas/escalando/scale-down | **IE4** (escalabilidad) | ⚠️ Recapturar en la prueba de carga nueva (D3); reciclables si se repite igual |
| `IE4_01` | Pipeline verde (viejo, SIN test/Trivy) | **IE3** | ❌ NO sirve — el workflow nuevo tiene test+Trivy → recapturar (C7) |
| `IE5_01..02` | Environment + secrets GitHub | **IE3** (secretos) | ♻️ Reciclar (pantalla idéntica) |
| `IE6_01..02` | kubectl logs + CloudWatch | **IE5**/observabilidad | ♻️ `IE6_01` reciclable; CloudWatch mejor recapturar con el clúster nuevo (D5) |
| `IE7_01..04` | get nodes/pods, pod recreado, CRUD, redeploy | **IE5** (verificación) | ⚠️ Recapturar (nombres de pods/URL cambian); P3 de respaldo |
| `arquitectura.png/svg` | Diagrama | **IE1** | ♻️ Actualizar con compose + tests (D6) |

**Regla práctica:** todo lo que muestra **pantallas del wizard/config de AWS** se recicla (la receta es idéntica);
todo lo que muestra **IDs, URLs, nombres de pods o corridas del pipeline** se recaptura porque delata la fecha/entorno viejo.
