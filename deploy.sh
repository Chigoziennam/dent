#!/bin/bash
# Deploy ShipLog to shiplog.lumenai.sbs
# Usage: ./deploy.sh   (asks for the server password)
set -e
echo "▶ Building..."
npm run build
echo "▶ Packaging..."
tar -czf /tmp/shiplog-dist.tar.gz -C dist .
echo "▶ Uploading to 162.35.165.66..."
scp /tmp/shiplog-dist.tar.gz root@162.35.165.66:/root/lumen-stack/shiplog-dist.tar.gz
echo "▶ Extracting on server..."
ssh root@162.35.165.66 'cd /root/lumen-stack && rm -rf shiplog.new && mkdir shiplog.new && tar -xzf shiplog-dist.tar.gz -C shiplog.new 2>/dev/null; rm -rf shiplog.old && mv shiplog shiplog.old && mv shiplog.new shiplog && rm shiplog-dist.tar.gz'
rm /tmp/shiplog-dist.tar.gz
echo "✅ Deployed → https://shiplog.lumenai.sbs"
