FROM node:20-alpine
RUN apk add --no-cache bash curl
RUN mkdir -p /app

WORKDIR /app
RUN mkdir tx-indexer
RUN set -x

COPY ./tx-indexer ./tx-indexer
COPY ./tx-indexer/.env ./tx-indexer

WORKDIR /app/tx-indexer
RUN npm install

WORKDIR /app
RUN npm install -g typescript ts-node
RUN npm install -g pm2
