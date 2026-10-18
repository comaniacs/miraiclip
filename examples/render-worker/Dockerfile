# Render worker image: Node + Google Chrome (found automatically, and it can
# encode H.264 for MP4 output; plain Chromium builds often can't) + the worker.
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget ca-certificates gnupg fonts-noto fonts-noto-color-emoji \
 && wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
 && apt-get install -y --no-install-recommends /tmp/chrome.deb \
 && rm -rf /tmp/chrome.deb /var/lib/apt/lists/*
WORKDIR /app
COPY package.json server.mjs ./
RUN npm install --omit=dev
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
