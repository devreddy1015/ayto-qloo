# AYTO: Node backend that runs Qloo's official harness (`qloo mcp`) as a
# local stdio MCP server. It needs a long-running container, not serverless.
FROM node:22-slim

ENV NODE_ENV=production \
    PORT=8080 \
    QLOO_BASE_URL=https://hackathon.api.qloo.com \
    QLOO_TRUSTED_BASE_URL=https://hackathon.api.qloo.com \
    QLOO_HOME=/app/.qloo-home

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Run as the image's unprivileged user; the cache lives in a writable folder.
RUN mkdir -p /app/.cache /app/.qloo-home && chown -R node:node /app/.cache /app/.qloo-home
USER node

EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=10s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
