# 📋 PautaExamen — Checklist maestro del EFT (ISY1101)

> **Qué es este documento:** el QUÉ del Examen Final Transversal. Brechas vs Prueba 3,
> checklist por fase, mapa de indicadores de la rúbrica y lista de fotos con su nombre exacto.
> La ruta de ejecución paso a paso (el CÓMO y el avance) vive en [PlanTrabajo.md](PlanTrabajo.md).

**Evaluación:** EFT = 40% del ramo → Encargo 20% (grupal) + Defensa 80% (individual).
**Plazo:** 1 semana (entrega y defensa en semana 18). Defensa síncrona en laboratorio, 10–15 min por dupla, **en vivo** (no video).
**Entrega por AVA:** informe **Word** + link al repo GitHub **público** + presentación (PPT/PDF).

---

## 1. Diferencias EFT vs Prueba 3 (las brechas a cerrar)

| # | Requisito nuevo del EFT | Estado P3 | Acción |
|---|---|---|---|
| 1 | `docker-compose.yml` entorno dev local | ❌ No existía | Crear (frontend + backend + db, red interna, healthcheck) |
| 2 | Dockerfile **multietapa** + `.dockerignore` + imágenes minimalistas | ❌ 1 etapa, sin .dockerignore | Backend multietapa + non-root; `.dockerignore` ×3; frontend/db se justifican |
| 3 | Etapa **test** en pipeline (build→test→push→deploy) | ❌ Sin tests | Jest + supertest (BD mockeada) + job `test` en Actions |
| 4 | Escaneo de vulnerabilidades (seguridad básica) | ❌ Solo base alpine/slim | Paso Trivy en el pipeline (informativo) |
| 5 | Informe en formato **Word** | ⚠️ PDF/TXT | Construir en `Informe_EFT.txt` → convertir a .docx al final |
| 6 | Repo nuevo público con historial ordenado | ✅ Se sabe hacer | Repo `tienda-perritos-eft`, commits por etapa |

**Lo que se recicla directo de la P3 (~85%):** app completa (frontend/backend/db), manifiestos k8s
(deployments, services, HPA, namespace), workflow base, receta completa de infra AWS (VPC, EKS,
node group, ECR, secrets), diagrama `arquitectura.svg`, informe TXT como base, gran parte de las fotos.

---

## 2. Checklist por fase

