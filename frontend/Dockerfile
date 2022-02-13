FROM node:14-alpine
RUN apk add --no-cache tini

WORKDIR /app
COPY .yarn/ .yarn/
COPY .yarnrc.yml .pnp.cjs .pnp.loader.mjs package.json yarn.lock ./
RUN yarn install --immutable --immutable-cache

COPY . .
RUN yarn build

MAINTAINER Bacchus <contact@bacchus.snucse.org>
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["yarn", "start"]
