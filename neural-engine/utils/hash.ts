export const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
export const FNV_PRIME_32 = 16777619;

export function hashStringFNV(text: string): number {
  let hash = FNV_OFFSET_BASIS_32;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME_32);
  }
  return hash >>> 0;
}
