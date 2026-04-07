.PHONY: dev dev-up dev-down build up down logs backend-dev frontend-dev

# Desarrollo - levantar servicios de infraestructura
dev-up:
	docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d postgres redis

# Desarrollo - parar todo
dev-down:
	docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml down

# Desarrollo - backend con hot reload
backend-dev:
	cd backend && go run cmd/server/main.go

# Desarrollo - frontend con hot reload
frontend-dev:
	cd frontend && npm run dev

# Produccion - build y levantar
build:
	docker compose -f docker/docker-compose.yml build

up:
	docker compose -f docker/docker-compose.yml up -d

down:
	docker compose -f docker/docker-compose.yml down

logs:
	docker compose -f docker/docker-compose.yml logs -f

# Logs de un servicio especifico
logs-%:
	docker compose -f docker/docker-compose.yml logs -f $*
