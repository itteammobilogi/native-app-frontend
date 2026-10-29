// Readable labels for variant attributes. Sellers send a colour as a swatch
// hex in `colour` ("#0000FF") and, usually, the word in `colour_name`
// ("Blue"). Same rules as the website (utils/colourNames.js and the product
// page's resolveColourLabel): the seller's own word first, the nearest named
// colour second, the raw value last.

type Attr = { name: string; value: string };

const NAMED_COLORS: [string, [number, number, number]][] = [
  ['Black', [0, 0, 0]],
  ['White', [255, 255, 255]],
  ['Gray', [128, 128, 128]],
  ['Silver', [192, 192, 192]],
  ['Red', [255, 0, 0]],
  ['Maroon', [128, 0, 0]],
  ['Orange', [255, 165, 0]],
  ['Coral', [255, 127, 80]],
  ['Gold', [255, 215, 0]],
  ['Yellow', [255, 255, 0]],
  ['Olive', [128, 128, 0]],
  ['Lime', [0, 255, 0]],
  ['Green', [0, 128, 0]],
  ['Teal', [0, 128, 128]],
  ['Cyan', [0, 255, 255]],
  ['Blue', [0, 0, 255]],
  ['Navy', [0, 0, 128]],
  ['Purple', [128, 0, 128]],
  ['Violet', [238, 130, 238]],
  ['Pink', [255, 192, 203]],
  ['Brown', [165, 42, 42]],
  ['Chocolate', [210, 105, 30]],
  ['Beige', [245, 245, 220]],
  ['Indigo', [75, 0, 130]],
  ['Magenta', [255, 0, 255]],
];

export const isHexColour = (value: unknown) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value ?? '').trim());

const isColourKey = (name: string) => /^colou?r$/i.test(name.trim());
const isColourNameKey = (name: string) => /^colou?r[ _-]?name$/i.test(name.trim());

// Nearest of ~25 named colours; null when `hex` isn't a hex colour.
export function hexToColorName(hex: string): string | null {
  if (!isHexColour(hex)) return null;
  const h = hex.trim().slice(1);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  let best = NAMED_COLORS[0][0];
  let bestDistance = Infinity;
  for (const [name, [cr, cg, cb]] of NAMED_COLORS) {
    const d = (cr - r) ** 2 + (cg - g) ** 2 + (cb - b) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = name;
    }
  }
  return best;
}

// hex → seller's word, gathered across every sibling variant (one variant may
// carry the word when another doesn't).
export function colourNameMap(variants: { variant_attributes?: Attr[]; info_attributes?: Attr[] }[] | undefined) {
  const map = new Map<string, string>();
  for (const v of variants ?? []) {
    const pairs = [...(v.variant_attributes ?? []), ...(v.info_attributes ?? [])];
    const hex = pairs.find((a) => isColourKey(String(a.name)))?.value;
    const word = pairs.find((a) => isColourNameKey(String(a.name)))?.value;
    if (hex && word) map.set(String(hex).trim().toLowerCase(), String(word).trim());
  }
  return map;
}

export function colourLabel(value: string, names?: Map<string, string>) {
  const raw = String(value ?? '').trim();
  if (!isHexColour(raw)) return raw;
  return names?.get(raw.toLowerCase()) ?? hexToColorName(raw) ?? raw;
}

// "Blue · M" from a variant's attributes: hex colours become words, and a
// separate colour-name attribute isn't repeated next to the colour it names.
export function attributeLabel(attrs: Attr[] | undefined, names?: Map<string, string>) {
  if (!attrs?.length) return '';
  const own = new Map(names);
  const hex = attrs.find((a) => isColourKey(String(a.name)))?.value;
  const word = attrs.find((a) => isColourNameKey(String(a.name)))?.value;
  if (hex && word) own.set(String(hex).trim().toLowerCase(), String(word).trim());
  return attrs
    .filter((a) => !(hex && isColourNameKey(String(a.name))))
    .map((a) => colourLabel(a.value, own))
    .filter(Boolean)
    .join(' · ');
}

// The swatch hex among a variant's attributes, for a colour dot.
export const swatchHex = (attrs: Attr[] | undefined) => attrs?.map((a) => String(a.value).trim()).find(isHexColour) ?? null;
