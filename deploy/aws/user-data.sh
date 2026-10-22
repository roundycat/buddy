#!/bin/bash
# EC2 bootstrap for Beddy 2.0 (placeholders are filled by deploy.sh)
set -euxo pipefail
exec > >(tee -a /var/log/beddy-bootstrap.log) 2>&1

# Small swap so the Next.js build never runs out of memory
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
fi

dnf install -y docker unzip cronie
systemctl enable --now docker crond
mkdir -p /opt/beddy

cat > /opt/beddy/update.sh <<'EOS'
#!/bin/bash
# Pull the latest source bundle from S3, rebuild, restart. Safe to re-run.
set -euo pipefail
REGION=__REGION__
BUCKET=__BUCKET__
PARAM=__PARAM__
cd /opt/beddy
aws s3 cp "s3://$BUCKET/deploy/source.zip" source.zip --region "$REGION" --only-show-errors
aws s3 cp "s3://$BUCKET/deploy/app.env" base.env --region "$REGION" --only-show-errors
rm -rf app && mkdir app && unzip -q source.zip -d app
secret() { aws ssm get-parameter --region "$REGION" --name "$PARAM/$1" --with-decryption --query Parameter.Value --output text; }
APP_URL="$(aws ssm get-parameter --region "$REGION" --name "$PARAM/APP_URL" --query Parameter.Value --output text 2>/dev/null || echo http://localhost)"
CRON_SECRET="$(secret CRON_SECRET)"
{
  cat base.env
  echo "AUTH_SESSION_SECRET=$(secret AUTH_SESSION_SECRET)"
  echo "CRON_SECRET=$CRON_SECRET"
  echo "NEXT_PUBLIC_APP_URL=$APP_URL"
} > runtime.env
chmod 600 runtime.env
docker build -t beddy:latest app
docker rm -f beddy 2>/dev/null || true
docker run -d --name beddy --restart unless-stopped --env-file runtime.env -p 80:3000 \
  --log-opt max-size=20m --log-opt max-file=3 beddy:latest
docker image prune -f >/dev/null 2>&1 || true
# Dawn batch: 05:00 KST (= 20:00 UTC) — mission agent, summaries, KB refresh
echo "0 20 * * * root curl -s -X POST -H 'x-bedi-cron-secret: $CRON_SECRET' http://localhost/api/cron/daily >> /var/log/beddy-cron.log 2>&1" > /etc/cron.d/beddy-daily
chmod 600 /etc/cron.d/beddy-daily
echo "beddy updated $(date -Is)"
EOS
chmod 700 /opt/beddy/update.sh
/opt/beddy/update.sh
