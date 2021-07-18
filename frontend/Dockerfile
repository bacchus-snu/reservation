FROM node:14-alpine
RUN apk add --no-cache tini
WORKDIR /app
COPY . .
RUN yarn install --immutable --immutable-cache && yarn build
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["yarn", "start"]
