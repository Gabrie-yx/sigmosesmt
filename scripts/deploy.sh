#!/usr/bin/env bash
# SIGMO — deploy blindado (v4)
# Regra de ouro: o ambiente LOCAL nunca é sobrescrito pelo git.
#   Fonte da verdade: /home/sigmo/app/.env.local  (fora do git)
#   O .env versionado é apenas um molde; após cada git reset ele é
#   reescrito com os valores do .env.local.
set -uo pipefail

APP_DIR="${APP_DIR:-/home/sigmo/app}"
PORT="${PORT:-8080}"
BRANCH="${BRANCH:-main}"
LOG="/tmp/sigmo.log"
STAMP="$(date +%Y%m%d-%H%M%S)"
BK="/home/sigmo/backups"

say(){ printf "\n\033[1;36m» %s\033[0m\n" "$*"; }
ok(){  printf "\033[1;32m  ✔ %s\033[0m\n" "$*"; }
err(){ printf "\033[1;31m  ✘ %s\033[0m\n" "$*"; }
die(){ err "$*"; exit 1; }

cd "$APP_DIR" || die "diretório $APP_DIR não existe"
mkdir -p "$BK"

# ---------------------------------------------------------------- 0. env local
say "Conferindo ambiente local"
if [ ! -f .env.local ]; then
  if grep -q '172\.18\.0\.50\|localhost\|127\.0\.0\.1' .env 2>/dev/null; then
    cp .env .env.local
    ok ".env.local criado a partir do .env atual (já era local)"
  else
    die "Não existe .env.local e o .env aponta para a nuvem.
     Crie /home/sigmo/app/.env.local com SUPABASE_URL, VITE_SUPABASE_URL,
     SUPABASE_PUBLISHABLE_KEY e VITE_SUPABASE_PUBLISHABLE_KEY locais e rode de novo."
  fi
fi
grep -qi 'supabase\.co' .env.local && die ".env.local ainda aponta para a NUVEM. Corrija antes do deploy."
cp .env.local "$BK/env.local.$STAMP"
ok "ambiente local salvo em $BK/env.local.$STAMP"

# --------------------------------------------------------------- 1. git update
PREV="$(git rev-parse HEAD)"
say "Atualizando código (rollback disponível para $PREV)"
git fetch --all --prune || die "git fetch falhou"
git reset --hard "origin/$BRANCH" || die "git reset falhou"
ok "código em $(git rev-parse --short HEAD)"

# ------------------------------------------------------ 2. reimpor env local
say "Reaplicando o ambiente local por cima do .env do repositório"
apply_env(){
  # copia TODA chave do .env.local para o .env (substitui ou acrescenta)
  cp .env.local .env.new 2>/dev/null || : 
  # mantém chaves do repo que não existem no .env.local
  if [ -f .env ]; then
    while IFS= read -r line; do
      case "$line" in ''|\#*) continue;; esac
      k="${line%%=*}"
      grep -q "^${k}=" .env.new || printf '%s\n' "$line" >> .env.new
    done < .env
  fi
  mv .env.new .env
}
apply_env
grep -qi 'supabase\.co' <(grep -E '^(VITE_)?SUPABASE_URL=' .env) \
  && die "ABORTADO: o .env final ainda aponta para a nuvem." 
ok "$(grep -E '^VITE_SUPABASE_URL=' .env)"

# ------------------------------------------------------------- 3. dependências
say "Instalando dependências"
npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null 2>&1 \
  || die "instalação de dependências falhou"
ok "dependências ok"

# ------------------------------------------------------------- 4. sobe o app
say "Reiniciando o SIGMO na porta $PORT"
pkill -f "vite" 2>/dev/null; sleep 2
nohup npm run dev -- --host 0.0.0.0 --port "$PORT" > "$LOG" 2>&1 &
sleep 3

# ------------------------------------------------------------- 5. health check
say "Verificando se subiu"
code=000
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:$PORT/" || echo 000)
  case "$code" in 2??|3??) break;; esac
  sleep 2
done

if case "$code" in 2??|3??) false;; *) true;; esac; then
  err "app não respondeu (HTTP $code). Revertendo para $PREV"
  git reset --hard "$PREV" >/dev/null 2>&1
  apply_env
  pkill -f "vite" 2>/dev/null; sleep 2
  nohup npm run dev -- --host 0.0.0.0 --port "$PORT" > "$LOG" 2>&1 &
  sleep 10
  err "ROLLBACK aplicado. Últimas linhas do log:"; tail -20 "$LOG"
  exit 1
fi
ok "app respondendo (HTTP $code)"

# ------------------------------------------------------------- 6. checagem final
say "Checagem de independência da nuvem"
bash scripts/dmn-check.sh .env || err "atenção: a checagem apontou pendências acima"

say "Deploy concluído — commit $(git rev-parse --short HEAD)"
