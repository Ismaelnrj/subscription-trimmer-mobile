# Node 22 LTS. Was node:18-slim, which reached end of life in April 2025 and so
# stopped receiving security patches for the runtime and its bundled OpenSSL.
# 22 is the active LTS line, and nothing here blocks it: every dependency in
# backend/package.json is pure JavaScript (bcryptjs, pg, express,
# jsonwebtoken, google-auth-library, express-rate-limit, cors), so there is no
# native addon compiled against a specific ABI.
FROM node:22-slim

# NODE_ENV=production is defence in depth, NOT a security control. Express and
# several libraries read it to disable development conveniences (verbose error
# pages, view caching off). Nothing in server.js gates a security decision on
# it any more: the JWT_SECRET check used to, which meant the check never ran
# here, because this image did not set NODE_ENV and Railway does not set it for
# a Dockerfile build.
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# --omit=dev is the current spelling of the deprecated --production.
RUN npm install --omit=dev

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
