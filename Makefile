.PHONY: lint typecheck test check frontend-lint format install

# Run all checks
check: lint typecheck test

# Lint Python code
lint:
	ruff check apps/ shared/ --fix

# Format Python code
format:
	ruff format apps/ shared/

# Type-check Python code
typecheck:
	mypy apps/ shared/

# Run Python tests
test:
	python -m pytest tests/ -v

# Lint frontend (TypeScript)
frontend-lint:
	cd apps/orchestrator/frontend && npx tsc --noEmit

# Install all packages in dev mode
install:
	pip install -e shared/
	pip install -e apps/orchestrator/
	pip install -e apps/sled/
	cd apps/orchestrator/frontend && npm install
