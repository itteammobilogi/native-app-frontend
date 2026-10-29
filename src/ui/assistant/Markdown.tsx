import { Linking, View, type TextStyle } from 'react-native';

import { WEBSITE_URL } from '@/core/config';
import { Text } from '../Text';
import { usePalette } from '../theme';

// Bot reply text, after the widget's ui/Markdown.jsx: paragraphs, "-" / "*" /
// "•" bullets, "1." lists, **bold**, *italic* and [links](url). Links open
// only http(s) or site-relative URLs (the latter on zillybuy.com).

const INLINE = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\)|\*[^*\n]+\*)/g;
const BULLET = /^\s*(?:[-*•])\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;

type Block = { type: 'p'; lines: string[] } | { type: 'ul' | 'ol'; items: string[] };

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((line) => {
      const bullet = line.match(BULLET);
      const numbered = !bullet ? line.match(NUMBERED) : null;
      if (bullet || numbered) {
        const type = bullet ? 'ul' : 'ol';
        if (!current || current.type !== type) {
          current = { type, items: [] };
          blocks.push(current);
        }
        current.items.push(bullet ? bullet[1] : numbered![2]);
      } else if (!line.trim()) {
        current = null;
      } else if (current?.type === 'p') {
        current.lines.push(line);
      } else {
        current = { type: 'p', lines: [line] };
        blocks.push(current);
      }
    });
  return blocks;
}

function safeHref(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return `${WEBSITE_URL}${url}`;
  return null;
}

function Inline({ text, color }: { text: string; color: string }) {
  return (
    <>
      {text
        .split(INLINE)
        .filter(Boolean)
        .map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <Text key={i} style={{ fontWeight: '700' }}>
                {part.slice(2, -2)}
              </Text>
            );
          }
          const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
          if (link) {
            const href = safeHref(link[2]);
            return href ? (
              <Text key={i} onPress={() => Linking.openURL(href).catch(() => {})} style={{ color, fontWeight: '600', textDecorationLine: 'underline' }}>
                {link[1]}
              </Text>
            ) : (
              link[1]
            );
          }
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
              <Text key={i} style={{ fontStyle: 'italic' }}>
                {part.slice(1, -1)}
              </Text>
            );
          }
          return part;
        })}
    </>
  );
}

// Word count and the first `n` words with their spacing, for the
// word-by-word reveal of a fresh reply.
export const countWords = (text: string) => (text.match(/\S+/g) || []).length;
export function firstWords(text: string, n: number) {
  let seen = 0;
  const m = text.match(/\S+\s*/g) || [];
  let out = '';
  for (const piece of m) {
    if (seen >= n) break;
    out += piece;
    seen += 1;
  }
  return out.trimEnd();
}

export function Markdown({ text, style }: { text: string; style?: TextStyle }) {
  const t = usePalette();
  const base: TextStyle = { fontSize: 15, lineHeight: 21, ...style };
  return (
    <View style={{ gap: 6 }}>
      {toBlocks(text).map((block, b) =>
        block.type === 'p' ? (
          <Text key={b} style={base}>
            <Inline text={block.lines.join('\n')} color={t.primary} />
          </Text>
        ) : (
          <View key={b} style={{ gap: 3 }}>
            {block.items.map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
                <Text style={[base, { color: t.textMuted, minWidth: 12 }]}>{block.type === 'ul' ? '•' : `${i + 1}.`}</Text>
                <Text style={[base, { flex: 1 }]}>
                  <Inline text={item} color={t.primary} />
                </Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}
