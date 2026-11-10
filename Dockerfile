FROM node:22-alpine AS ui-builder
WORKDIR /src
COPY ui-sdk ./ui-sdk
COPY services ./services
COPY core/frontend-shell ./core/frontend-shell
WORKDIR /src/core/frontend-shell
RUN npm install --no-audit --no-fund && npm run build

FROM golang:1.22-alpine AS go-builder
WORKDIR /src
COPY go.work go.mod ./
COPY proto ./proto
COPY pkg ./pkg
COPY core ./core
COPY services ./services
COPY cmd ./cmd
COPY tools ./tools
COPY --from=ui-builder /src/core/embed_dist ./core/embed_dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/proveko ./cmd/cluster-runner

# Imagen final sin Node.js: únicamente Alpine y el binario estático Go con la UI embebida.
FROM alpine:3.20 AS runner
RUN apk add --no-cache ca-certificates tzdata postgresql-client
WORKDIR /app
COPY --from=go-builder /bin/proveko /bin/proveko
COPY core/migrations /app/core/migrations

EXPOSE 4000 5173
ENTRYPOINT ["/bin/proveko"]
