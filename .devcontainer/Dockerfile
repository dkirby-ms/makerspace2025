
# Use the official TypeScript/Node.js development container
FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bullseye AS dev_container_auto_added_stage_label


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
        mosquitto-clients \
        python3 \
        python3-venv \
        python3-pip

# Install step-cli with architecture-specific logic
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "amd64" ]; then \
    wget -O /tmp/step.deb https://dl.smallstep.com/gh-release/cli/gh-release-header/v0.28.7/step-cli_0.28.7-1_amd64.deb; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
    wget -O /tmp/step.deb https://dl.smallstep.com/gh-release/cli/gh-release-header/v0.28.7/step-cli_0.28.7-1_arm64.deb; \
    else \
    echo "Unsupported architecture: $TARGETARCH" && exit 1; \
    fi \
    && dpkg -i /tmp/step.deb \
    && rm /tmp/step.deb

# Clean up
RUN apt-get autoremove -y && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Set the default user
USER node

