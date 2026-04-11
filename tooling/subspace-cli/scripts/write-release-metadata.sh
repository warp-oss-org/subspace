#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <out-dir> <release-version> <source-sha>" >&2
  exit 1
fi

out_dir=$1
release_version=$2
source_sha=$3
metadata_path="${out_dir}/release-metadata.json"

asset_names=()
while IFS= read -r file; do
  name=$(basename "$file")
  if [[ "$name" == "checksums.txt" || "$name" == "release-notes.md" || "$name" == "release-metadata.json" ]]; then
    continue
  fi
  asset_names+=("$name")
done < <(find "$out_dir" -maxdepth 1 -type f | LC_ALL=C sort)

asset_names+=("checksums.txt")
asset_names+=("release-metadata.json")

{
  echo "{"
  echo "  \"schemaVersion\": \"subspace.cli.release.v1\","
  echo "  \"releaseVersion\": \"${release_version}\","
  echo "  \"sourceGitSHA\": \"${source_sha}\","
  echo "  \"assets\": ["
  for i in "${!asset_names[@]}"; do
    comma=","
    if [[ "$i" -eq "$((${#asset_names[@]} - 1))" ]]; then
      comma=""
    fi
    echo "    {\"name\": \"${asset_names[$i]}\"}${comma}"
  done
  echo "  ]"
  echo "}"
} >"$metadata_path"
