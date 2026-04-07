#!/bin/bash
# validate-env.sh - Validates .env configuration before deployment
# Usage: ./scripts/validate-env.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

check_required() {
    local var_name=$1
    local var_value="${!var_name}"
    if [ -z "$var_value" ]; then
        echo -e "${RED}[ERROR] $var_name is not set${NC}"
        ((ERRORS++))
    fi
}

check_not_default() {
    local var_name=$1
    local default_value=$2
    local var_value="${!var_name}"
    if [ "$var_value" = "$default_value" ]; then
        echo -e "${YELLOW}[WARN] $var_name is using default value '$default_value' - change for production${NC}"
        ((WARNINGS++))
    fi
}

check_min_length() {
    local var_name=$1
    local min_len=$2
    local var_value="${!var_name}"
    if [ -n "$var_value" ] && [ ${#var_value} -lt $min_len ]; then
        echo -e "${RED}[ERROR] $var_name must be at least $min_len characters (current: ${#var_value})${NC}"
        ((ERRORS++))
    fi
}

echo "=== TIVIFY Environment Validation ==="
echo ""

# Load .env if it exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo "Loaded .env file"
else
    echo -e "${RED}[ERROR] .env file not found${NC}"
    exit 1
fi

echo ""
echo "--- Database ---"
check_required "DB_HOST"
check_required "DB_PORT"
check_required "DB_USER"
check_required "DB_PASSWORD"
check_required "DB_NAME"
check_not_default "DB_PASSWORD" "changeme"
check_not_default "DB_PASSWORD" "postgres"

echo ""
echo "--- Redis ---"
check_required "REDIS_HOST"
check_required "REDIS_PORT"
check_not_default "REDIS_PASSWORD" "changeme"

echo ""
echo "--- Authentication ---"
check_required "JWT_SECRET"
check_min_length "JWT_SECRET" 32
check_not_default "ADMIN_PASSWORD" "admin123"
check_min_length "ADMIN_PASSWORD" 12

echo ""
echo "--- Application ---"
check_required "APP_ENV"
check_required "APP_PORT"

echo ""
echo "=== Results ==="
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}$ERRORS error(s) found - fix before deploying${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}$WARNINGS warning(s) found - review before production${NC}"
    exit 0
else
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
fi
