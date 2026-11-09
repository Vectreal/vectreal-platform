#!/usr/bin/env bash
# =============================================================================
# Vectreal Platform - upload the compressed environment maps
# =============================================================================
# A scene can load its environment map compressed: a gain map JPEG beside
# each HDR in the public bucket `environment-maps`, under the same name with
# `.jpg` (resolveEnvironmentFiles in packages/core/src/scene-environment).
# They are made by
#
#   pnpm nx run vectreal-platform:encode-environment-gainmaps
#
# which writes them into a directory laid out like the bucket (by default
# $TMPDIR/environment-gainmaps). This uploads that directory with:
#   - a one-year immutable Cache-Control. Every file is new, so nothing is
#     overwritten; the rule from compress-environment-maps.sh holds: a changed
#     map gets a new file name, never an overwrite in place.
#   - image/jpeg, uncompressed. JPEG is already entropy coded: gzip saves
#     under 3%, which is not worth the transcoding GCS would then do for any
#     client that does not accept it.
#
# Upload before deploying the release that reads them: a scene set to
# compressed asks for these files, and a missing one lights the scene with
# the viewer's neutral fallback room instead.
#
# Prerequisites:
#   gcloud auth login   (an account with storage.objects.create on the bucket)
#
# Usage:
#   ./upload-environment-gainmaps.sh [dir]            # upload every .jpg
#   ./upload-environment-gainmaps.sh [dir] --dry-run  # list what would upload
# =============================================================================

set -euo pipefail

BUCKET="gs://environment-maps"
CACHE_CONTROL="public, max-age=31536000, immutable"
CONTENT_TYPE="image/jpeg"

dir="${1:-${TMPDIR:-/tmp}/environment-gainmaps}"
dry_run=false
case "${2:-}" in
	--dry-run) dry_run=true ;;
	"") ;;
	*)
		sed -n '2,31p' "$0"
		exit 0
		;;
esac

if [ ! -d "$dir" ]; then
	echo "No directory ${dir}. Run the encode first (see above)." >&2
	exit 1
fi

files=()
while IFS= read -r file; do
	files+=("$file")
done < <(cd "$dir" && find . -name '*.jpg' | sed 's|^\./||' | sort)
if [ "${#files[@]}" -eq 0 ]; then
	echo "No .jpg files in ${dir}." >&2
	exit 1
fi

for file in "${files[@]}"; do
	if $dry_run; then
		echo "would upload ${file} to ${BUCKET}/${file}"
		continue
	fi
	gcloud storage cp \
		--cache-control="$CACHE_CONTROL" \
		--content-type="$CONTENT_TYPE" \
		"${dir}/${file}" "${BUCKET}/${file}"
done

echo "Uploaded ${#files[@]} files. Check one:"
echo "  curl -sI https://storage.googleapis.com/environment-maps/studio/studio_natural_1k.jpg"
echo "expects content-type: ${CONTENT_TYPE}, cache-control: ${CACHE_CONTROL}"
