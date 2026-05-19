FROM nginx:1.27-alpine

COPY deploy/frontend/nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html /usr/share/nginx/html/index.html
COPY global.css /usr/share/nginx/html/global.css
COPY scripts /usr/share/nginx/html/scripts
COPY docs /usr/share/nginx/html/docs
COPY backup /usr/share/nginx/html/backup
