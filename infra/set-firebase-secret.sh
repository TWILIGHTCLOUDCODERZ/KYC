#!/usr/bin/env bash
# Push GEMINI_API_KEY into GCP Secret Manager for the ocr-backend Cloud Run service.
#
# Usage:
#   PROJECT_ID=<gcp-project-id> GEMINI_API_KEY=<key> bash infra/set-firebase-secret.sh
#
# Idempotent: creates the secret "gemini-api-key" if it doesn't exist yet,
# otherwise adds a new version. Requires the gcloud CLI to be authenticated
# (`gcloud auth login`) with access to $PROJECT_ID.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID, e.g. PROJECT_ID=ultra-mediator-506312-t2}"
: "${GEMINI_API_KEY:?Set GEMINI_API_KEY to the key to store}"

SECRET_NAME="gemini-api-key"

if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Secret '$SECRET_NAME' exists in $PROJECT_ID — adding a new version."
  printf '%s' "$GEMINI_API_KEY" | gcloud secrets versions add "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --data-file=-
else
  echo "Creating secret '$SECRET_NAME' in $PROJECT_ID."
  printf '%s' "$GEMINI_API_KEY" | gcloud secrets create "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --replication-policy="automatic" \
    --data-file=-
fi

echo "Done. Grant the Cloud Run runtime service account access with:"
echo "  gcloud secrets add-iam-policy-binding $SECRET_NAME --project=$PROJECT_ID \\"
echo "    --member=\"serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com\" \\"
echo "    --role=\"roles/secretmanager.secretAccessor\""
