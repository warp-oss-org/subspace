#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: $0 <registry-dir> <out-dir> <release-version> <source-sha>" >&2
  exit 1
fi

registry_dir=$1
out_dir=$2
release_version=$3
source_sha=$4

archive_name="subspace-cli-registry.tar.gz"
archive_path="${out_dir}/${archive_name}"

mkdir -p "$out_dir"
rm -f "$archive_path" "$out_dir/checksums.txt" "$out_dir/release-metadata.json"

if command -v gtar >/dev/null 2>&1; then
  tar_bin=gtar
elif tar --version 2>/dev/null | grep -q 'GNU tar'; then
  tar_bin=tar
else
  tar_bin=
fi

if [[ -n "$tar_bin" ]]; then
  "$tar_bin" \
    --sort=name \
    --mtime='UTC 1970-01-01' \
    --owner=0 \
    --group=0 \
    --numeric-owner \
    -czf "$archive_path" \
    -C "$registry_dir" \
    .
else
  archive_entries=()
  while IFS= read -r entry; do
    archive_entries+=("$entry")
  done < <(cd "$registry_dir" && find . -mindepth 1 -print | LC_ALL=C sort)
  COPYFILE_DISABLE=1 tar -czf "$archive_path" -C "$registry_dir" "${archive_entries[@]}"
fi

archive_sha=$(shasum -a 256 "$archive_path" | awk '{print $1}')
printf '%s  %s\n' "$archive_sha" "$archive_name" >"$out_dir/checksums.txt"

cat >"$out_dir/release-metadata.json" <<EOF
{
  "schemaVersion": "subspace.cli.release.v1",
  "releaseVersion": "${release_version}",
  "sourceGitSHA": "${source_sha}",
  "registryArchive": {
    "path": "${archive_name}",
    "sha256": "${archive_sha}"
  }
}
EOF
