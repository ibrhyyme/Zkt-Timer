FROM node:20.19-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y openssl zip && \
    apt-get clean

ARG ENV
ARG RELEASE_NAME
ARG RESOURCES_BASE_URI
ARG DEPLOYMENT_ID
ARG SENTRY_AUTH_TOKEN

ENV ENV=$ENV
ENV RESOURCES_BASE_URI=$RESOURCES_BASE_URI
ENV RELEASE_NAME=$RELEASE_NAME
ENV DEPLOYMENT_ID=$DEPLOYMENT_ID
ENV DEPLOYING=true

# Sentry ayarları
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV SENTRY_ORG=zkttimer
ENV SENTRY_ENVIRONMENT=$ENV
ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Build işlemleri (Prisma, GraphQL ve tüm kod derleme)
RUN npx prisma generate && \
    npx graphql-codegen && \
    yarn build && \
    yarn compile-server && \
    yarn compile-client && \
    yarn compile-shared

# Map dosyalarını temizle
RUN find ./dist -name "*.map" -type f -delete && \
    find ./build -name "*.map" -type f -delete

# MJML template'leri ve diğer resource'ları kopyala
RUN mkdir -p ./build/server/resources && \
    cp -r ./server/resources/mjml_templates ./build/server/resources/mjml_templates && \
    cp ./server/resources/not_found.html ./build/server/resources/not_found.html

# Kaynak kodları temizle, sadece build ve production bağımlılıklarını tut
RUN rm -rf ./client ./server ./shared ./test && \
    yarn install --production --frozen-lockfile

# Final stage - daha küçük image
FROM node:20.19-slim
ENV NODE_ENV=production

RUN apt-get update && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Sadece gerekli dosyaları kopyala
COPY --from=builder /app/build ./build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.env ./.env

EXPOSE 3000

CMD ["node", "build/server/app.js"]