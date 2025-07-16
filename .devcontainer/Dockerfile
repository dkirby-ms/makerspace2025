# Use the official TypeScript/Node.js development container
FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bullseye

# Install additional system packages
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        curl \
        wget \
        git \
        ca-certificates \
        gnupg \
        lsb-release \
        mosquitto \
        mosquitto-clients

# Clean up
RUN apt-get autoremove -y && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Set the default user
USER node
