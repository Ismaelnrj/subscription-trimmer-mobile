# The ROOT image, for a Railway service with no Root Directory set (added in
# b811b755 for exactly that). It builds the same backend as backend/Dockerfile
# and must stay in step with it: on 2026-09-20 only that file moved to Node 22
# and NODE_ENV=production, and this one stayed on node:18-slim, which has had
# no security patches since April 2025 (found by the 2026-11-17 audit). Which
# of the two Railway builds is a dashboard fact (Settings > Root Directory, or
# the first FROM line of a build log), so both say the same thing now and
# __tests__/ci-secrets.test.js checks both. Do not delete this file to "tidy
# up": without it, a root build would try the Expo package.json instead.
FROM node:22-slim

# Defence in depth only, as in backend/Dockerfile: nothing in server.js gates a
# security decision on it.
ENV NODE_ENV=production

WORKDIR /app

COPY backend/package*.json ./
# Every backend dependency is pure JavaScript, so no build tools are needed.
RUN npm install --omit=dev

COPY backend/ .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
