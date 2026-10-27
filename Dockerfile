FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# база и загрузки живут в отдельном томе, код образа их не трогает
ENV HOST=0.0.0.0 PORT=3100 NODE_ENV=production \
    DB_PATH=/storage/football.db UPLOADS_DIR=/storage/uploads
RUN mkdir -p /storage && chown -R node:node /storage /app
VOLUME ["/storage"]

USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3100/api/catalog >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
