FROM nginx:alpine

# Copiar configuraci�n de NGINX
COPY default.conf /etc/nginx/conf.d/default.conf

# Copiar archivos est�ticos
COPY index.html /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY tiki-tiki-slowed.mp3 /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
