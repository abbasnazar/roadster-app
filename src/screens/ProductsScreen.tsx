import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/colors';
import { homePremium } from '../theme/homePremium';
import { http } from '../lib/http';
import { API_ENDPOINTS } from '../config/api';

type Product = {
  id: number;
  name: string;
  price?: number | string | null;
  image?: string | null;
  description?: string | null;
  category_name?: string | null;
  stock?: number | null;
  approval_status?: string | null;
  status?: string | null;
};

function formatPrice(price: Product['price']): string {
  if (price == null) return 'Price on request';
  const num = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(num)) return String(price);
  return `Rs. ${num.toLocaleString('en-IN')}`;
}

export default function ProductsScreen() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await http.get<unknown>(API_ENDPOINTS.PRODUCTS);
      const list = Array.isArray(data)
        ? (data as Product[])
        : Array.isArray((data as { products?: Product[] })?.products)
          ? ((data as { products: Product[] }).products)
          : [];
      setItems(list);
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? err.message ?? 'Could not load products.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right']}>
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>Loading products…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.muted}>{error ?? 'No products available right now.'}</Text>
              <Pressable onPress={load} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={[styles.image, styles.imageFallback]}>
                  <Text style={styles.imageFallbackText}>No image</Text>
                </View>
              )}
              <View style={styles.body}>
                {item.category_name ? <Text style={styles.category}>{item.category_name}</Text> : null}
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.price}>{formatPrice(item.price)}</Text>
                {!!item.description && (
                  <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
                )}
                <View style={styles.metaRow}>
                  {typeof item.stock === 'number' ? (
                    <Text style={[styles.metaPill, item.stock <= 0 && styles.metaPillDanger]}>
                      {item.stock > 0 ? `In stock: ${item.stock}` : 'Out of stock'}
                    </Text>
                  ) : null}
                  {item.approval_status && item.approval_status !== 'approved' ? (
                    <Text style={[styles.metaPill, styles.metaPillWarn]}>{item.approval_status}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: homePremium.charcoal },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  listContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    backgroundColor: 'rgba(20,20,22,0.92)',
    borderWidth: 1,
    borderColor: homePremium.borderZinc,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 180, backgroundColor: homePremium.panel },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  imageFallbackText: { color: homePremium.zinc400, fontSize: 12 },
  body: { padding: spacing.md, gap: 4 },
  category: {
    color: homePremium.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  name: { color: homePremium.zinc100, fontSize: 16, fontWeight: '600', marginTop: 2 },
  price: { marginTop: 4, color: homePremium.gold, fontWeight: '700', fontSize: 15 },
  description: { marginTop: 6, color: homePremium.zinc300, lineHeight: 18, fontSize: 13 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaPill: {
    color: homePremium.zinc300,
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: homePremium.tagPillBorder,
    backgroundColor: homePremium.tagPillBg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  metaPillDanger: { color: '#fca5a5', borderColor: 'rgba(220, 38, 38, 0.55)' },
  metaPillWarn: { color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.55)' },
  emptyBox: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  muted: { color: homePremium.zinc400, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.6)',
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 4,
  },
  retryText: {
    color: homePremium.ctaOutlineText,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
