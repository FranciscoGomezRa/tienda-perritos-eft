# 🐶 Tienda Perritos — CI/CD + AWS EKS + Autoscaling

Aplicación web **CRUD de productos para mascotas** desplegada en **AWS EKS** mediante un
pipeline **CI/CD con GitHub Actions** que construye las imágenes, las publica en **Amazon ECR**
y las despliega en el clúster, con **autoescalado de pods (HPA)** y **balanceo de carga (ELB)**.

> Examen Final Transversal (EFT) — *Introducción a Herramientas DevOps (ISY1101)* · Duoc UC.
> **Autores:** Francisco Gómez Ramos · Benjamin Aravena Rosales — **Docente:** Rafael Videla.
> Informe completo en `Informe_EFT.docx`.

---

## 🎯 Objetivo del repositorio

Llevar la aplicación «Tienda Perritos» (frontend + backend + base de datos) desde contenedores
sueltos hacia un **entorno de orquestación productivo en la nube**, demostrando de forma verificable:

- **Desarrollo local orquestado** con **Docker Compose** (3 servicios, red interna, healthcheck).
- **Contenedores con buenas prácticas**: Dockerfile **multietapa**, imágenes minimalistas (alpine),
  `.dockerignore`, usuario **non-root** y variables de entorno.
- **CI/CD automatizado**: cada `push` a `main` **testea**, reconstruye, **escanea (Trivy)**, publica y despliega sin pasos manuales.
- **Tests unitarios** del backend (Jest + supertest, BD mockeada) como compuerta del pipeline.
- **Orquestación** de los 3 servicios en un clúster **Amazon EKS** (alta disponibilidad en 2 AZ).
- **Escalabilidad** con **HPA** (autoescalado horizontal de réplicas según uso de CPU).
- **Balanceo de carga** y acceso público vía **Elastic Load Balancer**.
- **Gestión segura de secretos** (credenciales fuera del código, en GitHub Environment).
- **Observabilidad**: logs (`kubectl logs` / CloudWatch) y métricas (`kubectl top`).

---

## 🏗️ Arquitectura

```
                 GitHub (push a main)
                        │
                        ▼
     GitHub Actions (test → build → scan → push)  ───►  Amazon ECR (3 repos)
                        │                                tienda-frontend
                        │                                tienda-backend
                        │ kubectl apply / set image       tienda-db
                        ▼
        ┌─────────────────────  AWS EKS (namespace: tienda)  ─────────────────────┐
        │                                                                          │
        │   Internet ──► ELB ──► Service(tienda-frontend, LoadBalancer)            │
        │                              │                                           │
        │                              ▼                                           │
        │                     Pods frontend (Nginx)  ──/api/──►  Service backend   │
        │                       [HPA 2..6]                       (ClusterIP)       │
        │                                                            │             │
        │                                                            ▼             │
        │                                                   Pods backend (Node)    │
        │                                                     [HPA 2..10]          │
        │                                                            │             │
        │                                                            ▼             │
        │                                                   Service tienda-db ──► Pod MySQL
        │                                                                        (Secret) │
        └──────────────────────────────────────────────────────────────────────────┘
   Red: VPC 10.0.0.0/16 en 2 AZ (us-east-1a/1b) · 2 subredes públicas (ELB + NAT) +
   4 privadas (nodos worker, sin IP pública) · NAT Gateway para la salida de las privadas.
```

- **Frontend**: Nginx sirve `index.html` + `app.js` y hace **proxy `/api/` → backend** (`default.conf`).
- **Backend**: Node.js/Express, API REST `/api/productos` (CRUD) + `/api/health`. Se conecta a MySQL.
- **DB**: MySQL 8 con `init.sql` (crea la tabla `productos` y la siembra con 5 productos).
- **Comunicación interna**: por **DNS de Kubernetes** (`tienda-backend`, `tienda-db`).

---

