from golang:1.16.6-alpine3.14 as builder
workdir /app
copy . .
run go build -o reservation_backend

# ===

from alpine:3.14
maintainer Bacchus <contact@bacchus.snucse.org>
copy --from=builder /app/reservation_backend /
entrypoint ["/reservation_backend"]
