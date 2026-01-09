#!/bin/bash

set -e

echo "📦 Building NanoStatus..."

# Build frontend
echo "Building frontend..."
cd src
bun install
bun run build --outdir=../dist
cd ..

# Build Go backend
echo "Building Go backend..."
go build -o nanostatus main.go

echo "✅ Build complete! Run ./nanostatus to start the server."

