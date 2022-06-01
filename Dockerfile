FROM docker.io/library/node:16.10-alpine

WORKDIR /
COPY . .

# for yarn
RUN apk add git

RUN yarn --immutable
RUN yarn build

ENV NODE_ENV=production

CMD ["node", "build/bot.js"]
