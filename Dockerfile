FROM node:20-alpine

RUN mkdir -p /mac/Documents/sportsbook/aviata-cashier-service && chown -R node:node /mac/Documents/sportsbook/aviata-cashier-service

WORKDIR /mac/Documents/sportsbook/aviata-cashier-service

COPY package.json ./

USER node

RUN npm install

COPY --chown=node:node . .

ENV NODE_OPTIONS=--max-old-space-size=8192

EXPOSE 3002

CMD ["node", "./src/cluster.js"]
