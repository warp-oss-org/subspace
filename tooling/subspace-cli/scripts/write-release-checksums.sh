#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <out-dir>" >&2
  exit 1
fi

out_dir=$1
checksums_path="${out_dir}/checksums.txt"

find "$out_dir" -maxdepth 1 -type f \
  ! -name 'checksums.txt' \
  ! -name 'release-notes.md' \
  -print \
  | sed 's#^.*/##' \
  | LC_ALL=C sort \
  | while IFS= read -r file; do
      checksum=$(shasum -a 256 "${out_dir}/${file}" | awk '{print $1}')
      printf '%s  %s\n' "$checksum" "$file"
    done >"$checksums_path"
