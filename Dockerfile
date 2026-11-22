FROM golang:1.22-alpine AS go-builder
ENV CGO_ENABLED=0 GOOS=linux GOMAXPROCS=2 GOGC=75
WORKDIR /src
COPY core/go.mod core/go.sum ./
RUN go mod download
COPY core/ .
RUN go build -p 2 -trimpath -ldflags="-s -w" -o /out/ms-core ./cmd/main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 appuser
WORKDIR /app
COPY --from=go-builder /out/ms-core /app/ms-core
USER appuser
EXPOSE 4000
ENTRYPOINT ["/app/ms-core"]
