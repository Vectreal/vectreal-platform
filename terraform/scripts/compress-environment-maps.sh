#!/usr/bin/env bash
# =============================================================================
# Vectreal Platform - serve the hosted environment maps compressed and cached
# =============================================================================
# Every scene is lit by an HDR from the public bucket `environment-maps`
# (ENVIRONMENT_MAP_ROOT in packages/core/src/scene-environment/index.ts). The
# 1k maps are 1.1 to 1.8 MB each, and every embed downloads one before its
# first frame. They were uploaded uncompressed with GCS's default one-hour
# cache, so each was sent in full and fetched again an hour later.
#
# This re-uploads every object in place with:
#   - gzip content encoding (--gzip-local-all). GCS sends the gzip bytes to
#     any client that accepts gzip, which every browser does, and decompresses
#     for one that does not. Lossless: the decoded file is byte-identical.
#     Radiance RLE leaves about 23% to gain (1.59 MB to 1.22 MB for the
#     default studio-natural map).
#   - a one-year immutable Cache-Control. The URLs carry no version, so the
#     rule from here on is: a changed map gets a new file name, never an
#     overwrite in place.
#   - the Radiance content type rather than application/octet-stream.
#
# The bucket is not in Terraform (see ../README.md). Nothing in the app
# changes: the URLs stay the same.
#
# Prerequisites:
#   gcloud auth login   (an account with storage.objects.create on the bucket)
#
# Usage:
#   ./compress-environment-maps.sh            # every object
#   ./compress-environment-maps.sh --dry-run  # list what would change
# =============================================================================

set -euo pipefail

BUCKET="gs://environment-maps"
CACHE_CONTROL="public, max-age=31536000, immutable"
CONTENT_TYPE="image/vnd.radiance"

dry_run=false
case "${1:-}" in
	--dry-run) dry_run=true ;;
	"") ;;
	*)
		sed -n '2,30p' "$0"
		exit 0
		;;
esac

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# Listed up front rather than piped into the loop, so a gcloud call that reads
# stdin (a reauth prompt) cannot swallow the rest of the list, and a failed
# listing stops the script here instead of passing for an empty bucket.
listing="$(gcloud storage ls "${BUCKET}/**")"
objects=()
while IFS= read -r object; do
	[ -n "$object" ] && objects+=("$object")
done <<<"$listing"
if [ "${#objects[@]}" -eq 0 ]; then
	echo "No objects listed in ${BUCKET}." >&2
	exit 1
fi

for object in "${objects[@]}"; do
	case "$object" in
		*.hdr) ;;
		*) continue ;;
	esac

	if $dry_run; then
		echo "would re-upload ${object}"
		continue
	fi

	local_file="${workdir}/$(basename "$object")"
	# Downloaded decompressed whatever its current encoding, so a second run
	# re-uploads the same bytes rather than gzipping gzip.
	gcloud storage cp "$object" "$local_file"
	gcloud storage cp \
		--gzip-local-all \
		--cache-control="$CACHE_CONTROL" \
		--content-type="$CONTENT_TYPE" \
		"$local_file" "$object"
	rm -f "$local_file"
done

echo "Check one:"
echo "  curl -sI -H 'Accept-Encoding: gzip' https://storage.googleapis.com/environment-maps/studio/studio_natural_1k.hdr"
echo "expects content-encoding: gzip, cache-control: ${CACHE_CONTROL}"
