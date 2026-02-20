# --- Stage 1: Builder ---
FROM node:20.19-slim AS builder

WORKDIR /app

# Sistem bağımlılıkları (Python, make, g++ gerekebilir node-gyp için)
RUN apt-get update && \
    apt-get install -y openssl python3 make g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Bağımlılıkları yükle
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Kaynak kodları kopyala
COPY . .

# Production ortamı değişkenleri
ENV NODE_ENV=production
ENV DEPLOYING=true

# Derleme işlemi (Typescript -> Javascript)
# 1. build klasörünü oluştur
# 2. Prisma ve GraphQL kodlarını üret
# 3. yarn deploy (build, compile-server, compile-shared çalıştırır)
RUN rm -rf build && \
    mkdir -p build client/@types/generated && \
    npx prisma generate && \
    yarn deploy

# Gereksiz typescript kaynaklarını temizle ve build edilenleri yerine taşı
# DİKKAT: 'dist' klasörünü silmiyoruz, Nginx için gerekli!
RUN cp -r ./server/resources/mjml_templates ./build/server/resources/mjml_templates && \
    cp ./server/resources/not_found.html ./build/server/resources/not_found.html

# --- Stage 2: Runtime (Final Image) ---
FROM node:20.19-slim

ENV NODE_ENV=production

WORKDIR /app

# Runtime için gerekli sistem kütüphaneleri (Prisma için openssl şart)
RUN apt-get update && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Sadece production bağımlılıklarını yüklemek için package.json
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile && yarn cache clean

# Builder aşamasından derlenmiş dosyaları al
# 1. Server kodu (Compiled JS)
COPY --from=builder /app/build/server ./server
# 2. Shared kodu (Compiled JS)
COPY --from=builder /app/build/shared ./shared
# 3. Client build dosyaları (Nginx için gerekli statik dosyalar)
COPY --from=builder /app/dist ./dist
# 4. Public klasörü (Resimler vs. için)
COPY --from=builder /app/public ./public
# 5. Prisma şeması ve client (Runtime'da gerekebilir)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/schema.prisma ./schema.prisma

# KRITIK: Server kodu, runtime'da 'client/util/algorithms' klasörüne ihtiyaç duyuyor.
# Bu yüzden derlenmiş client kodunu (build/client) değil, orijinal client kaynak kodunun bir kısmını da kopyalamalıyız.
# Ancak build edilen server dosyasının içinde require yolu '../../../client/...' şeklindedir.
# Bu yapıya uymak için 'client' klasörünü oluşturup içine gerekli dosyaları koymalıyız.
# Not: 'build/client' zaten derlenmiş JS dosyalarıdır, server bunları kullanabilir.
COPY --from=builder /app/build/client ./client
# i18n çeviri JSON dosyaları (Babel bunları derlemiyor, runtime'da require ile yükleniyor)
COPY --from=builder /app/client/i18n/locales ./client/i18n/locales

# Entrypoint script - container başlarken prisma db push çalıştırır
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

# Entrypoint kullan - önce DB sync, sonra sunucu başlatma
ENTRYPOINT ["./docker-entrypoint.sh"]