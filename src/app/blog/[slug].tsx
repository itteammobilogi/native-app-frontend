import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { authorPhoto, blogAsset, blogDate, getBlog, listBlogs } from '@/core/api/blogs';
import { WEBSITE_URL } from '@/core/config';
import { useAsync } from '@/core/hooks/useAsync';
import { openSiteLink } from '@/core/links';
import { BlogCard } from '@/ui/BlogCard';
import { IconButton, tap } from '@/ui/Button';
import { ErrorState, Header, Screen, SectionTitle } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette, type Palette } from '@/ui/theme';

// Same clean-up the website runs before rendering (normalizeBlogHtml): drop
// empty paragraphs/nbsp padding and the editor's fixed widths, and wrap
// tables so they scroll sideways instead of overflowing the screen.
function normalizeBlogHtml(html: string) {
  return html
    .replace(/&nbsp;| /gi, ' ')
    .replace(/<(p|div|span)\b[^>]*>(\s|<br\s*\/?>)*<\/\1>/gi, '')
    .replace(/(<br\s*\/?>\s*)+<\/(p|li|div)>/gi, '</$2>')
    .replace(/\s*(?:min-|max-)?width:\s*[^;"']+;?/gi, '')
    .replace(/\s*white-space:\s*[^;"']+;?/gi, '')
    .replace(/(<(?:table|th|td|col)\b[^>]*?)\swidth=(["'])[^"']*\2/gi, '$1')
    .replace(/<table\b/gi, '<div class="tw"><table')
    .replace(/<\/table>/gi, '</table></div>');
}

// The article body renders in a WebView sized to its content, so headings,
// tables and inline links look as they do on the website; the rest of the
// screen is native.
function articleHtml(content: string, t: Palette) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
:root{color-scheme:${t.dark ? 'dark' : 'light'}}
html,body{margin:0;padding:0;background:transparent;color:${t.text};font:16px/1.65 -apple-system,system-ui,Roboto,sans-serif;-webkit-text-size-adjust:100%;word-wrap:break-word}
#c{padding:1px 0}
h1,h2,h3,h4{line-height:1.3;margin:1.4em 0 .5em;color:${t.text}}
h2{font-size:21px}h3{font-size:18px}h4{font-size:16px}
p{margin:0 0 1em;color:${t.textMuted}}
strong,b{color:${t.text}}
a{color:${t.primary};text-decoration:underline}
ul,ol{padding-left:1.3em;color:${t.textMuted}}li{margin:.3em 0}
img,video,iframe{max-width:100%;height:auto;border-radius:12px}
figure{margin:1em 0}
blockquote{margin:1em 0;padding:.6em 1em;border-left:3px solid ${t.primary};background:${t.hairline};border-radius:8px}
.tw{overflow-x:auto;margin:1em 0;border:1px solid ${t.hairline};border-radius:12px}
table{border-collapse:collapse;min-width:100%;font-size:14px}
th,td{padding:8px 10px;border-bottom:1px solid ${t.hairline};text-align:left;vertical-align:top;min-width:110px}
th{background:${t.hairline};color:${t.text}}
details{margin:.6em 0;padding:.6em .8em;border:1px solid ${t.hairline};border-radius:10px}
summary{font-weight:600;color:${t.text}}
</style></head><body><div id="c">${normalizeBlogHtml(content)}</div>
<script>
(function(){var last=0;function post(){var h=document.getElementById('c').getBoundingClientRect().height;if(Math.abs(h-last)>1){last=h;window.ReactNativeWebView.postMessage(String(Math.ceil(h)))}}
post();window.addEventListener('load',post);if(window.ResizeObserver)new ResizeObserver(post).observe(document.getElementById('c'));
document.querySelectorAll('img').forEach(function(i){i.addEventListener('load',post)});})();
</script></body></html>`;
}

// The HTML is loaded against the website's origin (so relative links
// resolve there); that initial load and in-page #anchors must go through.
const BASE = WEBSITE_URL.replace(/\/$/, '');
const isOwnLoad = (url: string) => {
  const u = url.replace(/\/$/, '');
  return /^(about|data):/i.test(url) || u === BASE || u.startsWith(`${BASE}#`) || u.startsWith(`${BASE}/#`);
};

export default function BlogScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const blog = useAsync(() => getBlog(slug), [slug]);
  const latest = useAsync(() => listBlogs(1, 6).then((r) => r.items.filter((p) => p.slug !== slug).slice(0, 4)), [slug]);
  const [height, setHeight] = useState(0);
  const b = blog.data;

  const html = useMemo(() => (b ? articleHtml(b.content || '', t) : ''), [b, t]);

  const onMessage = (e: WebViewMessageEvent) => {
    const h = Number(e.nativeEvent.data);
    if (h > 0) setHeight(h);
  };

  const share = () => Share.share({ message: `${b?.title ?? 'ZillyBuy blog'} — ${WEBSITE_URL}/blogs/${slug}` });

  if (blog.error) {
    return (
      <Screen>
        <Header title="Blog" />
        <ErrorState message={blog.error} onRetry={blog.reload} />
      </Screen>
    );
  }

  const image = blogAsset(b?.featured_image);
  const photo = authorPhoto(b?.author_profile_photo);
  const updated = b?.updated_at && b.published_at && b.updated_at.slice(0, 10) > b.published_at.slice(0, 10);

  return (
    <Screen>
      <Header title="Blog" right={b ? <IconButton icon="share-social-outline" label="Share" onPress={share} /> : undefined} />
      {!b ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={200} r={radius.lg} />
          <Skeleton height={28} />
          <Skeleton width="60%" height={16} />
          <Skeleton height={300} r={radius.lg} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          {image ? (
            <View style={styles.hero}>
              <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={b.featured_image_alt ?? undefined} />
            </View>
          ) : null}

          <View style={{ padding: 16, gap: 10 }}>
            {!!b.category_name && (
              <Text variant="tiny" tone="primary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {b.category_name}
              </Text>
            )}
            <Text variant="title">{b.title}</Text>
            {!!b.short_description && <Text tone="muted">{b.short_description}</Text>}

            <View style={styles.metaRow}>
              {!!b.author_name && (
                <Pressable
                  disabled={!b.author_slug}
                  onPress={() => (tap(), router.push({ pathname: '/blog-author/[slug]', params: { slug: b.author_slug! } }))}
                  style={[styles.author, { backgroundColor: t.hairline }]}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text variant="tiny" tone="onPrimary">
                        {b.author_name.slice(0, 1)}
                      </Text>
                    </View>
                  )}
                  <Text variant="caption">By {b.author_name}</Text>
                </Pressable>
              )}
              <Text variant="caption" tone="faint">
                {blogDate(b)}
                {updated ? ` · Updated ${blogDate({ published_at: b.updated_at, created_at: b.created_at })}` : ''}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: t.hairline }]} />

            <View style={{ height: height || 400 }}>
              <WebView
                originWhitelist={['*']}
                source={{ html, baseUrl: WEBSITE_URL }}
                onMessage={onMessage}
                scrollEnabled={false}
                nestedScrollEnabled={false}
                showsVerticalScrollIndicator={false}
                style={{ backgroundColor: 'transparent' }}
                containerStyle={{ backgroundColor: 'transparent' }}
                startInLoadingState
                renderLoading={() => <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />}
                // Links open the matching app screen (products, brands, other
                // posts) or the in-app browser; the WebView never navigates.
                onShouldStartLoadWithRequest={(req) => {
                  if (isOwnLoad(req.url) || req.isTopFrame === false) return true;
                  if (/^https?:/i.test(req.url)) openSiteLink(req.url);
                  return false;
                }}
              />
            </View>
          </View>

          {!!latest.data?.length && (
            <View style={{ marginTop: 8 }}>
              <SectionTitle title="More from ZillyBuy" action="All posts" onAction={() => router.push('/blogs')} />
              <View style={{ paddingHorizontal: 16, gap: 10 }}>
                {latest.data.map((p) => (
                  <BlogCard key={p.id} post={p} compact />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { aspectRatio: 16 / 9, backgroundColor: '#E8EEF8' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12, paddingLeft: 3, paddingVertical: 3, borderRadius: 999 },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
