#!/bin/sh
# Create the data directories, give them to the app user, then drop root.
# Hosting platforms mount persistent disks owned by root (e.g. Render /var/data).
set -e

for dir in "${BEDDY_DATA_DIR:-/app/.data}" "${AVATAR_LOCAL_DIR:-/tmp/bedi-avatars}"; do
  mkdir -p "$dir" 2>/dev/null || true
  if [ "$(id -u)" = "0" ]; then
    chown -R nextjs:nodejs "$dir" 2>/dev/null || true
  fi
done

if [ "$(id -u)" = "0" ]; then
  exec su-exec nextjs:nodejs "$@"
fi
exec "$@"
