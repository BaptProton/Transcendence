#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${YELLOW}Generating SSL certificates...${NC}"

SSL_DIR="./nginx/ssl"

mkdir -p "$SSL_DIR"

# Generation des certificats SSL auto-signés
if command -v openssl > /dev/null 2>&1; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/key.pem" \
        -out "$SSL_DIR/cert.pem" \
        -subj "/C=CH/ST=Vaud/L=Lausanne/O=42/OU=Transcendence/CN=localhost"

    chmod 644 "$SSL_DIR/cert.pem"
    chmod 600 "$SSL_DIR/key.pem"

    echo -e "${GREEN}✓ SSL certificates generated${NC}"
else
    echo -e "${YELLOW}✗ OpenSSL not found.${NC}" >&2
    echo -e "${YELLOW}  Please install OpenSSL and retry.${NC}" >&2
    exit 1
fi
