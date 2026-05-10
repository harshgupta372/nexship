# Use slim Alpine image to keep the container small
FROM node:20-alpine

WORKDIR /app

# Copy manifests first so Docker caches the npm install layer
# separately from source changes — speeds up rebuilds significantly
COPY package*.json ./
RUN npm ci --only=production

# Copy source after installing deps
COPY . .

EXPOSE 3001

CMD ["node", "index.js"]
