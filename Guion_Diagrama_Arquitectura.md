# Guión del diagrama de arquitectura — Examen Final Transversal (EFT)

**Notas del presentador — Tienda Perritos · Docker Compose + CI/CD + AWS EKS + HPA (ISY1101)**
Integrantes: Francisco Gómez Ramos · Benjamin Aravena Rosales

Recorrido del diagrama `fotos/arquitectura.svg` de arriba hacia abajo. Cada bloque indica **qué señalar**
y un texto sugerido para **decir**, con los comandos y valores reales del proyecto.

---

## Apertura
*Señalo: el título y la forma general del diagrama.*

"Este diagrama resume toda la solución de Tienda Perritos y se lee de arriba hacia abajo: arriba el ciclo
de desarrollo (primero local, luego el pipeline), y bajando vemos cómo un commit termina corriendo dentro
de AWS y llegando al usuario. La región es `us-east-1` y el clúster se llama `tienda-eks`. Todo lo que
muestro está implementado y verificado."

---

## 0 · Ciclo de desarrollo local (Docker Compose)
*Señalo: la caja superior de desarrollo local (`docker compose`).*

"Antes de la nube, todo se desarrolla y prueba en local con Docker Compose. Un `docker compose up --build`
levanta los 3 contenedores —`tienda-db`, `tienda-backend`, `tienda-frontend`— en una red interna. MySQL
tiene un healthcheck y el backend arranca solo cuando la base responde (`depends_on: service_healthy`). La
app queda en `http://localhost:8080`."

"Decisión de diseño clave: los servicios del compose usan los MISMOS nombres DNS que los Services de
Kubernetes. Por eso el mismo artefacto corre sin cambios en local y en producción: el proxy de Nginx y el
backend no distinguen el entorno."

---

## 1 · Trigger del pipeline y compuerta de tests
*Señalo: la franja del pipeline (Desarrollador → GitHub Actions), etapa `test`.*

"Todo arranca cuando hago `git push` a la rama `main`. El workflow escucha `on: push: branches:[main]`.
El pipeline tiene DOS jobs. El primero es **`test`**: corre en un runner `ubuntu-latest` con Node 18, hace
`npm ci` y `npm test` (Jest + supertest). Los tests mockean la base de datos, así que no necesitan
infraestructura. Es una compuerta de calidad: si un test falla, el despliegue NI SIQUIERA parte, porque el
segundo job declara `needs: test`."

"El segundo job, **`build-and-deploy`**, declara `environment: production`, y recién ahí se inyectan los 7
secrets: las tres credenciales de AWS más el `AWS_SESSION_TOKEN`, la región, el `EKS_CLUSTER_NAME`, el
`EKS_NAMESPACE` y la `MYSQL_ROOT_PASSWORD`. Ningún secreto vive en el repositorio."

---

## 2 · Autenticación contra AWS
*Señalo: la flecha que baja de GitHub Actions hacia AWS.*

"Los primeros pasos del job de despliegue son: `actions/checkout` baja el código; `configure-aws-credentials`
usa las llaves y el session token —que es obligatorio porque las credenciales del Learner Lab son temporales
y rotan cada sesión—; y `amazon-ecr-login` autentica Docker contra nuestro registro ECR."

---

## 3 · Build, escaneo de seguridad (Trivy) y push a ECR
*Señalo: la flecha naranja `docker push` y la caja de Amazon ECR, con el paso Trivy intercalado.*

"Aquí ocurre el `docker build`. El pipeline fija `IMAGE_TAG=${GITHUB_SHA::7}`, o sea los 7 primeros
caracteres del commit, y construye cada imagen con dos etiquetas: `:<sha7>` —inmutable y trazable al commit—
y `:latest`."

"Antes de publicar, cada imagen pasa por **Trivy** (de Aqua Security), que escanea vulnerabilidades
HIGH y CRITICAL. Es seguridad *shift-left*: detectamos problemas ANTES de subir la imagen. Está en modo
informativo (`exit-code 0`): reporta en el log pero no bloquea, porque las imágenes base suelen traer CVEs
que no dependen de nosotros; en producción se elevaría a modo bloqueante."

"Recién entonces hace `docker push` de las tres imágenes a los tres repositorios privados `tienda-frontend`,
`tienda-backend` y `tienda-db`, cifrados con AES-256. Este push a ECR es el que después consumen los nodos."

