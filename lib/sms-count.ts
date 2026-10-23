/** GSM 03.38 basic + extension characters (extension chars count as two) */
const GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";

/** SMS segment count: GSM-7 text = 160 chars in one SMS (153 per part); anything else (UCS-2) = 70 (67 per part) */
export function smsSegments(text: string): { chars: number; segments: number; unicode: boolean } {
  const unicode = [...text].some((c) => !GSM.includes(c) && !GSM_EXT.includes(c));
  const chars = unicode ? [...text].length : [...text].reduce((n, c) => n + (GSM_EXT.includes(c) ? 2 : 1), 0);
  const [single, multi] = unicode ? [70, 67] : [160, 153];
  const segments = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi);
  return { chars, segments, unicode };
}
