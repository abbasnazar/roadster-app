import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

type Props = NativeStackScreenProps<AppStackParamList, 'Garage'>;

const heroTitleFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const VEHICLE_FALLBACK =
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=480&q=70';

/** Shape returned by GET /api/garage/me (see server fetchGarageRows). */
type GarageRow = {
  id: number;
  nickname: string | null;
  custom_year: number | null;
  custom_make: string | null;
  custom_model: string | null;
  photo_url: string | null;
  notes: string | null;
  is_primary: 0 | 1;
  updated_at?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  year_from?: number | null;
};

function displayName(v: GarageRow): string {
  if (v.nickname) return v.nickname;
  const parts = [
    v.custom_year ?? v.year_from,
    v.custom_make ?? v.vehicle_make,
    v.custom_model ?? v.vehicle_model,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Untitled vehicle';
}

function StatCell({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function GarageScreen({ navigation }: Props) {
  const { token, user } = useSession();
  const [vehicles, setVehicles] = useState<GarageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add-vehicle modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  const loadGarage = useCallback(async () => {
    if (!token) {
      setVehicles([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await http.get<GarageRow[]>(API_ENDPOINTS.GARAGE_ME);
      setVehicles(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? 'Failed to load your garage');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadGarage();
  }, [loadGarage]);

  const submitVehicle = async () => {
    if (!make.trim() || !model.trim()) {
      Alert.alert('Missing fields', 'Enter at least make and model.');
      return;
    }
    setSaving(true);
    try {
      await http.post(API_ENDPOINTS.GARAGE, {
        custom_make: make.trim(),
        custom_model: model.trim(),
        custom_year: year.trim() || undefined,
        nickname: nickname.trim() || undefined,
      });
      setMake(''); setModel(''); setYear(''); setNickname('');
      setModalOpen(false);
      await loadGarage();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      Alert.alert('Could not add vehicle', err.response?.data?.error ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteVehicle = (v: GarageRow) => {
    const remove = async () => {
      try {
        await http.delete(`${API_ENDPOINTS.GARAGE}/${v.id}`);
        await loadGarage();
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        Alert.alert('Delete failed', err.response?.data?.error ?? 'Please try again.');
      }
    };
    if (Platform.OS === 'web') { void remove(); return; }
    Alert.alert('Remove vehicle', `Remove "${displayName(v)}" from your garage?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void remove() },
    ]);
  };

  const signedOut = !token;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={() => navigation.navigate('Home')} style={styles.headerIconBtn}>
          <Text style={styles.headerIcon}>☰</Text>
        </Pressable>
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>ROADSTER</Text>
          <Text style={styles.brandSub}>— RELICS & AUTO —</Text>
        </View>
        <Pressable hitSlop={8} onPress={() => navigation.navigate(token ? 'Profile' : 'SignIn')} style={styles.headerIconBtn}>
          <Text style={styles.headerIcon}>👤</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadGarage} tintColor={homePremium.gold} />}
      >
        {/* Hero */}
        <ImageBackground source={{ uri: HOME_HERO_IMAGE_URI }} style={styles.heroBg} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay} pointerEvents="none" />
          <View style={styles.heroContent}>
            <Text style={styles.kicker}>🔧 YOUR GARAGE</Text>
            <Text style={styles.heroTitle}>Build Your{'\n'}Automotive Garage</Text>
            <Text style={styles.heroLead}>Create a personal collection of the vehicles that define your journey.</Text>
            <Text style={styles.heroBody}>
              Add vehicles you currently own, restoration projects, dream machines you've chased, and everything
              in between. Showcase photos, specs, modifications, build progress, and the stories behind every ride.
            </Text>
            <Text style={styles.heroAccent}>
              Your Garage becomes your automotive identity within the Roadster Relics community.
            </Text>

            <Pressable onPress={() => (signedOut ? navigation.navigate('SignIn') : setModalOpen(true))} style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}>
              <Text style={styles.ctaPrimaryText}>＋  Add Vehicle</Text>
            </Pressable>
            <Pressable onPress={() => (signedOut ? navigation.navigate('SignIn') : setModalOpen(true))} style={({ pressed }) => [styles.ctaOutline, pressed && styles.pressed]}>
              <Text style={styles.ctaOutlineText}>⬆  Import Vehicle</Text>
            </Pressable>

            {/* Stats — Vehicles count is live; others are showcase figures */}
            <View style={styles.statsRow}>
              <StatCell icon="🚗" value={vehicles.length} label="Vehicles" />
              <StatCell icon="🔧" value={vehicles.filter((v) => (v.notes ?? '').toLowerCase().includes('restor')).length || 3} label="Projects" />
              <StatCell icon="📖" value={24} label="Stories" />
              <StatCell icon="👥" value={120} label="Followers" />
              <StatCell icon="❤" value={890} label="Likes" />
              <StatCell icon="📄" value={56} label="Documents" />
            </View>
          </View>
        </ImageBackground>

        {/* My Vehicles */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>MY VEHICLES</Text>
            <Pressable hitSlop={8}><Text style={styles.sectionLink}>View All →</Text></Pressable>
          </View>

          {signedOut ? (
            <Pressable onPress={() => navigation.navigate('SignIn')} style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sign in to build your garage</Text>
              <Text style={styles.emptyText}>Your vehicles, projects, and timeline live in your account.</Text>
              <View style={styles.emptyCta}><Text style={styles.emptyCtaText}>Sign In</Text></View>
            </Pressable>
          ) : loading && vehicles.length === 0 ? (
            <ActivityIndicator color={homePremium.gold} style={{ marginVertical: spacing.lg }} />
          ) : error ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Couldn't load garage</Text>
              <Text style={styles.emptyText}>{error}</Text>
              <Pressable onPress={loadGarage} style={styles.emptyCta}><Text style={styles.emptyCtaText}>Retry</Text></Pressable>
            </View>
          ) : vehicles.length === 0 ? (
            <Pressable onPress={() => setModalOpen(true)} style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No vehicles yet</Text>
              <Text style={styles.emptyText}>Tap “Add Vehicle” to start your collection.</Text>
              <View style={styles.emptyCta}><Text style={styles.emptyCtaText}>＋ Add Vehicle</Text></View>
            </Pressable>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {vehicles.map((v) => (
                <View key={v.id} style={styles.vehicleCard}>
                  <View style={styles.vehicleImgWrap}>
                    <Image source={{ uri: v.photo_url || VEHICLE_FALLBACK }} style={styles.vehicleImg} />
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{v.is_primary ? 'Primary' : 'Owned'}</Text>
                    </View>
                    <Pressable onPress={() => deleteVehicle(v)} hitSlop={8} style={styles.kebab}>
                      <Text style={styles.kebabText}>⋮</Text>
                    </Pressable>
                  </View>
                  <View style={styles.vehicleBody}>
                    <Text style={styles.vehicleName} numberOfLines={1}>{displayName(v)}</Text>
                    <Text style={styles.vehicleNote} numberOfLines={1}>{v.notes || 'In your garage'}</Text>
                    <Pressable onPress={() => navigation.navigate(token ? 'Profile' : 'SignIn')} style={({ pressed }) => [styles.detailsBtn, pressed && styles.pressed]}>
                      <Text style={styles.detailsText}>View Details</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Add Vehicle modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Vehicle</Text>
            <Text style={styles.fieldLabel}>Make *</Text>
            <TextInput value={make} onChangeText={setMake} placeholder="e.g. Ford" placeholderTextColor={homePremium.zinc400} style={styles.input} />
            <Text style={styles.fieldLabel}>Model *</Text>
            <TextInput value={model} onChangeText={setModel} placeholder="e.g. Mustang" placeholderTextColor={homePremium.zinc400} style={styles.input} />
            <Text style={styles.fieldLabel}>Year</Text>
            <TextInput value={year} onChangeText={setYear} placeholder="e.g. 1967" placeholderTextColor={homePremium.zinc400} style={styles.input} keyboardType="number-pad" maxLength={4} />
            <Text style={styles.fieldLabel}>Nickname</Text>
            <TextInput value={nickname} onChangeText={setNickname} placeholder="Optional" placeholderTextColor={homePremium.zinc400} style={styles.input} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModalOpen(false)} style={[styles.modalBtn, styles.modalCancel]}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitVehicle} disabled={saving} style={[styles.modalBtn, styles.modalSave, saving && styles.pressed]}>
                {saving ? <ActivityIndicator color={homePremium.charcoal} /> : <Text style={styles.modalSaveText}>Add</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BottomTabBar active="Garage" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: homePremium.charcoal },
  pressed: { opacity: 0.85 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 20, color: homePremium.zinc100 },
  brand: { alignItems: 'center' },
  brandTitle: { color: homePremium.gold, fontSize: 20, fontWeight: '800', letterSpacing: 4, fontFamily: heroTitleFont },
  brandSub: { color: homePremium.gold, fontSize: 9, letterSpacing: 3, marginTop: 2 },

  heroBg: { width: '100%' },
  heroImage: { resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,12,14,0.62)' },
  heroContent: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  kicker: { color: homePremium.gold, fontSize: 12, fontWeight: '700', letterSpacing: 3 },
  heroTitle: { marginTop: spacing.sm, color: homePremium.zinc100, fontSize: 36, lineHeight: 42, fontWeight: '700', fontFamily: heroTitleFont },
  heroLead: { marginTop: spacing.md, color: homePremium.zinc100, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  heroBody: { marginTop: spacing.sm, color: homePremium.zinc300, fontSize: 13, lineHeight: 20 },
  heroAccent: { marginTop: spacing.md, color: homePremium.gold, fontSize: 13, lineHeight: 20, fontWeight: '600' },

  ctaPrimary: { marginTop: spacing.lg, backgroundColor: homePremium.ctaGoldFillTop, paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
  ctaPrimaryText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 15 },
  ctaOutline: { marginTop: 12, borderWidth: 1, borderColor: 'rgba(201,162,39,0.7)', paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
  ctaOutlineText: { color: homePremium.zinc100, fontWeight: '600', fontSize: 15 },

  statsRow: { marginTop: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: {
    width: '31%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: homePremium.borderZinc,
    backgroundColor: 'rgba(20,20,22,0.7)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statIcon: { fontSize: 16, color: homePremium.gold },
  statValue: { color: homePremium.zinc100, fontSize: 16, fontWeight: '800' },
  statLabel: { color: homePremium.zinc400, fontSize: 10 },

  section: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { color: homePremium.zinc100, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  sectionLink: { color: homePremium.gold, fontSize: 13, fontWeight: '600' },

  hList: { gap: 12, paddingRight: spacing.md },
  vehicleCard: {
    width: 230,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: homePremium.borderZinc,
    backgroundColor: homePremium.panel,
  },
  vehicleImgWrap: { width: '100%', height: 140, backgroundColor: '#222' },
  vehicleImg: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(12,12,14,0.85)', borderWidth: 1, borderColor: homePremium.borderGold, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: homePremium.gold, fontSize: 10, fontWeight: '700' },
  kebab: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12,12,14,0.6)', borderRadius: 14 },
  kebabText: { color: homePremium.zinc100, fontSize: 18, fontWeight: '800' },
  vehicleBody: { padding: 12, gap: 6 },
  vehicleName: { color: homePremium.zinc100, fontSize: 15, fontWeight: '700' },
  vehicleNote: { color: homePremium.zinc400, fontSize: 12 },
  detailsBtn: { marginTop: 4, borderWidth: 1, borderColor: 'rgba(201,162,39,0.7)', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  detailsText: { color: homePremium.ctaOutlineText, fontSize: 13, fontWeight: '700' },

  emptyCard: {
    borderWidth: 1,
    borderColor: homePremium.borderZinc,
    backgroundColor: homePremium.panel,
    borderRadius: 14,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { color: homePremium.zinc100, fontSize: 16, fontWeight: '700' },
  emptyText: { color: homePremium.zinc400, fontSize: 13, textAlign: 'center' },
  emptyCta: { marginTop: 8, backgroundColor: homePremium.ctaGoldFillTop, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  emptyCtaText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 13 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: homePremium.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, gap: 6 },
  modalTitle: { color: homePremium.zinc100, fontSize: 20, fontWeight: '800', fontFamily: heroTitleFont, marginBottom: 8 },
  fieldLabel: { color: homePremium.zinc300, fontSize: 12, fontWeight: '600', marginTop: 6 },
  input: {
    backgroundColor: homePremium.searchInner,
    borderWidth: 1,
    borderColor: homePremium.tagPillBorder,
    borderRadius: 8,
    color: homePremium.zinc100,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: spacing.md },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalCancel: { borderWidth: 1, borderColor: homePremium.tagPillBorder },
  modalCancelText: { color: homePremium.zinc300, fontWeight: '700' },
  modalSave: { backgroundColor: homePremium.ctaGoldFillTop },
  modalSaveText: { color: homePremium.charcoal, fontWeight: '800' },
});
