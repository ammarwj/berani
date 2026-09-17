FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

# NEXT_PUBLIC_* di-inline ke bundle saat `next build`, bukan dibaca saat runtime —
# jadi nilainya harus masuk lewat build arg. Menyetelnya di `environment:` compose
# tidak berpengaruh apa pun. Default di sini = nilai dev, supaya build tanpa arg
# tetap menghasilkan image yang bisa dipakai di laptop.
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ARG NEXT_PUBLIC_BUILD_ID=dev
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_BUILD_ID=$NEXT_PUBLIC_BUILD_ID

RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["bun", "server.js"]
