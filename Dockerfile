FROM node:alpine

RUN mkdir -p /mac/Documents/sportsbook/aviata-cashier-service && chown -R node:node /mac/Documents/sportsbook/aviata-cashier-service

WORKDIR /mac/Documents/sportsbook/aviata-cashier-service

COPY package.json ./

USER node

RUN yarn install --pure-lockfile

COPY --chown=node:node . .

RUN export NODE_OPTIONS="--max-old-space-size=8192"

EXPOSE 3002:3002

CMD ["node", "./src/cluster.js"]
