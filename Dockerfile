# Build stage for frontend
FROM oven/bun:1 AS frontend-builder
WORKDIR /app
COPY src/package.json src/bun.lock* ./
RUN bun install
COPY src/ ./
RUN bun run build --outdir=../dist

# Build stage for Go backend
FROM golang:1.21-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY main.go ./
# Copy dist from frontend builder
COPY --from=frontend-builder /app/dist ./dist
RUN go build -o nanostatus main.go

# Final stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=backend-builder /app/nanostatus .
EXPOSE 8080
ENV PORT=8080
CMD ["./nanostatus"]

