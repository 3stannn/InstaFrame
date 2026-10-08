export function previewAssetUrl(value: string, base: string, endpoint: string): string {
  if (/^(data:|blob:|#)/i.test(value)) return value;
  if (value.startsWith(`${endpoint}?`)) return value;
  try {
    const url = new URL(value, base);
    return /^https?:$/.test(url.protocol) ? `${endpoint}?asset=1&url=${encodeURIComponent(url.href)}` : value;
  } catch { return value; }
}

export function rewritePreviewCss(css: string, base: string, endpoint: string): string {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_, quote, value) =>
    `url("${previewAssetUrl(value.trim(), base, endpoint)}")`)
    .replace(/(@import\s+)(["'])([^"']+)\2/gi, (_, prefix, quote, value) =>
      `${prefix}${quote}${previewAssetUrl(value, base, endpoint)}${quote}`);
}

export function rewritePreviewModule(source: string, base: string, endpoint: string): string {
  // Rewrite module specifiers, leaving ordinary strings and bare package names alone.
  return source.replace(/(["'])((?:\/)?assets\/[^"']+)\1/g, (_, quote, value) =>
    `${quote}${previewAssetUrl(`/${value.replace(/^\//, "")}`, base, endpoint)}${quote}`)
    .replace(/\b(?:window|document|globalThis)\.location\b/g, "window.__INSTAFRAME_LOCATION__")
    .replace(/(?<![\w$.])([\w$]+)\.location\b(?=\.)/g, "window.__INSTAFRAME_READ_LOCATION__($1)")
    .replace(/(?<![\w$.])location\.(href|pathname|search|hash|origin|host|hostname|protocol|port)\b/g, "window.__INSTAFRAME_LOCATION__.$1")
    .replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(["'])([^"']+)\2/g,
    (match, prefix, quote, value) => /^(\.{1,2}\/|\/|https?:\/\/)/.test(value)
      ? `${prefix}${quote}${previewAssetUrl(value, base, endpoint)}${quote}` : match);
}
