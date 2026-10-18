# Frontend image: build the React app, then serve it with nginx.

# 1. Build the static files.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# The API path the browser calls, passed in from VITE_API_URL in the root .env.
# nginx forwards it to the backend on the same origin, so no cross-origin calls are needed.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# 2. Serve them with nginx (also proxies /api to the backend).
FROM nginx:alpine
# Files in templates/ get their ${VARIABLES} filled in from the environment at start-up
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
