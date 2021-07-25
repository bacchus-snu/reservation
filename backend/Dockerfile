from golang:1.16.6-alpine3.14 as builder
workdir /app
copy . .
run go build -o reservation_backend

# ===

from postgres:13-alpine
run apk add --no-cache tini
maintainer Bacchus <contact@bacchus.snucse.org>
copy --from=builder /app/reservation_backend /
copy --from=builder /app/tables.sql /
entrypoint ["/sbin/tini", "--"]
cmd ["/reservation_backend"]
