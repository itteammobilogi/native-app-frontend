import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';

import { deleteAddress, listAddresses, setDefaultAddress, type Address } from '@/core/api/address';
import { errorMessage } from '@/core/api/client';
import { useAuth } from '@/core/auth/AuthContext';
import { useAsync } from '@/core/hooks/useAsync';
import { AddressCard } from '@/ui/AddressCard';
import { Button } from '@/ui/Button';
import { usePageInsets } from '@/ui/GlassTabBar';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

export default function AddressesScreen() {
  const t = usePalette();
  const insets = usePageInsets();
  const toast = useToast();
  const { user } = useAuth();
  const list = useAsync(() => (user ? listAddresses(user.id) : Promise.resolve([] as Address[])), [user?.id]);

  // Come back from the form → show the new/edited address.
  useFocusEffect(
    useCallback(() => {
      if (!list.loading) list.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const makeDefault = async (a: Address) => {
    try {
      await setDefaultAddress(a.id);
      list.refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const remove = (a: Address) =>
    Alert.alert('Delete address?', `${a.name}, ${a.city}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAddress(a.id);
            list.setData((prev) => prev?.filter((x) => x.id !== a.id));
            toast('Address deleted', 'success');
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        },
      },
    ]);

  return (
    <Screen tabBar="account">
      <Header title="Saved addresses" />
      {list.loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1].map((i) => (
            <Skeleton key={i} height={120} r={radius.lg} />
          ))}
        </View>
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState
          icon="location-outline"
          title="No saved addresses"
          message="Add an address to speed up checkout."
          action="Add address"
          onAction={() => router.push('/address-form')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={t.primary} />}>
          {list.data.map((a) => (
            <AddressCard
              key={a.id}
              address={a}
              actions={
                <>
                  <Text variant="label" tone="primary" onPress={() => router.push({ pathname: '/address-form', params: { id: String(a.id) } })}>
                    Edit
                  </Text>
                  {Number(a.is_default) !== 1 && (
                    <Text variant="label" tone="primary" onPress={() => makeDefault(a)}>
                      Set as default
                    </Text>
                  )}
                  <Text variant="label" tone="danger" onPress={() => remove(a)}>
                    Delete
                  </Text>
                </>
              }
            />
          ))}
        </ScrollView>
      )}
      {!!list.data?.length && (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16 }}>
          <Button title="Add new address" icon="add" onPress={() => router.push('/address-form')} />
        </View>
      )}
    </Screen>
  );
}
