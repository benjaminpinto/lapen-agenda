#!/bin/bash
# Docker Cleanup Script
# Run this periodically to keep Docker disk usage under control

echo "🧹 Docker Cleanup Script"
echo "========================"
echo ""

# Show current disk usage
echo "📊 Current Docker disk usage:"
docker system df
echo ""

# Ask for confirmation
read -p "Do you want to clean up Docker? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "🗑️  Removing unused containers, networks, images, and build cache..."
docker system prune -af --volumes

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 New Docker disk usage:"
docker system df
