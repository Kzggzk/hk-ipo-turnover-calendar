#!/bin/zsh
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:/Users/fangbao/.npm-global/bin:/usr/bin:/bin:/usr/sbin:/sbin"

ROOT="/Users/fangbao/hk-ipo-site"
LOG_DIR="/Users/fangbao/Library/Logs/HKIPORefresh"
mkdir -p "$LOG_DIR"

DRY_RUN=0
NO_PUSH=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-push) NO_PUSH=1 ;;
  esac
done

timestamp="$(date '+%Y-%m-%d_%H-%M-%S')"
log_file="$LOG_DIR/refresh-$timestamp.log"

run_refresh() {
  local workdir="$1"
  cd "$workdir"
  if [[ "${HKIPO_FORCE_FAIL:-0}" == "1" ]]; then
    echo "Forced failure via HKIPO_FORCE_FAIL=1"
    return 99
  fi
  command -v npm >/dev/null || return 98
  npm run check || return $?
  npm run fetch:hkipo || return $?
  npm run build || return $?
  test -s dist/index.html || return $?
  grep -q "HK IPO Turnover Calendar" dist/index.html || return $?
}

if [[ "$DRY_RUN" == "1" ]]; then
  tmp="$(mktemp -d /tmp/hk-ipo-site-dry-run.XXXXXX)"
  rsync -a --exclude '.git' --exclude 'node_modules' "$ROOT/" "$tmp/"
  {
    echo "Dry run at $(date)"
    run_refresh "$tmp"
    echo "Dry run output: $tmp/dist/index.html"
  } > "$log_file" 2>&1
  echo "Dry run OK. Log: $log_file"
  exit 0
fi

backup="$(mktemp -d /tmp/hk-ipo-site-backup.XXXXXX)"
cp -p "$ROOT/data/latest.json" "$backup/latest.json" 2>/dev/null || true
cp -p "$ROOT/dist/index.html" "$backup/index.html" 2>/dev/null || true

if ! {
  echo "Refresh at $(date)"
  run_refresh "$ROOT"
} > "$log_file" 2>&1; then
  cp -p "$backup/latest.json" "$ROOT/data/latest.json" 2>/dev/null || true
  cp -p "$backup/index.html" "$ROOT/dist/index.html" 2>/dev/null || true
  {
    echo "# HK IPO refresh failed"
    echo
    echo "- Time: $(date)"
    echo "- Log: $log_file"
    echo "- Previous latest.json and dist/index.html were restored when available."
  } > "$ROOT/last_failure.md"
  echo "Refresh failed. Log: $log_file" >&2
  exit 1
fi

cd "$ROOT"
if [[ -d "$ROOT/.git" ]] && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add data dist src scripts launchd netlify.toml package.json README.md .gitignore
  if git diff --cached --quiet; then
    echo "No changes to commit." >> "$log_file"
  else
    git commit -m "refresh hk ipo calendar $timestamp" >> "$log_file" 2>&1
  fi

  if [[ "$NO_PUSH" != "1" ]] && git remote get-url origin >/dev/null 2>&1; then
    git push origin main >> "$log_file" 2>&1
  else
    echo "Push skipped: NO_PUSH=$NO_PUSH or no origin remote." >> "$log_file"
  fi
else
  echo "Git commit skipped: $ROOT is not initialized as its own git repository." >> "$log_file"
fi

echo "Refresh OK. Log: $log_file"
