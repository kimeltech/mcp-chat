#!/bin/bash
# Helper script to manage the mcp-chat application

set -e

PROJECT_DIR="/home/cgaete/docker/ecosemantic/github/mcp-chat"

case "$1" in
  start)
    echo "🚀 Starting mcp-chat..."
    cd "$PROJECT_DIR"
    docker compose up -d
    echo "✅ Application started at http://localhost:3000"
    ;;
    
  stop)
    echo "⏹️  Stopping mcp-chat..."
    cd "$PROJECT_DIR"
    docker compose down
    echo "✅ Application stopped"
    ;;
    
  restart)
    echo "🔄 Restarting mcp-chat..."
    cd "$PROJECT_DIR"
    docker compose restart app
    echo "✅ Application restarted"
    ;;
    
  reload-config)
    echo "🔄 Reloading model configuration..."
    cd "$PROJECT_DIR"
    echo "   Validating models..."
    python3 validate_models.py 2>&1 | tail -20
    echo ""
    echo "   Restarting application..."
    docker compose restart app
    sleep 3
    echo "✅ Configuration reloaded! Check http://localhost:3000"
    ;;
    
  rebuild)
    echo "🔨 Rebuilding mcp-chat (use this after package.json changes)..."
    cd "$PROJECT_DIR"
    docker compose down
    docker compose build --no-cache app
    docker compose up -d
    echo "✅ Application rebuilt and started"
    ;;
    
  logs)
    echo "📋 Showing logs (Ctrl+C to exit)..."
    cd "$PROJECT_DIR"
    docker compose logs -f app
    ;;
    
  status)
    echo "📊 Application status:"
    cd "$PROJECT_DIR"
    docker compose ps
    ;;
    
  validate)
    echo "🧪 Validating models..."
    cd "$PROJECT_DIR"
    python3 validate_models.py
    ;;
    
  discover)
    echo "🔍 Discovering models..."
    cd "$PROJECT_DIR"
    shift
    python3 discover_models.py "$@"
    ;;
    
  *)
    echo "MCP Chat Management Script"
    echo ""
    echo "Usage: $0 {command}"
    echo ""
    echo "Commands:"
    echo "  start          - Start the application"
    echo "  stop           - Stop the application"
    echo "  restart        - Restart the application"
    echo "  reload-config  - Validate and reload model configuration (NO rebuild needed!)"
    echo "  rebuild        - Full rebuild (use after dependency changes)"
    echo "  logs           - Show application logs"
    echo "  status         - Show container status"
    echo "  validate       - Validate model configuration"
    echo "  discover       - Discover models (pass options like: discover --tools)"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 reload-config    # After changing models.config.json"
    echo "  $0 discover --tools --max-price 2.0"
    exit 1
    ;;
esac
