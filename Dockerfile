# Base image. AWS builds pull from ECR Public; other hosts can override it
# (Render passes environment variables as build args: NODE_IMAGE in render.yaml).
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:20-alpine

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Dates ("today", the 05:00 dawn batch) follow Korean time.
ENV TZ=Asia/Seoul

RUN apk add --no-cache su-exec tzdata
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
RUN mkdir -p /tmp/bedi-avatars /app/.data && chown nextjs:nodejs /tmp/bedi-avatars /app/.data

COPY --from=builder /app/public ./public
COPY --from=builder /app/public/avatar-style-refs ./avatar-style-refs
# Safety evaluation sets (aggregate metrics via /api/admin/safety-eval)
COPY --from=builder /app/eval/dev ./eval/dev
COPY --from=builder /app/eval/heldout ./eval/heldout
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

ENV AVATAR_LOCAL_DIR=/tmp/bedi-avatars
EXPOSE 3000
# The entrypoint prepares the data directories and runs the server as `nextjs`.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
