# Builds the React bundle and copies it into the shared volume Caddy serves, then exits.
FROM node:22-slim AS build

WORKDIR /build
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
COPY openapi.json /openapi.json
# Fail the build rather than ship a bundle typed against a stale schema.
RUN npx openapi-typescript /openapi.json -o /tmp/schema.d.ts \
    && diff -u src/api/schema.d.ts /tmp/schema.d.ts \
    && npm run build

FROM alpine:3
COPY --from=build /build/dist /dist
COPY OGL.txt /dist/OGL.txt
# CC BY 3.0 attribution for the Game-icons.net glyphs bundled into the sheet.
COPY ICONS.txt /dist/ICONS.txt
# OFL notice for the two display faces served from this origin rather than from Google Fonts.
COPY FONTS.txt /dist/FONTS.txt
CMD ["sh", "-c", "rm -rf /output/* && cp -r /dist/. /output/"]
