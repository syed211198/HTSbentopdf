# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build without type checking (vite build only)
# Pass SIMPLE_MODE environment variable if provided
ARG SIMPLE_MODE=false
ENV SIMPLE_MODE=$SIMPLE_MODE
RUN npm run build -- --mode production

# Production stage
FROM nginxinc/nginx-unprivileged:1.29-alpine

# Copy files as root first, then change ownership
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Change ownership while still root, then switch to nginx user
USER root
RUN mkdir -p /etc/nginx/tmp && \
    chown -R nginx:nginx /usr/share/nginx/html /etc/nginx/tmp
USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
