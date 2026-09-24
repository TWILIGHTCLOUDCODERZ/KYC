import express, { type Request, type Response } from "express";
import cors from "cors";
import multer from "multer";

const PORT = Number(process.env.PORT) || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY env var is required (set via Cloud Run --set-secrets)");
}
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── Prompts per document type ─────────────────────────────────────────────────

const PROMPTS: Record<string, string> = {
  photo: `You are a biometric photo verification system for KYC compliance.
Analyze this photo strictly for face presence and quality.
Return ONLY this JSON (no commentary):
{
  "face_detected": "Yes/No",
  "faces_count": "1",
  "is_person_photo": "Yes/No",
  "quality_score": "0.0-1.0",
  "background": "plain/cluttered/outdoor/indoor",
  "lighting": "good/poor/backlit",
  "glasses": "Yes/No",
  "head_covering": "Yes/No",
  "expression": "neutral/smiling/other",
  "face_visible": "Yes/No",
  "pass": "Yes/No",
  "fail_reasons": "comma separated reasons or empty string",
  "confidence": 0.0
}
Pass=Yes only if: face_detected=Yes, is_person_photo=Yes, faces_count=1, quality_score>=0.6, face_visible=Yes.`,

  passport: `You are a KYC document OCR and face-match system.
Analyze this passport image. Extract ALL visible fields AND assess photo quality.
Return ONLY this JSON:
{
  "document_number": "",
  "full_name": "",
  "date_of_birth": "",
  "expiry_date": "",
  "issue_date": "",
  "nationality": "",
  "gender": "",
  "place_of_birth": "",
  "issuing_country": "",
  "mrz_line1": "",
  "mrz_line2": "",
  "passport_photo_detected": "Yes/No",
  "document_valid": "Yes/No",
  "confidence": 0.0
}
Return ONLY the JSON.`,

  face_match: `You are a biometric face-matching system for KYC verification.
You have been given TWO images: the first is a live/profile photo, the second is a passport/ID photo.
Compare the faces and determine if they are the same person.
Return ONLY this JSON:
{
  "face_in_photo1": "Yes/No",
  "face_in_photo2": "Yes/No",
  "faces_match": "Yes/No",
  "match_score": "0.0-1.0",
  "match_level": "High/Medium/Low/No Match",
  "same_person": "Yes/No",
  "notes": "",
  "pass": "Yes/No",
  "confidence": 0.0
}
Pass=Yes only if match_score>=0.60 and same_person=Yes.`,

  live_face: `You are a liveness detection and biometric verification system for KYC.
Analyze this photo for signs of liveness (real person vs printed/screen photo spoof).
Return ONLY this JSON:
{
  "face_detected": "Yes/No",
  "liveness_check": "Pass/Fail/Unknown",
  "is_real_person": "Yes/No",
  "spoof_detected": "Yes/No",
  "spoof_type": "none/printed_photo/screen_photo/mask/other",
  "quality_score": "0.0-1.0",
  "lighting": "good/poor/backlit",
  "eyes_open": "Yes/No",
  "head_pose": "frontal/tilted/profile",
  "pass": "Yes/No",
  "fail_reasons": "",
  "confidence": 0.0
}
Pass=Yes only if: face_detected=Yes, liveness_check=Pass, is_real_person=Yes, spoof_detected=No.`,

  utility_bill: `You are a KYC document OCR system. Analyze this utility bill / proof of address document carefully.
Extract ALL visible fields including personal details of the account holder AND the service address.
The address may appear as a multi-line block — split it into structured fields.
Return ONLY this JSON (leave as empty string if not found, never return null):
{
  "full_name": "",
  "date_of_birth": "",
  "nationality": "",
  "nric_passport": "",
  "phone": "",
  "email": "",
  "account_holder": "",
  "account_number": "",
  "provider": "",
  "billing_date": "",
  "due_date": "",
  "amount_due": "",
  "address_line1": "",
  "address_line2": "",
  "city": "",
  "state": "",
  "postal_code": "",
  "country": "",
  "confidence": 0.0
}
Rules:
- full_name: the account holder name
- date_of_birth: in YYYY-MM-DD format if possible, otherwise as printed
- address_line1: first line of the service/delivery address (e.g. unit/block/street)
- address_line2: second line if present (e.g. area/block name)
- city: city or town name
- state: state or province
- postal_code: the numeric postal/zip code
- country: country name
Return ONLY the JSON.`,

  bank_statement: `You are a KYC document OCR system. Analyze this bank statement.
Return ONLY this JSON:
{
  "account_holder": "",
  "account_number": "",
  "bank_name": "",
  "statement_period": "",
  "opening_balance": "",
  "closing_balance": "",
  "branch_address": "",
  "full_name": "",
  "confidence": 0.0
}
Return ONLY the JSON.`,

  tax_document: `You are a KYC document OCR system. Analyze this tax document (W-2, 1040, ITIN letter, etc.).
Return ONLY this JSON:
{
  "taxpayer_name": "",
  "tax_id": "",
  "tax_year": "",
  "filing_status": "",
  "total_income": "",
  "tax_withheld": "",
  "employer_name": "",
  "form_type": "",
  "full_name": "",
  "address": "",
  "confidence": 0.0
}
Return ONLY the JSON.`,

  salary_proof: `You are a KYC document OCR system. Analyze this salary slip / payslip / income proof.
Return ONLY this JSON:
{
  "employee_name": "",
  "employee_id": "",
  "employer_name": "",
  "employer_address": "",
  "pay_period": "",
  "pay_date": "",
  "basic_salary": "",
  "gross_salary": "",
  "net_salary": "",
  "deductions": "",
  "bank_account": "",
  "designation": "",
  "department": "",
  "full_name": "",
  "confidence": 0.0
}
Return ONLY the JSON.`,

  national_id: `You are a KYC document OCR system. Analyze this national ID card.
Return ONLY this JSON:
{
  "id_number": "",
  "full_name": "",
  "date_of_birth": "",
  "expiry_date": "",
  "address": "",
  "gender": "",
  "nationality": "",
  "confidence": 0.0
}
Return ONLY the JSON.`,

  drivers_license: `You are a KYC document OCR system. Analyze this driver's license.
Return ONLY this JSON:
{
  "license_number": "",
  "full_name": "",
  "date_of_birth": "",
  "expiry_date": "",
  "address": "",
  "vehicle_class": "",
  "issuing_state": "",
  "confidence": 0.0
}
Return ONLY the JSON.`,

  kyc_profile: `You are an expert KYC document OCR and data extraction system. Your goal is to achieve 99% field extraction rate. You MUST fill every field possible using direct extraction, inference, deduction, and contextual reasoning.

This document may be: passport, national ID (NRIC, MyKad, Aadhaar, SSN card, HKID), utility bill, bank statement, driver's license, tax form, employment letter, or any identity/address document.

ABSOLUTE RULES — YOU MUST FOLLOW ALL:

1. NEVER leave a field empty if you can reasonably infer it.
2. If a field is not explicitly printed but can be DEDUCED from other information, DEDUCE IT.
3. If you are 50%+ confident about a value, INCLUDE IT. Only leave empty at 0% confidence.

MANDATORY INFERENCE LOGIC:

NATIONALITY & COUNTRY:
- Malaysian documents (MyKad, NRIC format XXXXXX-XX-XXXX): nationality = "Malaysian", country = "Malaysia"
- Indian documents (Aadhaar, PAN, Voter ID): nationality = "Indian", country = "India"
- Singapore documents (NRIC S/T/F/G prefix): nationality = "Singaporean", country = "Singapore"
- US documents (SSN, US passport, driver's license): nationality = "American", country = "United States"
- UK documents (UK passport): nationality = "British", country = "United Kingdom"
- If document language/format/currency/symbols indicate a specific country, SET country AND nationality.
- Nationality = the country that issued the document unless explicitly stated otherwise.

DATE OF BIRTH:
- Malaysian NRIC "YYMMDD-XX-XXXX": first 6 digits = DOB. Example: "950512-14-5123" → DOB = "1995-05-12"
- If year is 00-30, prefix with 20 (e.g., 050312 → 2005-03-12). If 31-99, prefix with 19 (e.g., 850612 → 1985-06-12).
- Parse ANY date format: DD/MM/YYYY, MM/DD/YYYY, DD-MMM-YYYY, DD.MM.YYYY, "12 JAN 1990", etc.
- ALWAYS output as YYYY-MM-DD.

STATE (from Malaysian NRIC state code — 2 digits after first dash):
- 01/21/22/23/24 = Johor, 02/25/26 = Kedah, 03/27/28/29 = Kelantan, 04/30 = Malacca
- 05/31/59 = Negeri Sembilan, 06/32/33 = Pahang, 07/34/35 = Penang, 08/36/37/38/39 = Perak
- 09/40 = Perlis, 10/41/42/43/44 = Selangor, 11/45/46 = Terengganu
- 12/47/48/49 = Sabah, 13/50/51/52/53 = Sarawak, 14/54/55/56/57 = Wilayah Persekutuan (Kuala Lumpur)
- 15/58 = Wilayah Persekutuan (Labuan), 16 = Wilayah Persekutuan (Putrajaya)

ADDRESS PARSING:
- If address is a single text block, split intelligently: street → address_line1, area/building → address_line2, then city, state, postal_code, country.
- Look for postal codes (5-6 digit numbers in Malaysia, 6 digits in India/Singapore, 5 digits in US).
- City is usually the word before the state or after the postal code.
- If you see "Kuala Lumpur" or "KL" → city = "Kuala Lumpur", state = "Wilayah Persekutuan".
- If postal code starts with 4xxxx-5xxxx in Malaysia, city is likely in Selangor.
- If postal code starts with 1xxxx in Malaysia, likely Penang.

PHONE:
- Look for: "Tel", "Phone", "Mobile", "Contact", "H/P", "No. Tel", "Telefon" labels.
- Malaysian format: +60 XX-XXXXXXX or 01X-XXXXXXX
- Include country code. If not visible, infer from document country (+60 Malaysia, +65 Singapore, +91 India, +1 US/Canada, +44 UK).

Return ONLY this JSON (use empty string "" ONLY if truly impossible to determine even with inference, NEVER return null):
{
  "full_name": "",
  "date_of_birth": "",
  "nationality": "",
  "phone": "",
  "email": "",
  "document_number": "",
  "address_line1": "",
  "address_line2": "",
  "city": "",
  "state": "",
  "postal_code": "",
  "country": "",
  "confidence": 0.0
}

CRITICAL OUTPUT RULES:
- NEVER use placeholder values like "N/A", "Not available", "None", "Unknown", "Not found", "-", or similar. Use ONLY the actual extracted/inferred value OR empty string "".
- Use EXACTLY these field names in your JSON response. Do NOT rename them (e.g., use "phone" not "phone_number", use "postal_code" not "postcode").
- Your target is 99% extraction. Use ALL visible text, numbers, formatting, language, and document structure as clues.
- Infer aggressively. Only "" as absolute last resort when information is truly absent from the document.
- Return ONLY valid JSON, no markdown fences, no explanation, no commentary.`,
};

