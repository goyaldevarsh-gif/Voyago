/** Things people usually pack on the morning they leave, because they are still in use until then. */
const RE = /charger|power ?bank|phone|wallet|tooth ?brush|tooth ?paste|pillow(?! cover)|clonazepam|dolo|flexon|aadhaar|photo id|licen[cs]e|\bdl\b|keys?\b|watch|earphone|airpod|spectacle|glasses|razor|deodorant|perfume|laptop|debit|credit card/i;
export const defaultPackWhen = (name: string): 'any' | 'last_minute' => (RE.test(name) ? 'last_minute' : 'any');
export const isLastMinute = (i: { name: string; pack_when?: 'any' | 'last_minute' }) => (i.pack_when ?? defaultPackWhen(i.name)) === 'last_minute';