## 📁 Estructura del repositorio

```
.
├── frontend/        # Nginx + HTML/JS (Dockerfile, .dockerignore, default.conf, index.html, app.js)
├── backend/         # Node/Express (Dockerfile multietapa, app.js, server.js, __tests__/)
├── db/              # MySQL 8 + init.sql (Dockerfile)
├── k8s/             # Manifiestos Kubernetes (deployments, services, HPA, namespace, secret.example)
├── docker-compose.yml                 # Entorno de desarrollo local (3 servicios + red + volumen)
├── .github/workflows/deploy-eks.yml   # Pipeline CI/CD (test → build → scan → push → deploy)
├── .env.example     # Plantilla de variables (copiar a .env, que está en .gitignore)
├── Informe_EFT.txt  # Informe de la evaluación (base; el entregable final es .docx)
├── PautaExamen.md / PlanTrabajo.md    # Checklist del EFT y ruta de trabajo
├── fotos/           # Capturas de evidencia
└── docs_profesor/   # Pauta oficial del EFT (referencia)
```

---

## ✅ Requisitos previos

| Para… | Necesitas |
|---|---|
| Operar la infraestructura | Cuenta **AWS Academy Learner Lab** activa (rol `LabRole`) |
| El pipeline | **GitHub** con el Environment `production` y sus Secrets configurados |
| Administrar el clúster | **kubectl** (local) o **AWS CloudShell** |
| Entorno local | **Docker Desktop** (docker compose) |
| Tests | **Node.js 18+** (`npm test` en `backend/`) |

---

## 🔐 Secrets (GitHub → Settings → Environments → `production`)

| Secret | Ejemplo | Notas |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | `ASIA...` | Del *AWS Details* del lab. **Rota cada sesión.** |
| `AWS_SECRET_ACCESS_KEY` | `...` | **Rota cada sesión.** |
| `AWS_SESSION_TOKEN` | `...` | **Rota cada sesión.** |
| `AWS_REGION` | `us-east-1` | Fijo. |
| `EKS_CLUSTER_NAME` | `tienda-eks` | Nombre de tu clúster. |
| `EKS_NAMESPACE` | `tienda` | Namespace. |
| `MYSQL_ROOT_PASSWORD` | `tu_password` | Contraseña root de MySQL (desde tu `.env`). |

> ⚠️ Las credenciales del Learner Lab son **temporales**: al reiniciar el lab debes actualizar
> `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `AWS_SESSION_TOKEN` en los Secrets.

---

## 🚀 Cómo correr el proyecto (CI/CD — vía recomendada)

1. **Provisiona la infraestructura en AWS** (consola del Learner Lab):
   clúster EKS `tienda-eks`, node group en subredes privadas, VPC/subredes/NAT y los **3 repos ECR**
   (`tienda-frontend`, `tienda-backend`, `tienda-db`). Asegúrate de habilitar el complemento
   **Servidor de métricas** (Metrics Server) del clúster — es necesario para el HPA.
2. **Configura los Secrets** del Environment `production` (tabla de arriba).
3. **Dispara el pipeline**: haz `push` a `main` (o ejecútalo manualmente desde la pestaña *Actions*).
   El workflow [`deploy-eks.yml`](.github/workflows/deploy-eks.yml) ejecuta:
   **tests unitarios** (job `test`, sin secrets) → `build` de las 3 imágenes → **escaneo Trivy**
   (HIGH/CRITICAL) → `push` a ECR (tags `latest` + SHA del commit) → `update-kubeconfig` →
   crea el Secret de MySQL → `apply` + `set image` + `rollout status` de DB, backend y frontend →
   verifica la Metrics API → aplica los HPA. **Si un test falla, no se despliega nada.**
4. **Obtén la URL pública** y abre la app:
   ```bash
   kubectl get svc tienda-frontend -n tienda   # copia el EXTERNAL-IP (http, puerto 80)
   ```

---

## 🛠️ Despliegue manual (alternativa, desde CloudShell)

```bash
aws eks update-kubeconfig --region us-east-1 --name tienda-eks
kubectl apply -f k8s/namespace.yaml

