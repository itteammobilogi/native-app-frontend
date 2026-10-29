import { useSaved } from '@/core/saved/SavedContext';
import { ProductGrid } from '@/ui/ProductGrid';
import { Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

// Products saved with the heart button (stored on this device).
export default function WishlistScreen() {
  const { wishlist } = useSaved();
  return (
    <Screen tabBar="account">
      <Header title="My wishlist" />
      <ProductGrid
        items={wishlist}
        loading={false}
        emptyTitle="Your wishlist is empty"
        emptyMessage="Tap the ♡ on any product to save it here for later."
        header={
          wishlist.length ? (
            <Text variant="caption" tone="muted" style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              {wishlist.length} saved · prices shown as when you saved them, open a product for the latest.
            </Text>
          ) : null
        }
      />
    </Screen>
  );
}
