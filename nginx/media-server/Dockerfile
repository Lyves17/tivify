# SECURITY: Pinned base image version for reproducible builds
FROM nginx:1.25.5-alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

# SECURITY: Run as non-root user instead of root
# nginx Alpine image includes www-data user by default
USER nginx
