FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./

ENV PORT=5001
ENV WHATSAPP_SESSION_DIR=/data/auth

EXPOSE 5001

CMD ["node", "index.js"]
