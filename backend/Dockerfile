FROM node:20-alpine

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    musl-dev \
    linux-headers \
    libc-dev

WORKDIR /app

COPY package*.json ./

# installation des dependences avec clean install / pour cache les infos si pas de changements
RUN npm ci

COPY src ./src

RUN mkdir -p /app/data /app/uploads/avatars

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch sur le non root user
USER nodejs

EXPOSE 8000

CMD ["node", "src/server.js"]
