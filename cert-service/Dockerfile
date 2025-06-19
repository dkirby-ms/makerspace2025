# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Install git, tar and other build tools needed for app deployment
RUN apk add --no-cache git tar

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S certservice -u 1001 -G nodejs

# Create deployment directory and set permissions
RUN mkdir -p /tmp/makerspace-deployments && \
    chown -R certservice:nodejs /tmp/makerspace-deployments

# Change ownership of app directory
RUN chown -R certservice:nodejs /app

# Switch to non-root user
USER certservice

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
