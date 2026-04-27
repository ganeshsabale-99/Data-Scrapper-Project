FROM postgres:15-alpine

# Set environment variables
ENV POSTGRES_DB=techparks
ENV POSTGRES_USER=techparks_user
ENV POSTGRES_PASSWORD=default_password

# Copy initialization scripts if needed
# COPY init-scripts/ /docker-entrypoint-initdb.d/

# Expose PostgreSQL port
EXPOSE 5432

# Start PostgreSQL
CMD ["postgres"]