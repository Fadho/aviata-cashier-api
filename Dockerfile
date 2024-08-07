FROM node:alpine

RUN mkdir -p /mac/Documents/sportsbook/aviata-cashier-service && chown -R node:node /mac/Documents/sportsbook/aviata-cashier-service

WORKDIR /mac/Documents/sportsbook/aviata-cashier-service

COPY package.json ./

USER node

ENV PORT=3000

RUN yarn install --pure-lockfile

COPY --chown=node:node . .

RUN export NODE_OPTIONS="--max-old-space-size=8192"

EXPOSE 3000:3000

CMD ["node", "./src/index.js"]
