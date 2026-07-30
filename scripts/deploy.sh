#!/usr/bin/env bash
# SIGMO — deploy blindado v5
# Base: /home/sigmo/deploy.sh do servidor + correções críticas.
# Regra de ouro: o ambiente LOCAL nunca é sobrescrito pelo git.
#   Fonte da verdade: $APP/.env.local (ignorado pelo git)
set -uo pipefail

APP=/home/sigmo/app
LOG=/home/sigmo/sigmo.log
BK=/home/sigmo/backups
PORT=8080
NGINX_IP=172.18.0.50
STAMP=$(date +%Y%m%d-%H%M%S)

say(){ printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok(){  printf "\033[1;32m    ok %s\033[0m\n" "$*"; }
err(){ printf "\033[1;31m    !! %s\033[0m\n" "$*"; }
die(){ err "$*"; exit 1; }
health(){ curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${PORT}/" || echo 000; }

# mata só o vite DESTE app, não qualquer vite da máquina
kill_app(){ pkill -f "vite.*--port ${PORT}" 2>/dev/null || pkill -f "$APP/node_modules/.bin/vite" 2>/dev/null || true; sleep 3; }

start_app(){
  setsid nohup bun run dev -- --host 0.0.0.0 --port "$PORT" > "$LOG" 2>&1 < /dev/null &
  disown
}

wait_up(){
  for i in $(seq 1 90); do
    case "$(health)" in 2*|3*) echo "$i"; return 0 ;; esac
    sleep 1
  done
  return 1
}

cd "$APP" || die "diretório $APP não existe"
mkdir -p "$BK"


# ------------------------------------------------ sobrevive à queda do SSH
# Se a sessão cair no meio, o deploy continua e o log fica em /home/sigmo/deploy.log
if [ -z "${DEPLOY_DETACHED:-}" ] && [ -t 1 ]; then
  echo "Rodando em segundo plano (imune a queda de SSH)."
  echo "Acompanhe com:  tail -f /home/sigmo/deploy.log"
  DEPLOY_DETACHED=1 setsid nohup bash "$0" "$@" > /home/sigmo/deploy.log 2>&1 < /dev/null &
  disown
  sleep 2; tail -f /home/sigmo/deploy.log &
  wait $! 2>/dev/null
  exit 0
fi

# ------------------------------------------------ trava contra deploy duplicado
exec 9>"$BK/.deploy.lock"
flock -n 9 || die "já existe um deploy em andamento. Abortando."

# ------------------------------------------------ 0. trava de ambiente local
say "Conferindo ambiente local"
if [ ! -f .env.local ]; then
  if grep -qE '^(VITE_)?SUPABASE_URL=.*(172\.18\.0\.50|localhost|127\.0\.0\.1)' .env 2>/dev/null; then
    cp .env .env.local; ok ".env.local criado a partir do .env atual"
  else
    die "Sem .env.local e o .env aponta para a NUVEM.
       Crie $APP/.env.local com as chaves locais antes de rodar o deploy."
  fi
fi
grep -qiE '^(VITE_)?SUPABASE_URL=.*supabase\.co' .env.local && die ".env.local aponta para a NUVEM. Corrija primeiro."
cp .env.local "$BK/env.local.$STAMP"
ok "ambiente salvo em $BK/env.local.$STAMP"

apply_env(){
  cp .env.local .env.new
  if [ -f .env ]; then
    while IFS= read -r line; do
      case "$line" in ''|\#*) continue ;; esac
      grep -q "^${line%%=*}=" .env.new || printf '%s\n' "$line" >> .env.new
    done < .env
  fi
  mv .env.new .env
}

# ------------------------------------------------ 1. backup do banco (validado)
say "Backup do banco"
DUMP="$BK/sigmo-$STAMP.sql"
if docker exec supabase-db pg_dump -U supabase_admin -d postgres > "$DUMP" 2>"$BK/dump.err.$STAMP"; then
  SZ=$(stat -c %s "$DUMP")
  [ "$SZ" -gt 1000000 ] || die "backup gerado com apenas ${SZ} bytes — abortando o deploy por segurança."
  ok "backup ok ($((SZ/1024/1024)) MB) -> $DUMP"
else
  die "pg_dump falhou. Veja $BK/dump.err.$STAMP. Deploy abortado."
fi
ls -t "$BK"/sigmo-*.sql 2>/dev/null | tail -n +11 | xargs -r rm -f

# ------------------------------------------------ 2. atualização do código
PREV=$(git rev-parse HEAD)
say "Atualizando código (rollback disponível: $PREV)"
git fetch origin || die "git fetch falhou — sem rede/repo. Deploy abortado."
git reset --hard origin/main 2>/dev/null || git reset --hard origin/master || die "git reset falhou"
ok "código em $(git rev-parse --short HEAD)"

# ------------------------------------------------ 3. reimpor ambiente local
say "Reaplicando ambiente local por cima do .env do repositório"
apply_env
grep -qiE '^(VITE_)?SUPABASE_URL=.*supabase\.co' .env && die "ABORTADO: .env final aponta para a NUVEM."
ok "$(grep -E '^VITE_SUPABASE_URL=' .env)"

# ------------------------------------------------ 4. dependências
say "Dependências"
bun install || die "bun install falhou"

# ------------------------------------------------ 5. restart
say "Reiniciando o app em 0.0.0.0:${PORT}"
kill_app
start_app

say "Aguardando (até 90s)"
if T=$(wait_up); then
  ok "no ar em ${T}s"
else
  err "não subiu. Revertendo para $PREV"
  kill_app
  git reset --hard "$PREV"
  apply_env
  bun install
  start_app
  if T=$(wait_up); then
    err "ROLLBACK aplicado com sucesso (no ar em ${T}s)."
  else
    err "ROLLBACK TAMBÉM FALHOU — sistema fora do ar. Log abaixo:"
  fi
  tail -40 "$LOG"
  exit 1
fi

# ------------------------------------------------ 6. checagens finais
say "Teste pelo IP do Nginx"
curl -sS -o /dev/null -w '    HTTP %{http_code}\n' --max-time 15 "http://${NGINX_IP}:${PORT}/" || err "Nginx não alcança o app"

say "Checagem de independência da nuvem"
bash scripts/dmn-check.sh .env || err "atenção: pendências acima"

say "Deploy concluído — $(git rev-parse --short HEAD)"
