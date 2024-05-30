FROM node:alpine

RUN mkdir -p /mac/Documents/sportsbook/aviata-cashier-service && chown -R node:node /mac/Documents/sportsbook/aviata-cashier-service

WORKDIR /mac/Documents/sportsbook/aviata-cashier-service

COPY package.json ./

USER node

ENV NODE_ENV=development

ENV PORT=3000

ENV ENCRYPTIONKEY='29a9eae9f28c5cbd457059b2ff2860375c3330b39e781b4927a8cce460fb1781'

ENV ENCRYPTIONIV='10012e923a88e9a8bc6247468e694452'

RUN yarn install --pure-lockfile

COPY --chown=node:node . .

EXPOSE 3000:3000

CMD ["npm", "start"]
