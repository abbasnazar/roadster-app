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

type Vehicle = { name: string; sub: string; progress: number; image: string };
const GARAGE: Vehicle[] = [
  {
    name: '1967 Mustang',
    sub: 'Restoration Progress',
    progress: 0.75,
    image: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=320&q=70',
  },
  {
    name: '1984 Yamaha RX100',
    sub: 'Restoration Progress',
    progress: 0.4,
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=320&q=70',
  },
];

type Post = { author: string; ago: string; text: string; likes: number; comments: number; image: string };
const COMMUNITY: Post[] = [
  {
    author: 'John D.',
    ago: '2h ago',
    text: 'John restored his 1972 Beetle',
    likes: 120,
    comments: 18,
    image: 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?auto=format&fit=crop&w=480&q=70',
  },
  {
    author: 'Maria S.',
    ago: '5h ago',
    text: 'Sunday drive in the Alfa Romeo',
    likes: 86,
    comments: 9,
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=480&q=70',
  },
];

type EventItem = { title: string; date: string; place: string; image: string };
const EVENTS: EventItem[] = [
  {
    title: 'Vintage Rally Delhi',
    date: '15 June 2026',
    place: 'New Delhi, India',
    image: 'https://images.unsplash.com/photo-1469443236989-b8b38c78d6cf?auto=format&fit=crop&w=640&q=70',
  },
];

type Listing = { name: string; price: string; image: string };
const MARKET: Listing[] = [
  {
    name: 'Original Carburetor',
    price: '$350',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=320&q=70',
  },
  {
    name: 'Wooden Steering Wheel',
    price: '$120',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=320&q=70',
  },
  {
    name: 'Vintage Smiths Gauge Set',
    price: '$180',
    image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=320&q=70',
  },
  {
    name: 'Wire Wheel 15 inch',
    price: '$450',
    image: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=320&q=70',
  },
];

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

  const checkHealth = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await http.get(API_ENDPOINTS.HEALTH);
      setHealthy(Boolean(data?.ok));
    } catch {
      setHealthy(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const firstName = useMemo(
    () => (user?.name ?? user?.email ?? 'Collector').toString().split(/[\s@]/)[0],
    [user],
  );

  const goProducts = useCallback(() => navigation.navigate('Products'), [navigation]);
  const goAccount = useCallback(
    () => navigation.navigate(token ? 'Profile' : 'SignIn'),
    [navigation, token],
  );

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
        <Pressable hitSlop={8} onPress={checkHealth} style={styles.headerIconBtn}>
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
          <RefreshControl refreshing={loading} onRefresh={checkHealth} tintColor={homePremium.gold} />
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
          <SectionHeader title="MY GARAGE" action="View All" onAction={goAccount} />
          <View style={styles.garageRow}>
            {GARAGE.map((v) => (
              <Pressable key={v.name} onPress={goAccount} style={styles.garageCard}>
                <Image source={{ uri: v.image }} style={styles.garageImg} />
                <View style={styles.garageBody}>
                  <Text style={styles.garageName} numberOfLines={1}>{v.name}</Text>
                  <Text style={styles.garageSub}>{v.sub}</Text>
                  <Text style={styles.garagePct}>{Math.round(v.progress * 100)}%</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${v.progress * 100}%` }]} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Latest from Community */}
        <View style={styles.section}>
          <SectionHeader title="LATEST FROM COMMUNITY" action="See All" onAction={goProducts} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
            {COMMUNITY.map((p) => (
              <View key={p.author} style={styles.postCard}>
                <Image source={{ uri: p.image }} style={styles.postImg} />
                <View style={styles.postBody}>
                  <View style={styles.postAuthorRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{p.author[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postAuthor}>{p.author}</Text>
                      <Text style={styles.postAgo}>{p.ago}</Text>
                    </View>
                    <Text style={styles.bookmark}>🔖</Text>
                  </View>
                  <Text style={styles.postText} numberOfLines={2}>{p.text}</Text>
                  <View style={styles.postMeta}>
                    <Text style={styles.metaLike}>❤ {p.likes}</Text>
                    <Text style={styles.metaComment}>💬 {p.comments}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <SectionHeader title="UPCOMING EVENTS" action="See All" onAction={goProducts} />
          {EVENTS.map((e) => (
            <View key={e.title} style={styles.eventCard}>
              <Image source={{ uri: e.image }} style={styles.eventImg} />
              <View style={styles.eventBody}>
                <Text style={styles.eventTitle}>{e.title}</Text>
                <Text style={styles.eventMeta}>🗓  {e.date}</Text>
                <Text style={styles.eventMeta}>📍  {e.place}</Text>
                <Pressable onPress={goAccount} style={({ pressed }) => [styles.rsvpBtn, pressed && styles.pressed]}>
                  <Text style={styles.rsvpText}>RSVP</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* Marketplace Highlights */}
        <View style={styles.section}>
          <SectionHeader title="MARKETPLACE HIGHLIGHTS" action="See All" onAction={goProducts} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
            {MARKET.map((m) => (
              <Pressable key={m.name} onPress={goProducts} style={styles.listingCard}>
                <Image source={{ uri: m.image }} style={styles.listingImg} />
                <Text style={styles.listingName} numberOfLines={2}>{m.name}</Text>
                <View style={styles.listingFoot}>
                  <Text style={styles.listingPrice}>{m.price}</Text>
                  <Text style={styles.heartOutline}>♡</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
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
  garagePct: { color: homePremium.gold, fontSize: 13, fontWeight: '800', marginTop: 4 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(63,63,70,0.8)',
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: homePremium.gold },

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
  bookmark: { fontSize: 14 },
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
  eventImg: { width: '100%', height: 150, backgroundColor: '#222' },
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
