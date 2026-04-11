#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <subspace-binary>" >&2
  exit 1
fi

binary=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")

tmpdir=$(mktemp -d)
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

cat >"$tmpdir/package.json" <<'EOF'
{
  "name": "subspace-smoke-consumer",
  "private": true,
  "type": "module"
}
EOF

cat >"$tmpdir/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "baseUrl": "."
  },
  "include": ["src/**/*.ts"]
}
EOF

(
  cd "$tmpdir"
  "$binary" init
  "$binary" list
  "$binary" info errors
  "$binary" add errors --dry-run
  "$binary" add errors
)

test -f "$tmpdir/src/infra/subspace/errors/index.ts"