const DEFAULT_PROMPT = `You are a KYC document OCR system. Extract all visible text and data from this document.
Return a JSON object with all key-value pairs you can identify, plus a "confidence" field (0.0-1.0).
Return ONLY valid JSON.`;

// ── Gemini API helper ─────────────────────────────────────────────────────────

async function callGemini(parts: unknown[]): Promise<string> {
  const payload = {
    contents: [{ parts }],
    // temperature/topK/topP are no longer recommended for Gemini 3.x models
    generationConfig: { maxOutputTokens: 2048 },
  };
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// Map common alternate field names to canonical names
const FIELD_ALIASES: Record<string, string> = {
  name: "full_name",
  account_holder_name: "full_name",
  holder_name: "full_name",
  customer_name: "full_name",
  dob: "date_of_birth",
  birth_date: "date_of_birth",
  birthdate: "date_of_birth",
  phone_number: "phone",
  mobile: "phone",
  mobile_number: "phone",
  tel: "phone",
  telephone: "phone",
  contact_number: "phone",
  contact: "phone",
  hp: "phone",
  address: "address_line1",
  street_address: "address_line1",
  service_address: "address_line1",
  address_1: "address_line1",
  address_2: "address_line2",
  zip_code: "postal_code",
  zip: "postal_code",
  postcode: "postal_code",
  post_code: "postal_code",
  province: "state",
  region: "state",
  citizenship: "nationality",
  id_number: "document_number",
  nric: "document_number",
  nric_passport: "document_number",
  passport_number: "document_number",
  ic_number: "document_number",
};

function normalizeFieldKeys(raw: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = key.toLowerCase().trim().replace(/[\s\-]+/g, "_");
    const canonical = FIELD_ALIASES[normalized] || normalized;
    // Don't overwrite if canonical key already has a value
    if (!result[canonical] || !result[canonical].trim()) {
      result[canonical] = value;
    }
  }
  return result;
}

