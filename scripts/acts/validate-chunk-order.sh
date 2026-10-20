#!/usr/bin/env bash
# Prints the chunk-ordering validation numbers (see docs/CHUNK-ORDER-VALIDATION.md). Read-only. Usage: scripts/acts/validate-chunk-order.sh [DATASET_DIR]
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="${1:-/Volumes/LAWSSD/open-india-law}"
duckdb -csv -c "$(sed -e "s|__DIR__|$DIR|g" scripts/acts/validate-chunk-order.sql)"
