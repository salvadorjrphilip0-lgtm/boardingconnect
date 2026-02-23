#!/bin/bash
# Setup script to create Supabase storage bucket for avatars
# Usage: bash scripts/setup-storage-bucket.sh

set -e

echo "Setting up Supabase storage bucket for avatars..."

# Check if Supabase URL and key are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set"
  exit 1
fi

# Create avatars bucket via Supabase REST API
echo "Creating 'avatars' bucket..."

curl -X POST \
  "$SUPABASE_URL/storage/v1/b" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "avatars",
    "public": true,
    "file_size_limit": 5242880
  }' || echo "Bucket may already exist or error occurred"

# Update bucket to public (if it exists)
echo "Making bucket public..."
curl -X PATCH \
  "$SUPABASE_URL/storage/v1/b/avatars" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "public": true,
    "file_size_limit": 5242880
  }' || echo "Could not update bucket"

echo "Setup complete! The 'avatars' bucket is ready for avatar uploads."
echo ""
echo "Next steps:"
echo "1. Run the migration: psql -f migrations/001_add_profile_picture.sql"
echo "2. Restart your backend server"
echo "3. Users can now upload avatars via POST /auth/me/avatar/upload"
