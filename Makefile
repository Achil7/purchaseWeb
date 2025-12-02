NAME=kwad-app
TAG=latest

IMG=${NAME}:${TAG}

build:
	docker buildx build -f .\deploy\image-build\dockerfile -t ${IMG} .

tag:
	docker tag ${IMG} achil7/${IMG}

push:
	docker push achil7/${IMG}

docker-run:
	docker run -p 8080:8080 ${IMG}