#!/bin/sh

TS_HOSTNAME="${TS_HOSTNAME:-tivify}"
TS_SERVE_MODE="${TS_SERVE_MODE:-https}"

# Debug
KEY_LEN=$(echo -n "$TS_AUTHKEY" | wc -c)
echo "[Tailscale] TS_AUTHKEY: ${KEY_LEN} chars | TS_HOSTNAME: ${TS_HOSTNAME} | MODE: ${TS_SERVE_MODE}"

# Validar auth key
if [ -z "$TS_AUTHKEY" ] || [ "$TS_AUTHKEY" = "tskey-auth-xxxxx" ]; then
  echo "[Tailscale] ERROR: TS_AUTHKEY no configurada en .env"
  echo "[Tailscale] SECURITY: Generate ephemeral keys at https://login.tailscale.com/admin/settings/keys"
  echo "[Tailscale] SECURITY: Avoid storing persistent auth keys; prefer ephemeral keys (auto-expire in 1 day)"
  sleep infinity
fi

echo "[Tailscale] Iniciando tailscaled..."
tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/var/run/tailscale/tailscaled.sock &
TAILSCALED_PID=$!

# Esperar socket
for i in 1 2 3 4 5 6 7 8 9 10; do
  [ -S /var/run/tailscale/tailscaled.sock ] && break
  sleep 1
done

# Comprobar si ya esta autenticado con el mismo hostname
CURRENT_STATUS=$(tailscale status 2>&1)
ALREADY_UP=0
if echo "$CURRENT_STATUS" | grep -q "^[0-9]"; then
  # Ya hay un nodo activo
  CURRENT_HOST=$(tailscale status --json 2>/dev/null | grep -o '"Self":{[^}]*}' | grep -o '"HostName":"[^"]*"' | cut -d'"' -f4)
  if [ "$CURRENT_HOST" = "$TS_HOSTNAME" ]; then
    echo "[Tailscale] Ya autenticado como '$TS_HOSTNAME', reutilizando sesion existente..."
    ALREADY_UP=1
  fi
fi

if [ "$ALREADY_UP" = "0" ]; then
  echo "[Tailscale] Conectando como '$TS_HOSTNAME'..."
  # SIN --reset: evita crear un nuevo dispositivo en cada reinicio
  if ! tailscale up --authkey="$TS_AUTHKEY" --hostname="$TS_HOSTNAME" --accept-routes $TS_EXTRA_ARGS 2>&1; then
    echo "[Tailscale] ERROR: Fallo la autenticacion. Verifica TS_AUTHKEY."
    wait $TAILSCALED_PID
    exit 1
  fi
else
  # Asegurar hostname correcto sin re-autenticar
  tailscale set --hostname="$TS_HOSTNAME" 2>/dev/null || true
fi

echo "[Tailscale] Conectado!"
tailscale status

# Configurar serve - localhost:80 es nginx (compartimos network namespace)
# Limpiar serve existente antes de reconfigurar para evitar duplicados
tailscale serve reset 2>/dev/null || true

if [ "$TS_SERVE_MODE" = "https" ]; then
  echo "[Tailscale] Configurando HTTPS serve -> localhost:80 (nginx)"
  tailscale serve --bg --https=443 80
else
  echo "[Tailscale] Configurando HTTP serve -> localhost:80 (nginx)"
  tailscale serve --bg --http=80 80
fi

# Verificar
tailscale serve status

# Mostrar URL
TAILNET_SUFFIX=$(tailscale status --json 2>/dev/null | grep -o '"MagicDNSSuffix":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TAILNET_SUFFIX" ]; then
  PROTO="https"
  [ "$TS_SERVE_MODE" != "https" ] && PROTO="http"
  echo ""
  echo "============================================"
  echo "  TIVIFY accesible en:"
  echo "  ${PROTO}://${TS_HOSTNAME}.${TAILNET_SUFFIX}"
  echo "============================================"
  echo ""
fi

wait $TAILSCALED_PID
