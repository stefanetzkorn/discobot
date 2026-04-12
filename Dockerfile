# Use the official Bun image. Pin to a major version so updates don't break the build.
FROM oven/bun:1 AS base
WORKDIR /app

# Copy only the dependency files first so Docker can cache this layer.
# The install step is only re-run when package.json or bun.lock changes,
# not on every source code change.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Install fonts required by @napi-rs/canvas to render text on Linux.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-liberation && rm -rf /var/lib/apt/lists/*

# Copy the rest of the source code.
COPY . .

CMD ["bun", "run", "index.ts"]
