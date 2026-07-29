import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { spacing } from '../theme/colors';
import { homePremium } from '../theme/homePremium';
import { http } from '../lib/http';
import { API_ENDPOINTS } from '../config/api';
import { HOME_HERO_IMAGE_URI } from '../config/homeHero';
import { useSession } from '../lib/session';
import { BottomTabBar } from '../components/BottomTabBar';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

const heroTitleFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const VEHICLE_FALLBACK =
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=320&q=70';

/** Shape returned by GET /api/garage/me (see GarageScreen). */
type GarageRow = {
  id: number;
  nickname: string | null;
  custom_year: number | null;
  custom_make: string | null;
  custom_model: string | null;
  photo_url: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  year_from?: number | null;
};

type Media = { media_url: string; media_type: 'image' | 'video' };

/** Shape returned by GET /api/social/feed (see CommunityScreen). */
type FeedPost = {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  media: Media[];
};

/** Shape returned by GET /api/events → { events: [...] }. */
type EventItem = {
  id: number;
  title: string;
  starts_at: string;
  location_name: string | null;
  city: string | null;
  country: string | null;
};

/** Subset of GET /api/products used for the highlights strip. */
type Product = {
  id: number;
  name: string;
  price?: number | string | null;
  image?: string | null;
};

function vehicleName(v: GarageRow): string {
  if (v.nickname) return v.nickname;
  const parts = [
    v.custom_year ?? v.year_from,
    v.custom_make ?? v.vehicle_make,
    v.custom_model ?? v.vehicle_model,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Untitled vehicle';
}

function vehicleSub(v: GarageRow): string {
  const parts = [
    v.custom_year ?? v.year_from,
    v.custom_make ?? v.vehicle_make,
    v.custom_model ?? v.vehicle_model,
  ]
    .filter(Boolean)
    .join(' ');
  return v.nickname && parts ? parts : 'In your garage';
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const s = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

function formatPrice(price: Product['price']): string {
  if (price == null) return 'Price on request';
  const num = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(num)) return String(price);
  return `Rs. ${num.toLocaleString('en-IN')}`;
}

function eventDate(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : '';
}

function eventPlace(e: EventItem): string {
  return [e.location_name, e.city, e.country].filter(Boolean).join(', ') || 'Location TBA';
}

function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionLink}>{action} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { token, user } = useSession();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<GarageRow[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [listings, setListings] = useState<Product[]>([]);

  const checkHealth = useCallback(async () => {
    try {
      const { data } = await http.get(API_ENDPOINTS.HEALTH);
      setHealthy(Boolean(data?.ok));
    } catch {
      setHealthy(false);
    }
  }, []);

  const loadGarage = useCallback(async () => {
    if (!token) {
      setVehicles([]);
      return;
    }
    try {
      const { data } = await http.get<GarageRow[]>(API_ENDPOINTS.GARAGE_ME);
      setVehicles(Array.isArray(data) ? data : []);
    } catch {
      setVehicles([]);
    }
  }, [token]);

  const loadFeed = useCallback(async () => {
    if (!token) {
      setPosts([]);
      return;
    }
    try {
      const { data } = await http.get<FeedPost[]>(API_ENDPOINTS.SOCIAL_FEED, {
        params: { filter: 'all', limit: 5 },
      });
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
    }
  }, [token]);

  const loadPublic = useCallback(async () => {
    const [e, p] = await Promise.allSettled([
      http.get<{ events: EventItem[] }>(API_ENDPOINTS.EVENTS, { params: { limit: 3 } }),
      http.get<unknown>(API_ENDPOINTS.PRODUCTS),
    ]);
    if (e.status === 'fulfilled') setEvents(e.value.data?.events ?? []);
    if (p.status === 'fulfilled') {
      const raw = p.value.data;
      const list = Array.isArray(raw)
        ? (raw as Product[])
        : ((raw as { products?: Product[] })?.products ?? []);
      setListings(list);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([checkHealth(), loadGarage(), loadFeed(), loadPublic()]);
    setLoading(false);
  }, [checkHealth, loadGarage, loadFeed, loadPublic]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const firstName = useMemo(
    () => (user?.name ?? user?.email ?? 'Collector').toString().split(/[\s@]/)[0],
    [user],
  );

  const goProducts = useCallback(() => navigation.navigate('Products'), [navigation]);
  const goGarage = useCallback(() => navigation.navigate('Garage'), [navigation]);
  const goCommunity = useCallback(() => navigation.navigate('Community'), [navigation]);
  const goAccount = useCallback(
    () => navigation.navigate(token ? 'Profile' : 'SignIn'),
    [navigation, token],
  );
  const goSignIn = useCallback(() => navigation.navigate('SignIn'), [navigation]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={goAccount} style={styles.headerIconBtn}>
          <Text style={styles.headerIcon}>☰</Text>
        </Pressable>
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>ROADSTER</Text>
          <Text style={styles.brandSub}>— RELICS & AUTO —</Text>
        </View>
        <Pressable hitSlop={8} onPress={refresh} style={styles.headerIconBtn}>
          <Text style={styles.headerIcon}>🔔</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={homePremium.gold} />
        }
      >
        {/* Hero */}
        <ImageBackground
          source={{ uri: HOME_HERO_IMAGE_URI }}
          style={styles.heroBg}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroOverlay} pointerEvents="none" />
          <View style={styles.heroContent}>
            <View style={styles.connRow}>
              <View style={[styles.dot, healthy === false ? styles.dotBad : styles.dotOk]} />
              <Text style={styles.greeting}>
                {greetingForNow()}, {firstName} <Text style={styles.wave}>👋</Text>
              </Text>
            </View>
            <Text style={styles.heroTitle}>
              Preserve Your{'\n'}
              <Text style={styles.heroTitleAccent}>Automotive Legacy</Text>
            </Text>
            <View style={styles.ctaRow}>
              <Pressable
                onPress={goAccount}
                style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}
              >
                <Text style={styles.ctaPrimaryText}>＋ Add Vehicle</Text>
              </Pressable>
              <Pressable
                onPress={goProducts}
                style={({ pressed }) => [styles.ctaOutline, pressed && styles.pressed]}
              >
                <Text style={styles.ctaOutlineText}>🗓  Explore Marketplace</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>

        {/* My Garage */}
        <View style={styles.card}>
          <SectionHeader title="MY GARAGE" action="View All" onAction={goGarage} />
          {!token ? (
            <Pressable onPress={goSignIn}>
              <Text style={styles.emptyText}>Sign in to see the vehicles in your garage.</Text>
            </Pressable>
          ) : vehicles.length === 0 ? (
            <Pressable onPress={goGarage}>
              <Text style={styles.emptyText}>No vehicles yet — add your first build.</Text>
            </Pressable>
          ) : (
            <View style={styles.garageRow}>
              {vehicles.slice(0, 2).map((v) => (
                <Pressable key={v.id} onPress={goGarage} style={styles.garageCard}>
                  <Image source={{ uri: v.photo_url ?? VEHICLE_FALLBACK }} style={styles.garageImg} />
                  <View style={styles.garageBody}>
                    <Text style={styles.garageName} numberOfLines={1}>{vehicleName(v)}</Text>
                    <Text style={styles.garageSub} numberOfLines={1}>{vehicleSub(v)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Latest from Community */}
        <View style={styles.section}>
          <SectionHeader title="LATEST FROM COMMUNITY" action="See All" onAction={goCommunity} />
          {!token ? (
            <Pressable onPress={goSignIn}>
              <Text style={styles.emptyText}>Sign in to see the community feed.</Text>
            </Pressable>
          ) : posts.length === 0 ? (
            <Text style={styles.emptyText}>No posts yet — be the first to share a build.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {posts.map((p) => {
                const image = p.media?.find((m) => m.media_type === 'image')?.media_url;
                return (
                  <Pressable key={p.id} onPress={goCommunity} style={styles.postCard}>
                    {image ? <Image source={{ uri: image }} style={styles.postImg} /> : null}
                    <View style={styles.postBody}>
                      <View style={styles.postAuthorRow}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {(p.author_name || '?').trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.postAuthor} numberOfLines={1}>{p.author_name}</Text>
                          <Text style={styles.postAgo}>{timeAgo(p.created_at)}</Text>
                        </View>
                      </View>
                      <Text style={styles.postText} numberOfLines={2}>{p.content}</Text>
                      <View style={styles.postMeta}>
                        <Text style={styles.metaLike}>❤ {p.like_count}</Text>
                        <Text style={styles.metaComment}>💬 {p.comment_count}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <SectionHeader title="UPCOMING EVENTS" action="See All" onAction={goCommunity} />
          {events.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming events right now.</Text>
          ) : (
            events.map((e) => (
              <View key={e.id} style={styles.eventCard}>
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{e.title}</Text>
                  <Text style={styles.eventMeta}>🗓  {eventDate(e.starts_at)}</Text>
                  <Text style={styles.eventMeta}>📍  {eventPlace(e)}</Text>
                  <Pressable onPress={goCommunity} style={({ pressed }) => [styles.rsvpBtn, pressed && styles.pressed]}>
                    <Text style={styles.rsvpText}>RSVP</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Marketplace Highlights */}
        <View style={styles.section}>
          <SectionHeader title="MARKETPLACE HIGHLIGHTS" action="See All" onAction={goProducts} />
          {listings.length === 0 ? (
            <Text style={styles.emptyText}>No listings available right now.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {listings.slice(0, 6).map((m) => (
                <Pressable key={m.id} onPress={goProducts} style={styles.listingCard}>
                  <Image source={{ uri: m.image ?? VEHICLE_FALLBACK }} style={styles.listingImg} />
                  <Text style={styles.listingName} numberOfLines={2}>{m.name}</Text>
                  <View style={styles.listingFoot}>
                    <Text style={styles.listingPrice}>{formatPrice(m.price)}</Text>
                    <Text style={styles.heartOutline}>♡</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Bottom tab bar */}
      <BottomTabBar active="Home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: homePremium.charcoal },
  pressed: { opacity: 0.85 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 20, color: homePremium.zinc100 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: homePremium.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: homePremium.charcoal, fontSize: 10, fontWeight: '800' },
  brand: { alignItems: 'center' },
  brandTitle: {
    color: homePremium.gold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: heroTitleFont,
  },
  brandSub: { color: homePremium.gold, fontSize: 9, letterSpacing: 3, marginTop: 2 },

  /* Hero */
  heroBg: { width: '100%', minHeight: 280, marginBottom: 4 },
  heroImage: { resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,12,14,0.55)' },
  heroContent: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOk: { backgroundColor: '#4ade80' },
  dotBad: { backgroundColor: '#f87171' },
  greeting: { color: homePremium.zinc100, fontSize: 16, fontWeight: '600' },
  wave: { fontSize: 16 },
  heroTitle: {
    marginTop: spacing.md,
    color: homePremium.zinc100,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700',
    fontFamily: heroTitleFont,
  },
  heroTitleAccent: { color: homePremium.gold, fontFamily: heroTitleFont },
  ctaRow: { marginTop: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ctaPrimary: {
    backgroundColor: homePremium.ctaGoldFillTop,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  ctaPrimaryText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 15 },
  ctaOutline: {
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.7)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  ctaOutlineText: { color: homePremium.zinc100, fontWeight: '600', fontSize: 14 },

  /* Sections */
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homePremium.borderZinc,
    backgroundColor: homePremium.panel,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { color: homePremium.zinc100, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  sectionLink: { color: homePremium.gold, fontSize: 13, fontWeight: '600' },
  emptyText: { color: homePremium.zinc400, fontSize: 13, paddingVertical: 8 },

  /* Garage */
  garageRow: { flexDirection: 'row', gap: 12 },
  garageCard: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: homePremium.borderZinc,
    backgroundColor: 'rgba(24,24,27,0.6)',
  },
  garageImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#222' },
  garageBody: { flex: 1, justifyContent: 'center' },
  garageName: { color: homePremium.zinc100, fontSize: 13, fontWeight: '700' },
  garageSub: { color: homePremium.zinc400, fontSize: 10, marginTop: 2 },

  /* Horizontal lists */
  hList: { gap: 12, paddingRight: spacing.md },

  /* Community */
  postCard: {
    width: 280,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: homePremium.borderZinc,
    backgroundColor: homePremium.panel,
  },
  postImg: { width: '100%', height: 120, backgroundColor: '#222' },
  postBody: { padding: 12, gap: 8 },
  postAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: homePremium.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 14 },
  postAuthor: { color: homePremium.zinc100, fontSize: 13, fontWeight: '700' },
  postAgo: { color: homePremium.zinc400, fontSize: 10 },
  postText: { color: homePremium.zinc100, fontSize: 14, fontWeight: '600' },
  postMeta: { flexDirection: 'row', gap: 16 },
  metaLike: { color: '#f87171', fontSize: 12 },
  metaComment: { color: homePremium.zinc400, fontSize: 12 },

  /* Events */
  eventCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: homePremium.borderZinc,
    backgroundColor: homePremium.panel,
  },
  eventBody: { padding: spacing.md, gap: 6 },
  eventTitle: { color: homePremium.zinc100, fontSize: 18, fontWeight: '700', fontFamily: heroTitleFont },
  eventMeta: { color: homePremium.zinc300, fontSize: 13 },
  rsvpBtn: {
    marginTop: 8,
    backgroundColor: homePremium.ctaGoldFillTop,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  rsvpText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 14, letterSpacing: 1 },

  /* Marketplace */
  listingCard: { width: 140 },
  listingImg: { width: 140, height: 110, borderRadius: 12, backgroundColor: '#222' },
  listingName: { color: homePremium.zinc100, fontSize: 12, fontWeight: '600', marginTop: 6, minHeight: 32 },
  listingFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  listingPrice: { color: homePremium.gold, fontSize: 14, fontWeight: '800' },
  heartOutline: { color: homePremium.zinc400, fontSize: 16 },
});
