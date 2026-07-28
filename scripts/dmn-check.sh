#!/usr/bin/env bash
# SIGMO — verificação de independência da nuvem
# Uso: bash scripts/dmn-check.sh
set -u

ENV_FILE="${1:-.env}"
ok=0; fail=0
say(){ printf "%s\n" "$1"; }
pass(){ say "  [OK]   $1"; ok=$((ok+1)); }
bad(){ say "  [FALHA] $1"; fail=$((fail+1)); }

say "== SIGMO / DMN — checagem de ambiente local =="

[ -f "$ENV_FILE" ] || { say "Arquivo $ENV_FILE não encontrado."; exit 1; }
set -a; . "$ENV_FILE" 2>/dev/null; set +a

say ""
say "1) Variáveis de ambiente"
for v in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY; do
  if [ -n "${!v:-}" ]; then pass "$v definido"; else bad "$v AUSENTE"; fi
done

say ""
say "2) Nenhum endpoint apontando para a nuvem"
for v in VITE_SUPABASE_URL SUPABASE_URL; do
  val="${!v:-}"
  case "$val" in
    *supabase.co*) bad "$v ainda aponta para a NUVEM ($val)" ;;
    "")            bad "$v vazio" ;;
    *)             pass "$v local -> $val" ;;
  esac
done

say ""
say "3) Supabase local respondendo"
url="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
if [ -n "$url" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url/auth/v1/health" 2>/dev/null)
  if [ "$code" = "200" ]; then pass "GoTrue respondendo em $url"; else bad "sem resposta de $url/auth/v1/health (HTTP $code)"; fi
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "apikey: ${SUPABASE_PUBLISHABLE_KEY:-}" "$url/rest/v1/" 2>/dev/null)
  if [ "$code" = "200" ] || [ "$code" = "404" ]; then pass "PostgREST respondendo"; else bad "PostgREST não respondeu (HTTP $code)"; fi
fi

say ""
say "4) Código sem chamada direta à nuvem"
hits=$(grep -rl "supabase\.co" src 2>/dev/null | grep -v "client.ts" | head -5)
if [ -z "$hits" ]; then pass "nenhuma URL da nuvem fora do fallback de preview"; else bad "arquivos com URL da nuvem: $hits"; fi

say ""
say "== Resultado: $ok OK / $fail falha(s) =="
[ "$fail" -eq 0 ] || exit 1
