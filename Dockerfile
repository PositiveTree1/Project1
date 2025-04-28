# 1. Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package manifests and install only deps
COPY package*.json ./
RUN npm ci --production

# Copy everything (including frontend)
COPY . .

# 2. Runtime stage
FROM node:18-alpine
WORKDIR /app

# Copy only the production node_modules + server code + firebase key
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/serviceAccountKey.json ./serviceAccountKey.json
COPY --from=builder /app/frontend ./frontend

# Expose the port your Express app listens on
ENV PORT=8080
EXPOSE 8080

# Start the app
CMD ["node", "server.js"]