---

## 4 · Conexión al clúster
*Señalo: la flecha roja `kubectl` hacia el plano de control EKS.*

"El pipeline instala `kubectl` y ejecuta `aws eks update-kubeconfig --name tienda-eks`, que genera el
kubeconfig apuntando al endpoint del plano de control. Desde ahí ya puede mandar órdenes a la API."

"Y aquí un concepto clave: un clúster EKS son dos mitades. Esta caja roja es el **plano de control**
—API server, etcd, scheduler— y lo administra AWS en su propia red, por eso lo dibujé fuera de nuestra VPC.
Nosotros no lo mantenemos: es el modelo de responsabilidad compartida."

---

## 5 · Despliegue declarativo
*Señalo: la caja VPC y, debajo, el namespace.*

"Con el kubeconfig listo, el pipeline aplica los manifiestos en orden: primero `kubectl apply -f
k8s/namespace.yaml` para el namespace `tienda`."

"Luego crea el Secret en caliente: `kubectl create secret generic mysql-secret --from-literal=...` con
`--dry-run=client -o yaml | kubectl apply -f -`, tomando la contraseña del secret de GitHub. La contraseña
nunca se versiona."

"Después, para `db`, `backend` y `frontend` repite el patrón: `kubectl apply` del deployment y el service,
`kubectl set image` a la imagen recién pusheada por su tag de commit, y `kubectl rollout status` que espera
a que el rollout termine sano antes de seguir."

---

## 6 · Qué pasa en los nodos
*Señalo: las dos cajas 'Nodo EC2 (privado)' y el borde de red (IGW, NAT, ELB).*

"Esta franja azul son las subredes privadas en 2 zonas de disponibilidad. Dentro están nuestras 2 EC2
`t3.medium` con Amazon Linux 2023, sin IP pública. El kubelet de cada nodo recibe la orden, hace el pull de
la imagen desde ECR —y como no tienen IP pública, esa descarga sale por NAT Gateway → Internet Gateway— y
levanta los pods."

"Importante distinguir: el **nodo** es la máquina (la EC2) y el **pod** es la app que corre encima. Tenemos
2 nodos y, en reposo, 5 pods. Lo único expuesto a Internet es el ELB de las subredes públicas; los nodos
quedan protegidos."

---

## 7 · El node group
*Señalo: la caja 'Escalado del node group'.*

"Las 2 EC2 pertenecen a un único node group, `tienda-nodes`, asociado a las 4 subredes privadas, con
deseado 2 / mínimo 2 / máximo 4. No es un node group por zona: es uno solo y su Auto Scaling Group reparte
los nodos entre las 2 AZ, lo que da alta disponibilidad. El Cluster Autoscaler —que ajustaría el número de
nodos solo— queda documentado como mejora futura."

---

## 8 · Flujo de la petición
*Señalo: la línea del usuario bajando por el namespace.*

"Ahora el camino real de una petición, que baja en línea recta: el usuario entra por el ELB en el puerto 80;
eso llega al Service `tienda-frontend` (tipo LoadBalancer) que reparte a sus 2 pods Nginx; el frontend llama
al backend por `/api` en el puerto 3001 (Service ClusterIP); y el backend consulta MySQL en el puerto 3306
vía su service headless."

---

## 9 · Autoscaling (HPA) — lo central
*Señalo: las cajas de HPA y el Metrics Server a la derecha.*

"Esto es el corazón del encargo. El pipeline verifica la Metrics API (`v1beta1.metrics.k8s.io`) y aplica los
HPA. El Metrics Server lee la CPU de los pods y el HPA agrega o quita réplicas: el frontend con umbral 60%
escala de 2 a 6, y el backend con umbral 70% escala de 2 a 10. Esto funciona porque cada deployment declara
requests/limits de CPU (el backend 100m/500m)."

"En la prueba de carga real, el backend subió de 2 hasta 10 pods con la CPU sobre 400%, y luego bajó solo a
2. Y aquí cierro el concepto: el HPA escala pods, no nodos; esos pods nuevos nacen sobre los mismos 2 nodos.
Escalar nodos sería tarea del Cluster Autoscaler."

---

## 10 · Seguridad de red — Secret y NetworkPolicy
*Señalo: la caja del Secret y el candado de NetworkPolicy sobre `tienda-db`.*

"El Secret `mysql-secret` no está en el repo: lo genera el pipeline desde los secretos de GitHub, y de aquí
lo consumen el backend —vía `secretKeyRef` en `DB_PASSWORD`— y la base de datos."

"Y una capa extra de seguridad que agregamos: una **NetworkPolicy** que aísla la base de datos. Por defecto
la red de Kubernetes es plana —cualquier pod podría conectarse al 3306 de MySQL—. La política
`db-allow-backend-only` aplica default-deny sobre el pod `tienda-db` y solo permite entrar a pods con la
etiqueta `app=tienda-backend`. Lo probamos: desde un pod cualquiera la conexión al 3306 se BLOQUEA, y desde
el backend CONECTA. Requiere el enforcement de Network Policy habilitado en el add-on VPC CNI."

---

## Cierre
*Señalo: la leyenda de indicadores al pie.*

"Frase de cierre: se desarrolla en local con Docker Compose; un `git push` dispara el pipeline, que primero
corre los tests, luego hace build, escanea con Trivy y push a ECR, y despliega con `kubectl` sobre nodos
privados. Sin intervención manual, la app queda corriendo de forma segura, con alta disponibilidad y
autoescalado, aislando la base de datos y llegando al usuario por el ELB."

---
---

# Anexo A — Desglose del pipeline `.github/workflows/deploy-eks.yml`

**Disparadores:** `on: push (branches:[main])` y `workflow_dispatch`. **Dos jobs:** `test` (compuerta) y
`build-and-deploy` (`needs: test`, `environment: production`). Variables `env`: `ECR_REPO_FRONTEND/BACKEND/DB`.

### Job 1 — `test` (runner ubuntu-latest, Node 18, SIN secrets)
| # | Step · action | Qué hace |
|---|---|---|
| 1 | Checkout · `actions/checkout@v4` | Clona el repo en el runner. |
| 2 | Setup Node · `actions/setup-node@v4` | Node 18 + caché de npm (`backend/package-lock.json`). |
| 3 | `npm ci` | Instala dependencias reproducibles del backend. |
| 4 | `npm test` | Jest + supertest (BD mockeada). Si falla, no hay deploy. |

### Job 2 — `build-and-deploy` (`needs: test`, `environment: production`)
| # | Step · action | Qué hace |
|---|---|---|
| 1 | Checkout · `actions/checkout@v4` | Clona el repo en el runner. |
| 2 | Credenciales AWS · `configure-aws-credentials@v4` | Carga `AWS_ACCESS_KEY_ID`, `SECRET`, `REGION` y `SESSION_TOKEN` (token obligatorio: credenciales temporales). |
| 3 | Login ECR · `amazon-ecr-login@v2` | Autentica Docker; expone `steps.login-ecr.outputs.registry`. |
| 4 | Definir tag | `IMAGE_TAG=${GITHUB_SHA::7}` → tag trazable al commit. |
| 5-7 | Build FRONTEND / BACKEND / DB | `docker build` con tags `:<sha7>` y `:latest` (sin push aún). |
| 8-10 | Escaneo Trivy ×3 · `aquasecurity/trivy-action@master` | Escanea cada imagen (`HIGH,CRITICAL`, `exit-code 0` informativo). |
| 11 | Push a ECR | `docker push` de ambos tags de las 3 imágenes. |
| 12 | Instalar kubectl · `azure/setup-kubectl@v4` | kubectl v1.29.0. |
| 13 | Kubeconfig | `aws eks update-kubeconfig --region $AWS_REGION --name $EKS_CLUSTER_NAME`. |
| 14 | Namespace | `kubectl apply -f k8s/namespace.yaml`. |
| 15 | Secret MySQL | `kubectl create secret generic mysql-secret --from-literal=... --dry-run=client -o yaml \| kubectl apply -f -`. |
| 16 | Desplegar DB | apply deployment+service, `set image` `tienda-db`, `rollout status`. |
| 17 | Desplegar BACKEND | apply deployment+service, `set image` `tienda-backend`, `rollout status`. |
| 18 | Desplegar FRONTEND | apply deployment+service, `set image` `tienda-frontend`, `rollout status`. |
| 19 | Verificar Metrics Server | `kubectl get apiservices v1beta1.metrics.k8s.io` + `wait` (usa el add-on gestionado, no upstream). |
| 20 | Aplicar HPA | `kubectl apply` de `backend-hpa.yaml` y `frontend-hpa.yaml`. |
| 21 | Estado final | `kubectl get pods -o wide`, `get svc`, `get hpa`. |

---

# Anexo B — Desglose de los manifiestos `k8s/*.yaml`

Todos llevan `namespace: tienda`. El pipeline aplica deployment + service y luego sobrescribe la imagen con
`kubectl set image`, por eso el tag `:latest` del YAML es solo un valor inicial.

| Archivo | Kind | Campos clave |
|---|---|---|
| `namespace.yaml` | Namespace | Crea el namespace `tienda`. |
| `mysql-secret.example.yaml` | Secret (plantilla) | Referencia; el Secret real lo genera el pipeline. |
| `mysql-deployment.yaml` | Deployment | 1 réplica · `mysql` :3306 · `MYSQL_ROOT_PASSWORD` vía secretKeyRef · volumen `emptyDir` en `/var/lib/mysql`. |
| `mysql-service.yaml` | Service | `clusterIP: None` (headless) · :3306 · DNS interno `tienda-db`. |
| `backend-deployment.yaml` | Deployment | 2 réplicas · :3001 · env DB_* · resources req 100m/128Mi · lim 500m/512Mi · probes `/api/health`. |
| `backend-service.yaml` | Service | `ClusterIP` · :3001 (solo interno). |
| `backend-hpa.yaml` | HorizontalPodAutoscaler | `autoscaling/v2` · target `tienda-backend` · min 2 · max 10 · CPU 70%. |
| `frontend-deployment.yaml` | Deployment | 2 réplicas · :80 · resources req 50m/64Mi · lim 300m/256Mi · probes `/`. |
| `frontend-service.yaml` | Service | `LoadBalancer` · :80 → EKS aprovisiona el Classic ELB público. |
| `frontend-hpa.yaml` | HorizontalPodAutoscaler | `autoscaling/v2` · target `tienda-frontend` · min 2 · max 6 · CPU 60%. |
| `db-networkpolicy.yaml` | NetworkPolicy | `db-allow-backend-only`: default-deny ingress sobre `app=tienda-db`; solo permite `app=tienda-backend` al 3306. |

Relación con el HPA: los **requests de CPU** son imprescindibles — el HPA calcula el % de uso sobre el
request, no sobre el límite. Sin `resources` no habría métrica y el HPA quedaría en `<unknown>`.

---

# Anexo C — Los 7 secrets del Environment `production`

Viven en GitHub → Settings > Environments > production (no en el repositorio). El job solo puede leerlos
porque declara `environment: production`. Las tres credenciales de AWS son temporales y rotan en cada sesión
del Learner Lab, por eso hay que actualizarlas al empezar a trabajar.

| Secret | Qué es | De dónde se extrae | Dónde lo usa el pipeline |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | ID de la credencial temporal. | Learner Lab → AWS Details → AWS CLI. Rota por sesión. | Configurar credenciales. |
| `AWS_SECRET_ACCESS_KEY` | Clave secreta asociada. | Mismo bloque del Learner Lab. | Configurar credenciales. |
| `AWS_SESSION_TOKEN` | Token STS temporal (obligatorio). | Mismo bloque; cambia al reiniciar el lab. | Configurar credenciales. |
| `AWS_REGION` | Región de la infraestructura. | Fijo: `us-east-1`. | Credenciales y update-kubeconfig. |
| `EKS_CLUSTER_NAME` | Nombre del clúster. | Definido al crear: `tienda-eks`. | `aws eks update-kubeconfig --name ...`. |
| `EKS_NAMESPACE` | Namespace destino. | `k8s/namespace.yaml`: `tienda`. | Todos los `kubectl ... -n $EKS_NAMESPACE`. |
| `MYSQL_ROOT_PASSWORD` | Contraseña root de MySQL. | Definida por el equipo (no se publica). | Genera el Secret `mysql-secret`. |

Por qué importa: los secretos nunca se escriben en el código. La `MYSQL_ROOT_PASSWORD` no se versiona — el
pipeline la convierte en un Secret de Kubernetes en tiempo de despliegue, y de ahí la leen los pods. Si algún
valor de AWS expira (sesión vencida), el pipeline falla al configurar credenciales y basta con actualizar los
tres secrets de AWS.

**Nota — Account ID (618629205592):** es un identificador, no una credencial; viaja en texto plano en la URL
de ECR dentro de los manifiestos. No va en Secrets.

---

# Anexo D — Para qué sirve cada manifiesto (Deployment, Service, HPA, NetworkPolicy)

| Tipo | Para qué sirve | En este proyecto |
|---|---|---|
| Namespace | Aísla y agrupa todos los recursos. | `tienda`. |
| Deployment | Estado deseado (imagen, réplicas, recursos, probes); recrea pods si mueren (autorrecuperación) y gestiona rollouts. | frontend (2), backend (2), db (1). |
| Service · ClusterIP | Accesible solo dentro del clúster. | `tienda-backend:3001`. |
| Service · LoadBalancer | Expone hacia afuera; en EKS aprovisiona un ELB público. | `tienda-frontend:80` → ELB Classic. |
| Service · headless | Sin IP virtual; DNS directo al pod. | `tienda-db:3306`. |
| HorizontalPodAutoscaler | Ajusta réplicas según CPU (Metrics Server). | backend 2→10 @70%, frontend 2→6 @60%. |
| Secret | Guarda credenciales fuera del código (secretKeyRef). | `mysql-secret`, generado por el pipeline. |
| NetworkPolicy | Segmenta el tráfico entre pods; aquí aísla la BD. | `db-allow-backend-only`: solo backend → 3306. |

**¿HPA y escalado de nodos son redundantes?** No. El HPA escala pods (copias de la app); el escalado del node
group escala nodos (EC2). Son capas distintas: si el HPA pide más pods de los que caben, quedarían en Pending
hasta que haya un nodo libre —y agregar nodos automáticamente sería tarea del Cluster Autoscaler (mejora
futura). Hoy el HPA es dinámico y el número de nodos es fijo (2–4).

---

# Anexo E — Qué defines en ECR y qué defines en EKS

| Servicio / capa | Qué defines ahí | En este proyecto |
|---|---|---|
| ECR (registro) | Repositorios: privado/público, mutabilidad de tags, cifrado, región. Solo ALMACENA imágenes. | 3 repos `tienda-frontend/backend/db`, privados, Mutable, AES-256, us-east-1. Tags `:<sha7>` y `:latest`. |
| EKS · clúster | Versión de Kubernetes, endpoint (público/privado), add-ons, rol IAM, cifrado. | `tienda-eks`, endpoint público y privado, add-ons CoreDNS/kube-proxy/VPC CNI/Metrics Server, rol LabRole. |
| EKS · node group | Máquinas: tipo de instancia, AMI, disco, escalado, subredes, SSH. | `tienda-nodes`, t3.medium, AL2023, 20 GB, 2/2/4, 4 subredes privadas, SSH OFF. |
| EKS · workloads (`k8s/`) | Cómo corre la app: namespace, deployments, services, HPA, secret, NetworkPolicy. | ns `tienda`, 3 deployments, 3 services, 2 HPA, mysql-secret, 1 NetworkPolicy. |

Regla: si es una IMAGEN → ECR. Si es INFRAESTRUCTURA o EJECUCIÓN → EKS.
Nota — ECS no es lo mismo que EKS: ambos son orquestadores de AWS, pero ECS es el propio de AWS (sin
Kubernetes) y EKS es Kubernetes gestionado. Se eligió EKS; ECS no se utiliza. Lo que acompaña a EKS es ECR.

---

# Anexo F — Cómo se relaciona el clúster EKS con el Classic ELB

**F.1 — El clúster crea el ELB (no se configura a mano).** Todo arranca por `type: LoadBalancer` del
`frontend-service.yaml`:
1. El `kubectl apply` del Service llega al API server.
2. El `cloud-controller-manager` del plano de control vigila los Services.
3. Al ver uno `type: LoadBalancer`, llama a la API de AWS para aprovisionar un balanceador.
4. Como no hay AWS Load Balancer Controller, AWS crea un **Classic ELB** público en las subredes públicas,
   escuchando en el `:80`, con su DNS `...elb.amazonaws.com`.
5. Ciclo de vida: el ELB queda atado al Service; si se borra el Service, EKS elimina el ELB.

**F.2 — Cómo el ELB lleva el tráfico al pod.** El ELB no apunta a los pods (sus IP cambian), apunta a los
nodos:
`Usuario :80 → Classic ELB (subredes públicas) → Nodo EC2 por un NodePort → kube-proxy (iptables) → Pod
frontend (Nginx :80)`.
El ELB registra los nodos como destinos, les hace health checks y reparte; kube-proxy reenvía al pod aunque
esté en otro nodo. Requisito: una subred pública por AZ (por eso hay 2).

**Frase de defensa:** "No configuré el ELB a mano: declaré el Service del frontend como `type: LoadBalancer`
y el plano de control de EKS aprovisionó un Classic ELB público. Balancea hacia los nodos por un NodePort, y
kube-proxy reenvía al pod de Nginx; si borrara el Service, EKS eliminaría el ELB."

---

# Anexo G — Add-ons del clúster

Se marcaron 4 add-ons gestionados (AWS los instala, parcha y actualiza):

| Add-on | Qué hace | Por qué es necesario |
|---|---|---|
| Amazon VPC CNI | Asigna a cada pod una IP real de la VPC. También aplica el enforcement de NetworkPolicy. | Sin red un pod no existe; habilita el aislamiento de la BD. |
| kube-proxy | Programa las reglas (iptables) que enrutan el tráfico de un Service a sus pods. | Sin él los Services no funcionan (NodePort del LoadBalancer, ClusterIP). |
| CoreDNS | DNS interno: resuelve nombres de Service a IP. | El backend encuentra a `tienda-db` por su nombre. |
| Metrics Server | Recolecta CPU/memoria de los pods (Metrics API). | Imprescindible para el HPA (si no, queda en `<unknown>`) y `kubectl top`. |

**Enforcement de NetworkPolicy:** en el add-on Amazon VPC CNI se habilitó "Enable Network Policy"
(`enableNetworkPolicy: true`), sin lo cual el manifiesto `db-networkpolicy.yaml` se aceptaría pero no
bloquearía nada.

Add-ons DESMARCARON a propósito (no necesarios, ahorro de créditos): Node monitoring agent (observabilidad),
EKS Pod Identity Agent (los permisos van por LabRole del nodo), External DNS (no hay dominio Route 53) y los
de terceros.

---

# Anexo H — Flujos de la arquitectura y seguridad de red

**Flujo 1 — Despliegue (lo dispara un commit).** Es un *rolling update*, no un reset: un push a `main` corre
los tests, y si pasan, reconstruye las 3 imágenes y redespliega los 3 deployments (por el tag con SHA nuevo).
No los mata de golpe: salen pods nuevos y recién entonces mueren los viejos —sin caída, con 2 réplicas—.
Efecto colateral: el pod de MySQL también se reemplaza y, por `emptyDir`, la base se reinicia vacía.

**Flujo 2 — Petición del usuario.**
`Usuario → DNS del ELB :80 → Service frontend → pods Nginx → Service backend :3001 /api → pods Node/Express
→ Service db :3306 → MySQL`.
El ELB está asociado al frontend porque solo su Service es `type: LoadBalancer`; backend (ClusterIP) y db
(headless) son internos a propósito.

**Seguridad de red (transversal).** No se crearon grupos de seguridad personalizados: EKS gestiona
automáticamente el del clúster (control plane ↔ nodos, nodo ↔ nodo) y el del ELB (:80 → NodePort). La
seguridad real viene del diseño:
- Nodos en subredes privadas, sin IP pública → inalcanzables desde Internet.
- NAT → los nodos salen (pull de ECR) pero nadie entra.
- Exposición pública limitada al frontend; backend y db internos.
- **NetworkPolicy `db-allow-backend-only`** → aun dentro del clúster, solo el backend alcanza el 3306 de la
  base de datos (defensa en profundidad).

**Frase de defensa:** "La seguridad viene del diseño de red: nodos en subredes privadas sin IP pública,
salida solo por NAT, exposición pública limitada al frontend, y una NetworkPolicy que aísla la base de datos
para que solo el backend la alcance. Los grupos de seguridad del clúster y del ELB los gestiona EKS
automáticamente."
