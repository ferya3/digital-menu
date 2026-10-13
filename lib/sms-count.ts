/** تعدادِ پیامک (بخش) برای یک متن: فارسی/یونیکد ۷۰ نویسه در پیامکِ تک‌بخشی و ۶۷ در هر بخشِ چندبخشی؛ لاتین ۱۶۰ و ۱۵۳ */
export function smsSegments(text: string): { chars: number; segments: number; unicode: boolean } {
  const chars = [...text].length;
  const unicode = /[^\u0000-\u007F]/.test(text);
  const [single, multi] = unicode ? [70, 67] : [160, 153];
  const segments = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi);
  return { chars, segments, unicode };
}
