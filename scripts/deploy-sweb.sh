#!/usr/bin/env bash
set -euo pipefail

remote="${SWEB_REMOTE:-${1:-}}"

if [[ -z "$remote" ]]; then
  echo "Usage: SWEB_REMOTE='login@host:~/resume.git' ./scripts/deploy-sweb.sh"
  echo "   or: ./scripts/deploy-sweb.sh 'login@host:~/resume.git'"
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

cd "$repo_root"
yarn build

cp -R dist/. "$tmp_dir/"

cd "$tmp_dir"
git init -q
git checkout -q -b main
git config user.name "sweb deploy"
git config user.email "sweb-deploy@example.local"
git add -A
git commit -q -m "Deploy $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
git remote add sweb "$remote"
git push --force sweb main

echo "Deployed dist to $remote"