# Secret desde tu .env (NO se versiona):
kubectl create secret generic mysql-secret \
  --from-literal=MYSQL_ROOT_PASSWORD="TU_PASSWORD" \
  -n tienda --dry-run=client -o yaml | kubectl apply -f -

# Las imágenes ya apuntan al Account ID 268450856324; si usas otra cuenta,
# reemplázalo en los 3 *-deployment.yaml. Luego:
kubectl apply -f k8s/mysql-deployment.yaml  -f k8s/mysql-service.yaml    -n tienda
kubectl apply -f k8s/backend-deployment.yaml -f k8s/backend-service.yaml -n tienda
kubectl apply -f k8s/frontend-deployment.yaml -f k8s/frontend-service.yaml -n tienda
kubectl apply -f k8s/backend-hpa.yaml -f k8s/frontend-hpa.yaml -n tienda
```

---

## 💻 Entorno de desarrollo local (Docker Compose)

Los 3 servicios se levantan orquestados con [`docker-compose.yml`](docker-compose.yml):
red interna `perritos` (los servicios se resuelven por nombre DNS, igual que en Kubernetes),
healthcheck de MySQL como condición de arranque del backend y volumen de persistencia local.

```bash
cp .env.example .env      # define MYSQL_ROOT_PASSWORD (no se versiona)
docker compose up --build # levanta db → backend → frontend
# Abre http://localhost:8080  ·  API directa: http://localhost:3001/api/health
docker compose down       # (agrega -v para borrar también los datos)
```

> Variables que lee el backend (`app.js`): `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `PORT`.

---

## 🧪 Tests

Tests unitarios del backend con **Jest + supertest**; la BD se **mockea**, así que corren
sin infraestructura (por eso son la primera compuerta del pipeline):

```bash
cd backend
npm install
npm test        # 7 tests: health, CRUD, validaciones 400/404, error 500 de BD
```

---

## 📈 Autoscaling (HPA)

- `k8s/backend-hpa.yaml`: **2→10** réplicas al **70%** de CPU.
- `k8s/frontend-hpa.yaml`: **2→6** réplicas al **60%** de CPU.
- Requiere el **Metrics Server** del clúster (complemento **gestionado de EKS**; el pipeline solo
  *verifica* que la Metrics API esté disponible, no lo instala). Comprueba con:
  ```bash
  kubectl get hpa -n tienda
  kubectl top pods -n tienda
  ```

---

## ⚠️ Limitación conocida: persistencia de la base de datos

El Deployment de MySQL usa un volumen `emptyDir`, atado al ciclo de vida del pod. Por lo tanto la
**base de datos es efímera**: si el pod `tienda-db` se borra, se reprograma o se hace un redeploy
(cada `push` aplica `set image` también a la DB), **la base se reinicia desde cero** y solo se
recuperan los 5 productos semilla de `init.sql`; se pierden los cambios hechos por CRUD.
En una demo, ejecuta el CRUD **después** del último despliegue.

**Mejora futura recomendada:** reemplazar `emptyDir` por un **PersistentVolumeClaim (PVC)** sobre
**Amazon EBS** (addon `aws-ebs-csi-driver`), idealmente migrando a un **StatefulSet**; o usar un
servicio gestionado como **Amazon RDS for MySQL**. Ver detalle en el informe.

---

## 🔎 Comandos útiles

```bash
kubectl get nodes -o wide
kubectl get pods -n tienda -o wide
kubectl get svc -n tienda
kubectl get hpa -n tienda
kubectl logs deploy/tienda-backend -n tienda --tail=40
kubectl delete pod <pod> -n tienda    # demuestra la autorrecuperación
```
