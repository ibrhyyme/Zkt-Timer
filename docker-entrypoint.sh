#!/bin/sh
set -e

echo "🔄 Running Prisma database sync..."
npx prisma db push

echo "🚀 Starting server..."
exec node server/app.js
