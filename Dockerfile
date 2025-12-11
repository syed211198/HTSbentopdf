# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build without type checking (vite build only)
# Pass SIMPLE_MODE and BASE_URL environment variables if provided
ARG SIMPLE_MODE=false
ARG BASE_URL=/
ENV SIMPLE_MODE=$SIMPLE_MODE
ENV BASE_URL=$BASE_URL
RUN npm run build -- --mode production

# Production stage
FROM nginxinc/nginx-unprivileged:stable-alpine-slim

LABEL org.opencontainers.image.source="https://github.com/alam00000/bentopdf"

ARG BASE_URL=/
ENV BASE_URL=$BASE_URL

# Switch to root to create directories and copy files (dont worry guys, its not a security issue as we switch it only for the duration of the build and its needed to create the destination directory based on BASE_URL)
USER root

COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf

RUN set -e; \
    SUBDIR=$(echo "${BASE_URL}" | sed 's:^/::; s:/$::'); \
    if [ -z "${SUBDIR}" ] || [ "${SUBDIR}" = "/" ]; then \
    DEST_DIR="/usr/share/nginx/html"; \
    else \
    DEST_DIR="/usr/share/nginx/html/${SUBDIR}"; \
    mkdir -p "${DEST_DIR}"; \
    fi; \
    chown -R nginx:nginx /usr/share/nginx/html; \
    echo "Destination directory: ${DEST_DIR}"

COPY --chown=nginx:nginx --from=builder /app/dist /tmp/dist

RUN set -e; \
    SUBDIR=$(echo "${BASE_URL}" | sed 's:^/::; s:/$::'); \
    if [ -z "${SUBDIR}" ] || [ "${SUBDIR}" = "/" ]; then \
    DEST_DIR="/usr/share/nginx/html"; \
    else \
    DEST_DIR="/usr/share/nginx/html/${SUBDIR}"; \
    fi; \
    cp -r /tmp/dist/* "${DEST_DIR}/"; \
    rm -rf /tmp/dist; \
    chown -R nginx:nginx /usr/share/nginx/html; \
    echo "Files copied to: ${DEST_DIR}"; \
    ls -la "${DEST_DIR}" | head -20

RUN mkdir -p /etc/nginx/tmp && chown -R nginx:nginx /etc/nginx/tmp

USER nginx

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]


# Old Dockerfile for Root User
# # Build stage
# FROM node:20-alpine AS builder

# WORKDIR /app

# COPY package*.json ./
# RUN npm ci

# COPY . .

# # Build without type checking (vite build only)
# # Pass SIMPLE_MODE environment variable if provided
# ARG SIMPLE_MODE=false
# ENV SIMPLE_MODE=$SIMPLE_MODE
# RUN npm run build -- --mode production

# # Production stage
# FROM nginx:alpine

# COPY --from=builder /app/dist /usr/share/nginx/html
# COPY nginx.conf /etc/nginx/nginx.conf

# EXPOSE 8080

# CMD ["nginx", "-g", "daemon off;"]
