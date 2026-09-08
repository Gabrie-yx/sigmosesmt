#!/usr/bin/env bash
# SIGMO — aplicador de migrations BLINDADO
# Regras:
#  1. NUNCA aplica arquivo com comando destrutivo (DELETE/TRUNCATE/DROP TABLE/DROP SCHEMA/DROP COLUMN).
#  2. Só aplica migration que ainda não foi aplicada (registro em public.sigmo_migrations_aplicadas).
#  3. Cada migration roda dentro de uma transação: erro = nada é gravado.
set -uo pipefail

APP=${APP:-/home/sigmo/app}
DIR="$APP/supabase/migrations"
DB_CONTAINER=${DB_CONTAINER:-supabase-db}
DB_USER=${DB_USER:-supabase_admin}
DB_NAME=${DB_NAME:-postgres}

say(){ printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok(){  printf "\033[1;32m    ok %s\033[0m\n" "$*"; }
skip(){ printf "\033[1;33m    -- %s\033[0m\n" "$*"; }
err(){ printf "\033[1;31m    !! %s\033[0m\n" "$*"; }

psql_c(){ docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"; }

[ -d "$DIR" ] || { err "pasta $DIR não existe"; exit 1; }

say "Preparando registro de migrations aplicadas"
psql_c -q -c "CREATE TABLE IF NOT EXISTS public.sigmo_migrations_aplicadas (
  arquivo text PRIMARY KEY,
  aplicada_em timestamptz NOT NULL DEFAULT now()
);" >/dev/null || { err "não consegui falar com o banco"; exit 1; }

# padrão de comando destrutivo (ignora comentários -- e maiúsc/minúsc)
DESTRUTIVO='(^|[^-[:alnum:]_])(delete[[:space:]]+from|truncate|drop[[:space:]]+schema|drop[[:space:]]+table|drop[[:space:]]+database|drop[[:space:]]+owned|drop[[:space:]]+column|alter[[:space:]]+table[[:space:]]+[^;]*drop[[:space:]]+column)'

APLICADAS=0; PULADAS=0; BLOQUEADAS=0; FALHAS=0

say "Aplicando migrations novas"
for f in $(ls -1 "$DIR"/*.sql 2>/dev/null | sort); do
  base=$(basename "$f")

  ja=$(psql_c -tAq -c "SELECT 1 FROM public.sigmo_migrations_aplicadas WHERE arquivo = '$base';" 2>/dev/null)
  if [ "$ja" = "1" ]; then
    PULADAS=$((PULADAS+1)); continue
  fi

  # remove comentários de linha antes de checar
  if sed 's/--.*//' "$f" | grep -qiE "$DESTRUTIVO"; then
    err "BLOQUEADA (contém comando destrutivo): $base"
    BLOQUEADAS=$((BLOQUEADAS+1))
    continue
  fi

  if { echo "BEGIN;"; cat "$f"; echo; echo "INSERT INTO public.sigmo_migrations_aplicadas(arquivo) VALUES ('$base') ON CONFLICT DO NOTHING;"; echo "COMMIT;"; } \
       | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q >/tmp/mig.$base.log 2>&1; then
    ok "$base"
    APLICADAS=$((APLICADAS+1))
  else
    err "FALHOU: $base (log: /tmp/mig.$base.log)"
    tail -5 "/tmp/mig.$base.log"
    FALHAS=$((FALHAS+1))
  fi
done

say "Recarregando a API"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "NOTIFY pgrst, 'reload schema';" >/dev/null 2>&1
docker restart supabase-rest >/dev/null 2>&1 && ok "supabase-rest reiniciado"

say "Resumo"
echo "    aplicadas: $APLICADAS | já estavam: $PULADAS | bloqueadas: $BLOQUEADAS | falhas: $FALHAS"
[ "$FALHAS" -gt 0 ] && exit 1
exit 0
