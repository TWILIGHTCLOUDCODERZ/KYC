import type { RiskLevel } from '../types/database';

export interface AMLResult {
  score: number;
  risk_level: RiskLevel;
  flags: string[];
  screened_at: string;
}

// Simulated AML risk scoring — replace with real AML API via edge function
export async function runAMLScreening(profile: {
  full_name: string;
  nationality?: string;
  date_of_birth?: string;
  country?: string;
}): Promise<AMLResult> {
  await new Promise(r => setTimeout(r, 1500));

  const HIGH_RISK_COUNTRIES = ['IR', 'KP', 'SY', 'CU', 'VE', 'SD'];
  const SANCTIONED_NAMES = ['JOHN SMITH', 'JANE DOE TEST'];

  const flags: string[] = [];
  let score = Math.floor(Math.random() * 30) + 5;

  if (profile.nationality && HIGH_RISK_COUNTRIES.includes(profile.nationality.toUpperCase())) {
    flags.push('HIGH_RISK_JURISDICTION');
    score += 35;
  }
  if (profile.country && HIGH_RISK_COUNTRIES.includes(profile.country.toUpperCase())) {
    flags.push('HIGH_RISK_RESIDENCE');
    score += 25;
  }
  if (SANCTIONED_NAMES.some(n => profile.full_name.toUpperCase().includes(n))) {
    flags.push('WATCHLIST_MATCH');
    score += 50;
  }
  if (score > 30 && score <= 50) flags.push('ENHANCED_DUE_DILIGENCE_REQUIRED');
  if (score > 50) flags.push('PEP_SCREENING_REQUIRED');

  score = Math.min(score, 100);

  let risk_level: RiskLevel = 'low';
  if (score >= 70) risk_level = 'critical';
  else if (score >= 50) risk_level = 'high';
  else if (score >= 30) risk_level = 'medium';

  return { score, risk_level, flags, screened_at: new Date().toISOString() };
}
