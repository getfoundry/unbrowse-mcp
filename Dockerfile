# Use Node.js LTS version
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and configuration files
COPY . .

# Build the application
RUN pnpm build

# Expose port if needed (adjust based on your application)
EXPOSE 3000

# Run the application
CMD ["node", ".smithery/index.cjs"]
