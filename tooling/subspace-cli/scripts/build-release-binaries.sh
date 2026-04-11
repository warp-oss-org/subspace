#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <out-dir> <release-version> <source-sha>" >&2
  exit 1
fi

out_dir=$1
release_version=$2
source_sha=$3
mkdir -p "$out_dir"

ldflags="-s -w -X github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/buildinfo.ReleaseVersion=${release_version} -X github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/buildinfo.ReleaseCommit=${source_sha}"

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
  CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" go build -trimpath -ldflags "$ldflags" -o "$output" .
done
