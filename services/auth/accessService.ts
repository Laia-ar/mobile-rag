import {CountryCode, KnowledgeManifest} from '../../types/knowledge';
import {sha256Text} from '../native/offlineKnowledge';

export function normalizeAccessCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

export async function verifyOfflineAccessCode(
  value: string,
  country: CountryCode,
  manifest: KnowledgeManifest,
): Promise<boolean> {
  const normalized = normalizeAccessCode(value);
  if (!normalized || !manifest.countries.includes(country)) {
    return false;
  }
  if (manifest.access.strategy === 'disabled-for-development') {
    return true;
  }
  const digest = await sha256Text(`${country}:${normalized}`);
  return manifest.access.acceptedCodeHashes[country].includes(digest);
}
