FROM node:22.14.0-bookworm-slim AS development
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

FROM development AS build
RUN npm run build

FROM nginx:1.28.0-alpine AS production
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV MAPF_CORE_PROXY_TARGET=http://core:8000
EXPOSE 5173
