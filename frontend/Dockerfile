# Stage 1: build
FROM node:22-alpine AS builder

WORKDIR /app

COPY my-app/package*.json ./
RUN npm ci

COPY my-app/ .
RUN npm run build

# Stage 2: serve
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback: route all 404s back to index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