function parseGeminiJson(rawText: string): { fields: Record<string, string>; confidence: number } {
  let fields: Record<string, string> = {};
  let confidence = 0.85;
  try {
    // Strip markdown fences and any text before/after the JSON
    let cleaned = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
    // If there's text before the first {, strip it
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }
    const parsed = JSON.parse(cleaned);
    confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.85;
    delete parsed.confidence;
    const rawFields = Object.fromEntries(
      Object.entries(parsed)
        .filter(([, v]) => v !== null && v !== "" && v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    fields = normalizeFieldKeys(rawFields);
  } catch (e) {
    console.error("JSON parse failed, falling back to line parsing:", e);
    const lines = rawText.split("\n").filter((l: string) => l.includes(":"));
    for (const line of lines) {
      const [key, ...rest] = line.split(":");
      if (key && rest.length) {
        const k = key.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
        const v = rest.join(":").trim().replace(/[",{}]/g, "");
        if (k && v) fields[k] = v;
      }
    }
    fields = normalizeFieldKeys(fields);
  }
  return { fields, confidence };
}

function toBase64(buf: Buffer): string {
  return buf.toString("base64");
}

// ── Name cross-check helper ───────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").trim();
}

function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1.0;
  const wordsA = new Set(na.split(/\s+/));
  const wordsB = new Set(nb.split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface UploadedFile {
  originalname: string;
  size: number;
  mimetype: string;
  buffer: Buffer;
}

function buildMetadata(file: UploadedFile, documentType: string) {
  return {
    file_name: file.originalname,
    file_size: file.size,
    file_size_human: formatBytes(file.size),
    file_type: file.mimetype,
    document_type: documentType,
    upload_timestamp: new Date().toISOString(),
    gemini_model: "gemini-3.5-flash",
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const app = express();
app.use(cors({ origin: true }));

app.get("/healthz", (_req: Request, res: Response) => res.status(200).send("ok"));

app.post(
  "/ocr",
  upload.fields([{ name: "file", maxCount: 1 }, { name: "ref_file", maxCount: 1 }]),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const file = files?.file?.[0];
      const refFile = files?.ref_file?.[0];
      const documentType = (req.body.document_type as string) || "passport";
      const crossCheckData = (req.body.cross_check_data as string) || null;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Use JPG, PNG, or PDF." });
      }

      const base64 = toBase64(file.buffer);
      const mimeType = file.mimetype === "application/pdf" ? "application/pdf" : file.mimetype;

      // ── Step-specific logic ────────────────────────────────────────────────────

      // PHOTO: check if it's a real person face photo
      if (documentType === "photo") {
        const prompt = PROMPTS["photo"];
        const rawText = await callGemini([
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ]);
        const { fields, confidence } = parseGeminiJson(rawText);

        const faceDetected = fields.face_detected === "Yes";
        const isPersonPhoto = fields.is_person_photo === "Yes";
        const qualityScore = parseFloat(fields.quality_score ?? "0");
        const faceVisible = fields.face_visible !== "No";

        const pass = faceDetected && isPersonPhoto && faceVisible && qualityScore >= 0.60;

        const failReasons = !pass
          ? [
              !faceDetected ? "No face detected" : "",
              !isPersonPhoto ? "Not a person photo" : "",
              !faceVisible ? "Face not clearly visible" : "",
              qualityScore < 0.60 ? `Quality too low (${Math.round(qualityScore * 100)}% < 60%)` : "",
            ].filter(Boolean).join(", ")
          : "";

        const verificationScores = {
          face_detected: faceDetected,
          is_person_photo: isPersonPhoto,
          faces_count: fields.faces_count ?? "0",
          quality_score: qualityScore,
          lighting: fields.lighting ?? "unknown",
          glasses: fields.glasses ?? "No",
          head_covering: fields.head_covering ?? "No",
          expression: fields.expression ?? "unknown",
          pass,
          fail_reasons: failReasons,
          ai_confidence: confidence,
        };

        return res.status(200).json({
          success: true,
          confidence,
          fields,
          verification_scores: verificationScores,
          verification_status: pass ? "pass" : "fail",
          metadata: buildMetadata(file, documentType),
          raw_text: rawText,
        });
      }

      // PASSPORT: OCR + optional face-match against profile photo
      if (documentType === "passport") {
        const prompt = PROMPTS["passport"];
        const parts: unknown[] = [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ];
        const rawText = await callGemini(parts);
        const { fields, confidence } = parseGeminiJson(rawText);

        let faceMatchScores: Record<string, unknown> = {};
        let faceMatchPass = false;

        if (refFile) {
          const refBase64 = toBase64(refFile.buffer);
          const refMime = refFile.mimetype === "application/pdf" ? "image/jpeg" : refFile.mimetype;
          const matchPrompt = PROMPTS["face_match"];
          const matchRaw = await callGemini([
            { text: matchPrompt },
            { inline_data: { mime_type: refMime, data: refBase64 } },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ]);
          const { fields: mf, confidence: mc } = parseGeminiJson(matchRaw);
          const matchScore = parseFloat(mf.match_score ?? "0");
          faceMatchPass = matchScore >= 0.60 && (mf.same_person === "Yes" || mf.same_person === "yes");
          faceMatchScores = {
            face_in_photo1: mf.face_in_photo1,
            face_in_photo2: mf.face_in_photo2,
            faces_match: mf.faces_match,
            match_score: matchScore,
            match_level: mf.match_level ?? "Unknown",
            same_person: mf.same_person,
            pass: faceMatchPass,
            notes: mf.notes ?? "",
            ai_confidence: mc,
          };
        }

        const verificationScores = {
          ocr_confidence: confidence,
          document_valid: fields.document_valid === "Yes",
          passport_photo_detected: fields.passport_photo_detected === "Yes",
          face_match: refFile ? faceMatchScores : null,
          pass: refFile ? faceMatchPass : true,
        };

        const overallPass = refFile ? faceMatchPass : true;

        return res.status(200).json({
          success: true,
          confidence,
          fields,
          verification_scores: verificationScores,
          verification_status: overallPass ? "pass" : "fail",
          metadata: buildMetadata(file, documentType),
          raw_text: rawText,
        });
      }

      // LIVE FACE: liveness detection
      if (documentType === "live_face") {
        const prompt = PROMPTS["live_face"];
        const rawText = await callGemini([
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ]);
        const { fields, confidence } = parseGeminiJson(rawText);

        const pass = fields.pass === "Yes" || fields.pass === "yes";
        const verificationScores = {
          face_detected: fields.face_detected === "Yes",
          liveness_check: fields.liveness_check ?? "Unknown",
          is_real_person: fields.is_real_person === "Yes",
          spoof_detected: fields.spoof_detected === "Yes",
          spoof_type: fields.spoof_type ?? "none",
          quality_score: parseFloat(fields.quality_score ?? "0"),
          lighting: fields.lighting ?? "unknown",
          eyes_open: fields.eyes_open === "Yes",
          head_pose: fields.head_pose ?? "unknown",
          pass,
          fail_reasons: fields.fail_reasons ?? "",
          ai_confidence: confidence,
        };

        return res.status(200).json({
          success: true,
          confidence,
          fields,
          verification_scores: verificationScores,
          verification_status: pass ? "pass" : "fail",
          metadata: buildMetadata(file, documentType),
          raw_text: rawText,
        });
      }

      // ADDRESS / TAX / SALARY: OCR + optional cross-check
      const prompt = PROMPTS[documentType] ?? DEFAULT_PROMPT;
      const rawText = await callGemini([
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ]);
      const { fields, confidence } = parseGeminiJson(rawText);

      let crossCheckResult: Record<string, unknown> = {};
      let crossCheckPass = true;

      if (crossCheckData) {
        try {
          const previousNames: Record<string, string> = JSON.parse(crossCheckData);
          const thisName =
            fields.account_holder ?? fields.employee_name ?? fields.taxpayer_name ??
            fields.full_name ?? "";

          const checks: Record<string, unknown> = {};
          let allMatch = true;

          for (const [docType, refName] of Object.entries(previousNames)) {
            if (!refName || !thisName) continue;
            const score = nameSimilarity(thisName, refName);
            const match = score >= 0.5;
            if (!match) allMatch = false;
            checks[docType] = { ref_name: refName, this_name: thisName, similarity: score, match };
          }

          crossCheckResult = { checks, all_names_match: allMatch, extracted_name: thisName };
          crossCheckPass = allMatch;
        } catch {
          crossCheckResult = { error: "Could not parse cross_check_data" };
        }
      }

      const verificationScores = {
        ocr_confidence: confidence,
        extracted_name: fields.account_holder ?? fields.employee_name ?? fields.taxpayer_name ?? fields.full_name ?? "",
        cross_check: crossCheckData ? crossCheckResult : null,
        pass: crossCheckPass,
      };

      return res.status(200).json({
        success: true,
        confidence,
        fields,
        verification_scores: verificationScores,
        verification_status: crossCheckPass ? "pass" : "fail",
        metadata: buildMetadata(file, documentType),
        raw_text: rawText,
      });
    } catch (err: unknown) {
      console.error("OCR error:", err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : "OCR processing failed",
        success: false,
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`ocr-backend listening on :${PORT}`);
});
