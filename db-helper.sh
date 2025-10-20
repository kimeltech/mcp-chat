#!/bin/bash

# Database management helper script

case "$1" in
  reset)
    echo "🔄 Resetting database..."
    docker-compose down -v
    docker-compose up postgres -d
    sleep 3
    docker-compose exec -T postgres psql -U mcpuser -d mcpchat -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    echo "✅ Database reset complete"
    ;;
    
  migrate)
    echo "🔄 Running migrations..."
    pnpm db:push
    echo "✅ Migrations complete"
    ;;
    
  studio)
    echo "🎨 Opening Drizzle Studio..."
    pnpm db:studio
    ;;
    
  psql)
    echo "💾 Connecting to PostgreSQL..."
    docker-compose exec postgres psql -U mcpuser -d mcpchat
    ;;
    
  *)
    echo "Database management helper"
    echo ""
    echo "Usage: $0 {reset|migrate|studio|psql}"
    echo ""
    echo "Commands:"
    echo "  reset    - Reset database (WARNING: deletes all data)"
    echo "  migrate  - Run database migrations"
    echo "  studio   - Open Drizzle Studio (database GUI)"
    echo "  psql     - Connect to PostgreSQL CLI"
    exit 1
    ;;
esac
