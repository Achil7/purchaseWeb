NAME=campmanager
TAG=latest
DOCKER_USER=achil7

IMG=${NAME}:${TAG}

# Build Docker image
build:
	docker build -f deploy/Dockerfile -t ${IMG} .

# Tag image for Docker Hub
tag:
	docker tag ${IMG} ${DOCKER_USER}/${IMG}

# Push to Docker Hub
push:
	docker push ${DOCKER_USER}/${IMG}

# All in one deployment (build + tag + push)
deploy: build tag push

# === Test Server ===
TEST_TAG=test

TEST_IMG=${NAME}:${TEST_TAG}

# Build test image
test-build:
	docker build -f deploy/Dockerfile -t ${TEST_IMG} .

# Tag test image for Docker Hub
test-tag:
	docker tag ${TEST_IMG} ${DOCKER_USER}/${TEST_IMG}

# Push test image to Docker Hub
test-push:
	docker push ${DOCKER_USER}/${TEST_IMG}

# All in one test deployment (build + tag + push)
test-deploy: test-build test-tag test-push

# Clean up old images
clean:
	docker image prune -a -f

# Help
help:
	@echo "=== Local Development ==="
	@echo "  cd frontend && npm start   - Run frontend dev server"
	@echo "  cd backend && npm start    - Run backend dev server"
	@echo ""
	@echo "=== Docker Deployment ==="
	@echo "  make build    - Build Docker image"
	@echo "  make tag      - Tag image for Docker Hub"
	@echo "  make push     - Push image to Docker Hub"
	@echo "  make deploy   - Build, tag, and push (all in one)"
	@echo ""
	@echo "=== Test Server ==="
	@echo "  make test-build   - Build test Docker image"
	@echo "  make test-tag     - Tag test image for Docker Hub"
	@echo "  make test-push    - Push test image to Docker Hub"
	@echo "  make test-deploy  - Build, tag, and push test (all in one)"
	@echo ""
	@echo "=== Cleanup ==="
	@echo "  make clean    - Clean up old images"
	@echo ""
	@echo "=== EC2 Server ==="
	@echo "  ./deploy.sh   - Run on EC2 to pull and start container"
