FROM node:20.19-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json yarn.lock ./

# Install ALL dependencies (dev included, for ts-node-dev)
RUN yarn install --frozen-lockfile

# Copy application code
COPY . .

# Generate Prisma client AND GraphQL types
RUN npx prisma generate && \
    npx graphql-codegen

# Set environment
ENV NODE_ENV=production

EXPOSE 3000

# Use ts-node-dev to run TypeScript directly (no build step)
CMD ["yarn", "server"]