### Fase A — Montaje del proyecto y repo Git
- [x] Copiar base reutilizable desde `Prueba3\` (código, k8s, workflow, fotos, informe TXT)
- [x] Crear `PautaExamen.md` + `PlanTrabajo.md`
- [x] `git init` + commit inicial (base app)
- [ ] Usuario crea repo GitHub **público** `tienda-perritos-eft` + remote + push
- [x] Adaptar `README.md` al EFT (compose, tests, Trivy; quitar referencias a "Prueba 3")

### Fase B — Brechas técnicas
- [x] `docker-compose.yml` (3 servicios, red `perritos`, healthcheck MySQL, volumen local)
- [x] `backend/Dockerfile` multietapa + `USER node`
- [x] `.dockerignore` en `frontend/`, `backend/`, `db/`
- [x] Tests: split `app.js`/`server.js`, Jest + supertest, `npm test` verde (7/7)
- [x] Pipeline: job `test` (needs) + paso Trivy + (mantener tags SHA+latest)
- [x] Verificación local: `docker compose up --build` → CRUD OK en `localhost:8080`

### Fase C — Infraestructura AWS desde 0 (receta P3, por consola)
- [ ] VPC `tienda-vpc` 10.0.0.0/16 · 2 AZ · 2 públicas + 4 privadas · 1 NAT
- [ ] Clúster EKS `tienda-eks` (LabRole, auth API, endpoint público y privado, observabilidad OFF, complementos: CoreDNS, kube-proxy, VPC CNI, **Metrics Server**)
- [ ] Node group `tienda-nodes` (AL2023, t3.medium, 2/2/4, subredes privadas, SSH off)
- [ ] 3 repos ECR: `tienda-frontend`, `tienda-backend`, `tienda-db`
- [ ] Actualizar Account ID nuevo en los 3 `k8s/*-deployment.yaml`
- [ ] GitHub Environment `production` + 7 secrets (⚠️ credenciales del lab rotan cada sesión)
- [ ] Push a main → pipeline verde → EXTERNAL-IP del ELB → app funcionando
- [ ] ⚠️ **Créditos**: al cerrar sesión, node group a 0 (`aws eks update-nodegroup-config --scaling-config minSize=0,desiredSize=0,maxSize=4`); revivir 2/2 antes de la demo. Lección P3: ~$22/día encendido.

### Fase D — Evidencias, informe y presentación
- [ ] Reestructurar `Informe_EFT.txt` según los 9 puntos del EFT (ver §4) con slots `[FOTO: ...]`
- [ ] Renombrar/depurar fotos recicladas de P3 al esquema EFT (mapa en PlanTrabajo.md)
- [ ] Capturar fotos nuevas (lista en §5)
- [ ] Prueba de carga → HPA escala (evidencia escalabilidad)
- [ ] Demo verificación: CRUD, autorrecuperación de pod, logs, CloudWatch
- [ ] Convertir informe a **.docx** (formato Word exigido) con diagrama embebido
- [ ] Presentación PPT/PDF (10–15 min) + subir al AVA
- [ ] Ensayo de defensa individual (cada uno defiende TODO el proyecto)

---

## 3. Rúbrica → evidencia que la cubre

### Encargo (20% grupal)
| Indicador | % | Evidencia nuestra |
|---|---|---|
| **IE1** Gestión de versiones y arquitectura | 10% | Repo público con commits `tipo(área): ...` por etapa; ramas; `arquitectura.svg` actualizado (compose + tests + AWS) |
| **IE2** Contenerización para desarrollo local | 10% | Dockerfiles multietapa/minimalistas + `.dockerignore` + `docker-compose.yml` levantando los 3 servicios |
| **IE3** Pipeline CI/CD | 20% | Workflow: test → build → Trivy → push ECR (tags SHA+latest) → deploy EKS; secrets en Environment `production` |
| **IE4** Despliegue y orquestación en la nube | 20% | Clúster EKS + node group en privadas + ELB + **HPA escalando** (prueba de carga) |
| **IE5** Verificación y funcionalidad | 20% | CRUD vía URL del ELB, `/api/health`, logs pipeline + `kubectl logs`, CloudWatch, autorrecuperación |
| **IE6** Presentación y defensa | 20% | PPT estructurada + demo en vivo |

### Defensa (80% individual)
| Indicador | % | Qué preparar |
|---|---|---|
| **IE8** Fundamentos de orquestación | 25% | Explicar clúster, nodos, autoscaling (HPA vs Cluster Autoscaler), balanceo (ELB), recuperación ante fallos |
| **IE9** Demostración del pipeline | 25% | Demo en vivo build→test→push→deploy con logs de Actions |
| **IE10** Defensa técnica | 25% | Justificar CADA decisión (ver §6 preguntas probables) |
| **IE11** Claridad y estructura | 25% | Presentación ordenada, lenguaje técnico, 10–15 min |

---

## 4. Los 9 puntos que el informe DEBE justificar (estructura del Informe_EFT)

1. **Método de integración**: comunicación frontend ↔ backend ↔ BD (proxy nginx `/api/`, DNS de k8s, pool MySQL).
2. **Contenedores**: imágenes por componente, redes internas, orquestación local con Docker Compose.
3. **Registro de imágenes**: flujo de publicación a ECR + **tags** para trazabilidad (SHA corto + latest).
4. **CI/CD**: diagrama + explicación del pipeline (build, **test**, push, deploy).
5. **Infraestructura en la nube**: VPC, subredes, security groups, clúster EKS.
6. **Configuración y secretos**: GitHub Secrets/Environment, mínimo privilegio (IAM LabRole del Learner Lab).
7. **Observabilidad**: logs del pipeline (Actions) + métricas CloudWatch / `kubectl top`.
8. **Seguridad básica**: imágenes alpine/slim, escaneo (Trivy), puertos mínimos, SG restrictivos.
9. **Orquestación y escalabilidad**: por qué EKS vs despliegue manual; beneficios en producción.

---

## 5. Fotos — nuevas obligatorias del EFT

> Las recicladas de P3 y su renombre están mapeadas en [PlanTrabajo.md](PlanTrabajo.md).
> Claude avisa **en el momento** qué capturar y con qué nombre; el usuario guarda en `fotos/`.

| Foto nueva | Cuándo se captura |
|---|---|
| `IE2_compose_up.png` | `docker compose up` con los 3 servicios healthy (Fase B) |
| `IE2_app_local.png` | App con CRUD en `http://localhost:8080` (Fase B) |
| `IE3_npm_test_local.png` | `npm test` verde en terminal (Fase B) |
| `IE3_job_test_actions.png` | Job `test` verde en GitHub Actions (Fase C, primer push) |
| `IE3_trivy_scan.png` | Salida del escaneo Trivy en el pipeline (Fase C) |
| `IE3_pipeline_verde.png` | Corrida completa verde del workflow nuevo (Fase C) |
| `IE3_ecr_tags.png` | Imágenes en ECR con tags SHA + latest (Fase C) |
| `IE4_hpa_escalando.png` | HPA subiendo réplicas bajo carga (Fase D, se repite prueba busybox) |
| `IE5_app_elb.png` | App funcionando vía URL del ELB nuevo (Fase C/D) |
| `IE5_crud_cloud.png` | CRUD funcionando en la nube (Fase D) |
| `IE5_cloudwatch.png` | Log group del clúster en CloudWatch — activar, capturar, apagar (Fase D) |

*(los nombres definitivos pueden ajustarse al numerar los slots del informe)*

---

## 6. Preguntas probables de la defensa (preparar respuesta cada uno)

- ¿Por qué EKS y no ECS o EC2 a mano? ¿Qué te da el orquestador?
- ¿Qué es un Dockerfile multietapa y qué ganas con él?
- ¿Cómo se comunican los contenedores en compose vs en Kubernetes?
- ¿Dónde viven los secretos y por qué NO en el repo? ¿Qué es mínimo privilegio?
- ¿Qué hace cada etapa del pipeline? ¿Qué pasa si falla el test?
- ¿Cómo escala la app? (HPA: métrica CPU, umbral, Metrics Server, min/max réplicas)
- ¿Qué pasa si se cae un pod? ¿Y un nodo? (self-healing, réplicas, 2 AZ)
- ¿Por qué los nodos están en subredes privadas? ¿Cómo salen a internet? (NAT)
- Limitación conocida: BD efímera (emptyDir) → mejora: PVC/EBS o RDS.
