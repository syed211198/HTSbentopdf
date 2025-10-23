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
FROM nginx:alpine

ARG APP_USER_ID=1001
ARG APP_GROUP_ID=1001

RUN addgroup -g $APP_GROUP_ID bentopdf && \
    adduser -u $APP_USER_ID -G bentopdf -D -s /bin/sh bentopdf

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run/nginx && \
    chown -R bentopdf:bentopdf /usr/share/nginx/html /var/cache/nginx /var/log/nginx /var/run/nginx

RUN sed -i 's/user nginx;/user bentopdf;/' /etc/nginx/nginx.conf

EXPOSE 80

USER bentopdf

CMD ["nginx", "-g", "daemon off;"]