# Deployment runbook — nttdata-kyc

Architecture: Firebase Authentication (login) + Supabase (Postgres/RLS/Storage,
verifying Firebase tokens via Third-Party Auth) + two Cloud Run services
(static frontend, OCR backend using Gemini 3.5 Flash) + GCP Secret Manager
(Gemini key). Code lives at
[github.com/TWILIGHTCLOUDCODERZ/KYC](https://github.com/TWILIGHTCLOUDCODERZ/KYC)
and deploys to Cloud Run automatically on every push to `main` via the GitHub
Actions workflows in `.github/workflows/`.

Identifiers used below — replace if yours differ:
- Firebase project: `deepan-gemini-xprize`
- GCP project: `ultra-mediator-506312-t2`
- Service name prefix: `nttdata-kyc`
- GitHub repo: `TWILIGHTCLOUDCODERZ/KYC`

## 1. Firebase — enable Email/Password sign-in

1. Open the [Firebase Console](https://console.firebase.google.com/project/deepan-gemini-xprize/authentication/providers).
2. Authentication → Sign-in method → enable **Email/Password**.
3. The web app config already in `frontend/.env` (`VITE_FIREBASE_*`) is public
   by design — no action needed there.

## 2. Supabase — trust Firebase tokens (Third-Party Auth)

1. Supabase Dashboard → your project → **Authentication → Sign In / Providers → Third-Party Auth**.
2. Add provider → **Firebase** → enter project ID `deepan-gemini-xprize`.
3. Save. This is what makes `auth.jwt()` (and RLS policies) trust the ID token
   the frontend attaches via `supabase.ts`'s `accessToken` callback.

## 3. Apply the schema migration

The migration (`supabase/migrations/20260924160000_migrate_to_firebase_auth.sql`)
retypes every `auth.users`-linked `uuid` column to `text` (Firebase UIDs
aren't UUIDs) and rewrites RLS to use `auth.jwt()->>'sub'`.

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste the file into the Supabase SQL Editor and run it directly.

⚠️ This assumes no real Supabase-Auth users need to be preserved (confirmed
pre-launch). If that's no longer true, back up `auth.users`/`profiles` first.

## 4. Rotate the leaked Gemini key

The key that used to be hardcoded in `supabase/functions/gemini-ocr/index.ts`
(`AIzaSyAk8_U9m-vVBb87-Z0RLNz7zkbeQ1WJI94`) was committed in source and must be
treated as burned. Revoke it in [Google AI Studio](https://aistudio.google.com/app/apikey),
regardless of whether you keep using the newer key already in
`server/ocr-backend/.env`.

## 5. GCP project setup

```bash
gcloud config set project ultra-mediator-506312-t2

gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iamcredentials.googleapis.com
```

## 6. Push the Gemini key into Secret Manager

```bash
PROJECT_ID=ultra-mediator-506312-t2 \
GEMINI_API_KEY=<your-gemini-key> \
bash infra/set-firebase-secret.sh
```

Grant the Cloud Run runtime service account access (the script prints the
exact command — find `<PROJECT_NUMBER>` via `gcloud projects describe
ultra-mediator-506312-t2 --format='value(projectNumber)'`):

```bash
gcloud secrets add-iam-policy-binding gemini-api-key \
  --project=ultra-mediator-506312-t2 \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 7. Create an Artifact Registry repo

```bash
gcloud artifacts repositories create nttdata-kyc \
  --repository-format=docker \
  --location=us-central1 \
  --project=ultra-mediator-506312-t2
```

## 8. One-time: let GitHub Actions deploy to GCP (Workload Identity Federation)

No service account key files — GitHub authenticates to GCP by exchanging its
own OIDC token, scoped to this exact repo.

```bash
PROJECT_ID=ultra-mediator-506312-t2
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Pool + provider, restricted to this repo
gcloud iam workload-identity-pools create "github-pool" \
  --project="$PROJECT_ID" --location="global" --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="$PROJECT_ID" --location="global" \
  --workload-identity-pool="github-pool" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='TWILIGHTCLOUDCODERZ/KYC'"

# Deployer service account with just enough rights to build + deploy
gcloud iam service-accounts create github-deployer \
  --project="$PROJECT_ID" --display-name="GitHub Actions deployer"

DEPLOYER="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/TWILIGHTCLOUDCODERZ/KYC"

for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER}" --role="$role"
done
```

Print the two values the workflows need:

```bash
echo "WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo "WIF_SERVICE_ACCOUNT=${DEPLOYER}"
```

## 9. Configure GitHub repo variables

On [github.com/TWILIGHTCLOUDCODERZ/KYC](https://github.com/TWILIGHTCLOUDCODERZ/KYC) →
**Settings → Secrets and variables → Actions → Variables** → add (all of these
are non-secret by design, so plain repo **Variables** are fine, not Secrets):

| Name | Value |
|---|---|
| `GCP_PROJECT_ID` | `ultra-mediator-506312-t2` |
| `GCP_REGION` | `us-central1` |
| `WIF_PROVIDER` | printed in step 8 |
| `WIF_SERVICE_ACCOUNT` | printed in step 8 |
| `VITE_SUPABASE_URL` | `https://wulylsyxpfslgziltldv.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
| `VITE_FIREBASE_API_KEY` | `AIzaSyBwxomNU21-YqdmkSUI6ROsoMupo0AnpQ4` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `deepan-gemini-xprize.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `deepan-gemini-xprize` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `deepan-gemini-xprize.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `807655655153` |
| `VITE_FIREBASE_APP_ID` | `1:807655655153:web:8dde92ee27c6ef614b0b50` |
| `VITE_OCR_BACKEND_URL` | the ocr-backend Cloud Run URL (fill in after its first deploy; redeploy frontend once you have it) |

The real secret (`GEMINI_API_KEY`) never touches GitHub — it's injected into
the ocr-backend container straight from Secret Manager by
`--set-secrets` in the workflow.

## 10. Push → auto-deploy

Every push to `main` that touches `frontend/**` deploys `nttdata-kyc-frontend`;
every push touching `server/ocr-backend/**` deploys `nttdata-kyc-ocr-backend`
(see `.github/workflows/`). Watch progress under the repo's **Actions** tab.

First push has no `VITE_OCR_BACKEND_URL` yet — that's expected; deploy once,
copy the printed ocr-backend Service URL into the `VITE_OCR_BACKEND_URL`
repo variable, then push any small change to `frontend/**` (or re-run the
workflow) to bake it in.

## 11. Verify

1. Open the frontend's Cloud Run URL.
2. Sign up a new account → should create a Firebase user and a matching
   `profiles` row in Supabase (confirms the Third-Party Auth bridge works).
3. Run through onboarding document upload → confirms the frontend reaches
   the OCR backend's Cloud Run URL and Gemini 3.5 Flash extraction returns
   results.
4. Log in as an admin-role profile → confirms role-gated routes still work.

## Manual deploy (fallback, no CI/CD)

If you'd rather deploy from your own machine instead of GitHub Actions:

```bash
# ocr-backend
cd server/ocr-backend
gcloud builds submit --project=ultra-mediator-506312-t2 \
  --tag us-central1-docker.pkg.dev/ultra-mediator-506312-t2/nttdata-kyc/ocr-backend:latest
gcloud run deploy nttdata-kyc-ocr-backend \
  --project=ultra-mediator-506312-t2 --region=us-central1 \
  --image=us-central1-docker.pkg.dev/ultra-mediator-506312-t2/nttdata-kyc/ocr-backend:latest \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest --allow-unauthenticated
```

```bash
# frontend — build-args aren't supported by `gcloud builds submit --tag`,
# so build locally and push instead:
cd frontend
docker build \
  --build-arg VITE_SUPABASE_URL=https://wulylsyxpfslgziltldv.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=<anon-key> \
  --build-arg VITE_FIREBASE_API_KEY=AIzaSyBwxomNU21-YqdmkSUI6ROsoMupo0AnpQ4 \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=deepan-gemini-xprize.firebaseapp.com \
  --build-arg VITE_FIREBASE_PROJECT_ID=deepan-gemini-xprize \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET=deepan-gemini-xprize.firebasestorage.app \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID=807655655153 \
  --build-arg VITE_FIREBASE_APP_ID=1:807655655153:web:8dde92ee27c6ef614b0b50 \
  --build-arg VITE_OCR_BACKEND_URL=<ocr-backend service URL> \
  -t us-central1-docker.pkg.dev/ultra-mediator-506312-t2/nttdata-kyc/frontend:latest .

gcloud auth configure-docker us-central1-docker.pkg.dev
docker push us-central1-docker.pkg.dev/ultra-mediator-506312-t2/nttdata-kyc/frontend:latest
gcloud run deploy nttdata-kyc-frontend \
  --project=ultra-mediator-506312-t2 --region=us-central1 \
  --image=us-central1-docker.pkg.dev/ultra-mediator-506312-t2/nttdata-kyc/frontend:latest \
  --allow-unauthenticated
```

## Optional follow-ups (not required to ship)

- Custom domain: `gcloud run domain-mappings create --service=nttdata-kyc-frontend --domain=<yourdomain>`.
