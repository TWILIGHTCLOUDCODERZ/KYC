FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist

# GEMINI_API_KEY is injected at deploy time via Cloud Run --set-secrets, never baked into the image.
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
