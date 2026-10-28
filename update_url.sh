#!/bin/bash

# Load the API_URL from the root .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$API_URL" ]; then
  echo "Error: API_URL is not set in .env"
  exit 1
fi

echo "==============================================="
echo "Updating Frontend Apps to use API: $API_URL"
echo "==============================================="

# 1. Customer App
echo "--> 1. Updating Customer App (mecfinder_app)..."
touch mecfinder_app/.env.local
sed -i '/NEXT_PUBLIC_API_URL/d' mecfinder_app/.env.local
echo "NEXT_PUBLIC_API_URL=$API_URL/api" >> mecfinder_app/.env.local

cd mecfinder_app
npm run cap:build
npm run cap:sync
cd ..

# 2. Provider App
echo "--> 2. Updating Provider App (mecfinder_provider_app)..."
touch mecfinder_provider_app/.env.local
sed -i '/NEXT_PUBLIC_API_URL/d' mecfinder_provider_app/.env.local
echo "NEXT_PUBLIC_API_URL=$API_URL/api" >> mecfinder_provider_app/.env.local

cd mecfinder_provider_app
npm run cap:build
npm run cap:sync
cd ..

# 3. Admin Panel
echo "--> 3. Updating Admin Panel (admin_pannel)..."
touch admin_pannel/.env.local
sed -i '/NEXT_PUBLIC_API_URL/d' admin_pannel/.env.local
echo "NEXT_PUBLIC_API_URL=$API_URL/api" >> admin_pannel/.env.local

echo "==============================================="
echo "✅ Success! All apps have been updated."
echo "==============================================="
