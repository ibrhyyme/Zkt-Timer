FROM node:20.19-slim AS builder

WORKDIR /app

# AWS CLI ve Python gereksiz olduğu için kaldırıldı, sadece openssl ve temel araçlar kaldı
RUN apt-get update && \
    apt-get install -y openssl zip && \
    apt-get clean

ARG ENV
ARG RELEASE_NAME
ARG RESOURCES_BASE_URI
ARG DEPLOYMENT_ID
ARG SENTRY_AUTH_TOKEN

ENV ENV=\$ENV
ENV RESOURCES_BASE_URI=\$RESOURCES_BASE_URI
ENV RELEASE_NAME=\$RELEASE_NAME
ENV DEPLOYMENT_ID=\$DEPLOYMENT_ID
ENV DEPLOYING=true

# Sentry ayarları korunuyor
ENV SENTRY_AUTH_TOKEN=\$SENTRY_AUTH_TOKEN
ENV SENTRY_ORG=zkttimer
ENV SENTRY_ENVIRONMENT=\$ENV
ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --production=false

COPY . .

# Build işlemleri (Prisma ve frontend derleme)
RUN npx prisma generate && yarn deploy

# Gereksiz dosyaların temizlenmesi ve klasör düzenleme
RUN find ./dist -name "*.map" -type f -delete 

FROM node:20.19-slim
ENV NODE_ENV=production
RUN apt-get update && \
    apt-get install -y openssl

WORKDIR /app
COPY --from=builder /app /app

EXPOSE 3000
# Not: docker-compose içinde bu komutu ezebiliriz veya buna güvenebiliriz