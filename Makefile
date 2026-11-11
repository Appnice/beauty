# beauty: one SvelteKit app + Postgres. Docker is shared on this Mac: only the beauty-local project is touched.
COMPOSE := docker compose -p beauty-local -f compose.dev.yaml
# Development settings (optional, gitignored). .env is the self-host file for `docker compose up`.
-include .env.dev
export

.PHONY: deps db db-stop db-reset migrate seed dev build check typecheck lint test format e2e \
	deploy-test deploy deploy-caddy rollback deploy-local selfhost-check e2e-chain

node_modules: package-lock.json
	npm ci
	@touch node_modules

deps: node_modules

## Start local Postgres on 127.0.0.1:55440 and wait until it accepts connections
db:
	$(COMPOSE) up -d --wait db

## Stop local Postgres (data stays in the beauty-local volume)
db-stop:
	$(COMPOSE) down

## Remove local Postgres and its data
db-reset:
	$(COMPOSE) down -v

migrate: deps db
	npm run --silent migrate

## Create or re-create the demo salon (slug "demo")
seed: migrate
	npm run --silent seed

## Dev server on http://localhost:8150
dev: migrate
	npm run dev

build: deps
	npm run build

typecheck: deps
	npm run --silent typecheck

lint: deps
	npm run --silent lint

test: deps db
	npm run --silent test

format: deps
	npm run --silent format

## Type check, lint, unit + integration tests against the local Postgres
check: deps db migrate typecheck lint test deploy-test

## Browser tests (headless): build, fresh database beauty_e2e, app on 8151, fake ntfy on 8159
e2e: deps db build
	node scripts/e2e-db.ts
	npx playwright test

## The whole chain in one browser spec (sign-up -> admin -> booking -> waiting list -> reminder -> cancel), fresh DB
e2e-chain: deps db build
	node scripts/e2e-db.ts
	npx playwright test tests/e2e/chain.spec.ts

## Offline test of the deploy scripts (stubs for ssh, rsync, security, docker, curl; no host, no Keychain)
deploy-test:
	bash tools/test_deploy.sh

## MAIN SESSION ONLY: build linux/amd64, back up, ship to $$SSH_TARGET:/opt/beauty, start, smoke (docs/deploy.md)
deploy:
	tools/deploy.sh

## MAIN SESSION ONLY: add the beauty.appnice.dev site to the VPS Caddyfile once (validate, reload, restore)
deploy-caddy:
	tools/deploy-caddy.sh

## MAIN SESSION ONLY: previous image back on the VPS
rollback:
	tools/deploy.sh rollback

## Production compose on this Mac (app 8152) behind a throwaway Caddy (8153), smokes, memory, 503 check, down -v
deploy-local:
	tools/deploy-local.sh

## Self-host check: fresh copy in a temp dir, cp .env.example .env, docker compose up (8154), one salon, down -v
selfhost-check:
	tools/selfhost-check.sh
