.PHONY: build build-frontend build-backend clean run

# Build everything
build: build-frontend build-backend

# Build frontend
build-frontend:
	@echo "📦 Building frontend..."
	cd src && bun run build --outdir=../dist

# Build Go backend with embedded static files
build-backend:
	@echo "🔨 Building Go backend..."
	go build -o nanostatus main.go

# Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	rm -rf dist nanostatus

# Run the application
run: build
	@echo "🚀 Starting server..."
	./nanostatus

# Development: run frontend dev server
dev-frontend:
	cd src && bun run dev

# Development: run Go server (requires dist folder)
dev-backend:
	go run main.go

