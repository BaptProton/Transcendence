.PHONY: all help setup scripts ssl env frontend build rebuild up down clean fclean re purge logs

GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m

all: setup build up
	@echo "$(GREEN)═══════════════════════════════════════════════════════════$(NC)"
	@echo "$(GREEN)  ✓ ft_transcendence is ready!$(NC)"
	@echo "$(GREEN)  Access at: https://localhost:8443$(NC)"
	@echo "$(GREEN)═══════════════════════════════════════════════════════════$(NC)"

help:
	@echo "$(GREEN)ft_transcendence - Available commands:$(NC)"
	@echo ""
	@echo "  $(YELLOW)make$(NC)          - Setup + build + start (single command launch)"
	@echo ""
	@echo "$(GREEN)Setup & Build:$(NC)"
	@echo "  $(YELLOW)make setup$(NC)    - First time setup (SSL + .env + frontend)"
	@echo "  $(YELLOW)make frontend$(NC) - Build frontend only"
	@echo "  $(YELLOW)make build$(NC)    - Build Docker containers"
	@echo "  $(YELLOW)make rebuild$(NC)  - Build containers without cache"
	@echo ""
	@echo "$(GREEN)Docker:$(NC)"
	@echo "  $(YELLOW)make up$(NC)       - Start all services"
	@echo "  $(YELLOW)make down$(NC)     - Stop all services"
	@echo "  $(YELLOW)make logs$(NC)     - View logs"
	@echo ""
	@echo "$(GREEN)Cleanup:$(NC)"
	@echo "  $(YELLOW)make clean$(NC)    - Stop and remove containers"
	@echo "  $(YELLOW)make fclean$(NC)   - Full clean (including volumes)"
	@echo "  $(YELLOW)make re$(NC)       - Rebuild everything from scratch"
	@echo "  $(YELLOW)make purge$(NC)    - $(RED)Purge ALL Docker cache$(NC)"

setup: scripts ssl env frontend
	@echo "$(GREEN)✓ Setup complete! You can now run: make build && make up$(NC)"

scripts:
	@chmod +x generate_ssl.sh

ssl:
	@bash generate_ssl.sh

env:
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)Creating .env file from template...$(NC)"; \
		cp .env.exemple .env; \
		echo "$(GREEN)✓ .env file created$(NC)"; \
		echo "$(YELLOW)⚠ Please edit .env and add your OAuth 42 credentials$(NC)"; \
	else \
		echo "$(GREEN)✓ .env file already exists$(NC)"; \
	fi

frontend:
	@echo "$(YELLOW)Building frontend...$(NC)"
		cd frontend && npm install && npm run build;
	@echo "$(GREEN)✓ Frontend built complete$(NC)"

build:
	@echo "$(YELLOW)Building Docker containers...$(NC)"
	docker compose build
	@echo "$(GREEN)✓ Build complete$(NC)"

rebuild:
	@echo "$(YELLOW)Rebuilding Docker containers (no cache)...$(NC)"
	docker compose build --no-cache
	@echo "$(GREEN)✓ Rebuild complete$(NC)"

up:
	@echo "$(YELLOW)Starting all services...$(NC)"
	docker compose up -d
	@echo "$(GREEN)✓ Services started$(NC)"

down:
	@echo "$(YELLOW)Stopping all services...$(NC)"
	docker compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

clean: down
	@echo "$(YELLOW)Removing containers...$(NC)"
	docker compose down -v --remove-orphans
	@echo "$(GREEN)✓ Containers removed$(NC)"

fclean: clean
	@echo "$(YELLOW)Full cleanup (containers + volumes + images)...$(NC)"
	docker compose down -v --rmi all --remove-orphans
	@rm -rf nginx/ssl/cert.pem nginx/ssl/key.pem
	@rm -rf frontend/dist
	@rm -rf frontend/node_modules
	@echo "$(GREEN)✓ Full cleanup complete$(NC)"

re: fclean setup build up
	@echo "$(GREEN)═══════════════════════════════════════════════════════════$(NC)"
	@echo "$(GREEN)  ✓ Rebuild complete!$(NC)"
	@echo "$(GREEN)  Access at: https://localhost:8443$(NC)"
	@echo "$(GREEN)═══════════════════════════════════════════════════════════$(NC)"

purge:
	@echo "$(RED)═══════════════════════════════════════════════════════════$(NC)"
	@echo "$(RED)  ⚠️  ATTENTION: DOCKER CACHE PURGE  ⚠️$(NC)"
	@echo "$(RED)═══════════════════════════════════════════════════════════$(NC)"
	@echo ""
	@echo "$(YELLOW)Cette commande va:$(NC)"
	@echo "  - $(RED)Purger TOUT le cache Docker de votre machine$(NC)"
	@echo "  - $(RED)Supprimer TOUTES les images Docker non utilisées$(NC)"
	@echo ""
	@echo "$(YELLOW)Cela peut affecter vos autres projets Docker!$(NC)"
	@echo ""
	@read -p "Êtes-vous sûr de vouloir continuer? [y/N] " confirm && [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ] || (echo "$(GREEN)Annulé.$(NC)" && exit 1)
	@echo ""
	@echo "$(RED)Purging ALL Docker cache...$(NC)"
	docker system prune -af --volumes 2>/dev/null || true
	@echo "$(GREEN)═══════════════════════════════════════════════════════════$(NC)"
	@echo "$(GREEN)  ✓ Docker cache purged!$(NC)"
	@echo "$(GREEN)═══════════════════════════════════════════════════════════$(NC)"

logs:
	docker compose logs -f
