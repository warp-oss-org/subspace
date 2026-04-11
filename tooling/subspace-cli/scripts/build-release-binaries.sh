#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <out-dir>" >&2
  exit 1
fi

out_dir=$1
mkdir -p "$out_dir"

targets=(
  "darwin amd64"
  "darwin arm64"
  "linux amd64"
  "linux arm64"
  "windows amd64"
)

for target in "${targets[@]}"; do
  read -r goos goarch <<<"$target"
  ext=""
  if [[ "$goos" == "windows" ]]; then
    ext=".exe"
  fi

  output="${out_dir}/subspace-cli-${goos}-${goarch}${ext}"
  CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" go build -trimpath -o "$output" .
done
