# Imagen base MySQL 8 oficial
FROM mysql:8

# Nombre de la base de datos a crear (no es secreto)
ENV MYSQL_DATABASE=tienda_perritos

# IMPORTANTE (seguridad / IE5): la contraseña NO se hornea en la imagen.
# - En Kubernetes (EKS): se inyecta en runtime desde el Secret 'mysql-secret'
#   (ver k8s/mysql-deployment.yaml), generado por el pipeline desde GitHub Secrets.
# - En local: se pasa con  docker run -e MYSQL_ROOT_PASSWORD=...
# El usuario 'root' usa MYSQL_ROOT_PASSWORD; el backend se conecta como root.

# Copiar el script de inicialización dentro de la imagen
# Se ejecuta automáticamente la primera vez que se levante el contenedor
COPY init.sql /docker-entrypoint-initdb.d/

# Exponer el puerto de MySQL
EXPOSE 3306
