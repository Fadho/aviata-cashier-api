FROM node:alpine

RUN mkdir -p /mac/Documents/sportsbook/aviata-cashier-service && chown -R node:node /mac/Documents/sportsbook/aviata-cashier-service

WORKDIR /mac/Documents/sportsbook/aviata-cashier-service

COPY package.json ./

USER node

ENV NODE_ENV=development

ENV PORT=3000

RUN yarn install --pure-lockfile

COPY --chown=node:node . .

EXPOSE 3000:3000

CMD ["npm", "start"]
