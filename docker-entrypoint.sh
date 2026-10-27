#!/bin/sh
set -e

echo "🔄 Running Prisma database sync..."
# The local binary, never `npx prisma`: when the CLI is missing, npx silently downloads
# the registry's `latest` (Prisma 8 RC since 2026-10, which has no `db push` and rejects
# this schema) and runs it against the live database. Missing CLI must fail loudly here.
./node_modules/.bin/prisma db push

echo "🚀 Starting server..."
exec node server/app.js
