#!/bin/bash
# Usage: ./dev-send.sh "your message here"
source .env

curl -s -X POST http://localhost:${PORT:-8080}/webhook \
  -H "Content-Type: application/json" \
  -d "{\"message\": {\"chat\": {\"id\": $DEV_CHAT_ID}, \"from\": {\"id\": $DEV_USER_ID}, \"text\": \"$1\"}}" \
  | jq .
