FROM node:14-alpine as files
WORKDIR /app
COPY . .
RUN mv /app/.yarn /.yarn

FROM node:14-alpine
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=files /.yarn/ .yarn/
COPY --from=files /app/.yarnrc.yml /app/.pnp.js /app/package.json /app/yarn.lock ./
RUN yarn install --immutable --immutable-cache
COPY --from=files /app/ ./
RUN yarn build
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["yarn", "start"]
