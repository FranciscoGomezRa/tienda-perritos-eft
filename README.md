# 🐶 Tienda Perritos — CI/CD + AWS EKS + Autoscaling

Aplicación web **CRUD de productos para mascotas** desplegada en **AWS EKS** mediante un
pipeline **CI/CD con GitHub Actions** que construye las imágenes, las publica en **Amazon ECR**
y las despliega en el clúster, con **autoescalado de pods (HPA)** y **balanceo de carga (ELB)**.

> Evaluación Parcial N°3 — *Introducción a Herramientas DevOps (ISY1101)* · Duoc UC.
> **Autores:** Francisco Gómez Ramos · Benjamin Aravena Rosales — **Docente:** Rafael Videla.
> Informe completo en [`Informe_Prueba3.pdf`](Informe_Prueba3.pdf).

---

## 🎯 Objetivo del repositorio

Llevar la aplicación «Tienda Perritos» (frontend + backend + base de datos) desde contenedores
sueltos hacia un **entorno de orquestación productivo en la nube**, demostrando de forma verificable:

- **Orquestación** de los 3 servicios en un clúster **Amazon EKS** (alta disponibilidad en 2 AZ).
- **CI/CD automatizado**: cada `push` a `main` reconstruye, publica y despliega la app sin pasos manuales.
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
            GitHub Actions (CI/CD)  ──build & push──►  Amazon ECR (3 repos)
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
├── frontend/        # Nginx + HTML/JS (Dockerfile, default.conf, index.html, app.js)
├── backend/         # Node/Express (Dockerfile, server.js, package.json)
├── db/              # MySQL 8 + init.sql (Dockerfile)
├── k8s/             # Manifiestos Kubernetes (deployments, services, HPA, namespace, secret.example)
├── .github/workflows/deploy-eks.yml   # Pipeline CI/CD (build → push → deploy)
├── .env.example     # Plantilla de variables (copiar a .env, que está en .gitignore)
├── Informe_Prueba3.pdf / .txt         # Informe de la evaluación
├── fotos/           # Capturas de evidencia (IE1–IE7)
└── docs_profesor/   # Material original entregado por el profesor (referencia)
```

---

## ✅ Requisitos previos

| Para… | Necesitas |
|---|---|
| Operar la infraestructura | Cuenta **AWS Academy Learner Lab** activa (rol `LabRole`) |
| El pipeline | **GitHub** con el Environment `production` y sus Secrets configurados |
| Administrar el clúster | **kubectl** (local) o **AWS CloudShell** |
| Build local (opcional) | **Docker Desktop** |

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
   `build & push` de las 3 imágenes a ECR → `update-kubeconfig` → crea el Secret de MySQL →
   `apply` + `set image` + `rollout status` de DB, backend y frontend → verifica la Metrics API → aplica los HPA.
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

## 💻 Prueba local rápida (opcional, sin Kubernetes)

Para probar solo la app en tu máquina con Docker (red puente entre los 3 contenedores):

```bash
docker network create perritos

docker build -t perritos-db ./db
docker run -d --name tienda-db --network perritos \
  -e MYSQL_ROOT_PASSWORD=admin123 perritos-db

docker build -t perritos-backend ./backend
docker run -d --name tienda-backend --network perritos \
  -e DB_HOST=tienda-db -e DB_PASSWORD=admin123 -p 3001:3001 perritos-backend

docker build -t perritos-frontend ./frontend
docker run -d --name tienda-frontend --network perritos -p 8080:80 perritos-frontend
# Abre http://localhost:8080
```

> Variables que lee el backend (`server.js`): `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `PORT`.

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
