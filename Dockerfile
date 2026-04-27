FROM node:18-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --production

COPY backend/ .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
