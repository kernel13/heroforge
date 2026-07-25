#!/bin/sh
# Nightly pg_dump into a host directory.
#
# A character sheet represents months of play and exists nowhere else. Losing the named volume
# without a dump beside it is unrecoverable, so this runs on its own rather than being something
# to remember.
set -eu

RETENTION_DAYS="${RETENTION_DAYS:-30}"

while true; do
	# Sleep until the next midnight, so the dump lands at a predictable time.
	sleep $(( 86400 - $(date +%s) % 86400 ))

	stamp=$(date +%Y%m%d)
	target="/backups/heroforge-${stamp}.sql.gz"

	if pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$target.partial"; then
		# Rename only once the dump is complete, so a truncated file is never mistaken for one.
		mv "$target.partial" "$target"
		echo "wrote $target"
		find /backups -name 'heroforge-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
	else
		rm -f "$target.partial"
		echo "dump failed" >&2
	fi
done
