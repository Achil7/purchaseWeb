NAME=campmanager
TAG=latest
DOCKER_USER=your-dockerhub-username

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
	@echo "  make clean    - Clean up old images"
	@echo ""
	@echo "=== EC2 Server ==="
	@echo "  ./deploy.sh   - Run on EC2 to pull and start container"
