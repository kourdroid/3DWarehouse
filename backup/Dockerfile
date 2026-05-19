ARG NGINX_IMAGE=nginx:stable-alpine
FROM ${NGINX_IMAGE}

WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf
COPY index.html global.css favicon.svg ./
COPY scripts ./scripts

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
