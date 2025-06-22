#!/bin/bash
# Script to regenerate package-lock.json with correct dependencies

set -e

echo "Cleaning up old dependencies..."
rm -rf node_modules package-lock.json

echo "Installing dependencies with Node.js $(node --version)..."
npm install

echo "Package-lock.json regenerated successfully!"
echo "You can now run the Docker build."
