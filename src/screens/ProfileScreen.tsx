import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useSession, SessionUser } from '../lib/session';

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { token, user, role, refreshUser, signOut } = useSession();
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!token) {
      navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
    }
  }, [token, navigation]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (role === 'seller') {
        const { data } = await http.get(API_ENDPOINTS.SELLER_DASHBOARD);
        const seller = (data as { seller?: SessionUser }).seller ?? (data as SessionUser);
        await refreshUser(seller ?? user ?? null);
        setDashboard((data as Record<string, unknown>) ?? null);
      } else {
        const { data } = await http.get(API_ENDPOINTS.CUSTOMER_PROFILE);
        const fresh = (data as { user?: SessionUser }).user ?? (data as SessionUser);
        await refreshUser(fresh ?? user ?? null);
        setDashboard(null);
      }
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      if (err.response?.status === 401 || err.response?.status === 403) {
        await signOut();
        Alert.alert('Session expired', 'Please sign in again.');
        navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        return;
      }
      Alert.alert('Profile', err.response?.data?.error ?? 'Could not load profile.');
    } finally {
      setLoading(false);
    }
  }, [token, role, refreshUser, user, signOut, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSignOut = useCallback(async () => {
    if (role !== 'seller') {
      try {
        await http.post(API_ENDPOINTS.CUSTOMER_LOGOUT);
      } catch {
        // Best-effort; even if the server call fails we still clear local state.
      }
    }
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [role, signOut, navigation]);

  if (!user) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={homePremium.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const displayName = user.name || user.email || 'Account';
  const subtitle =
    role === 'seller'
      ? user.business_name || 'Vendor account'
      : user.account_type === 'club'
        ? 'Club account'
        : 'Individual account';

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={homePremium.gold} />
        }
      >
        <View style={styles.headerCard}>
          {user.profile_photo ? (
            <Image source={{ uri: String(user.profile_photo) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {user.status && user.status !== 'active' && user.status !== 'approved' ? (
            <Text style={styles.statusPending}>Status: {String(user.status)}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Row label="Email" value={user.email ?? '—'} />
          <Row label="Phone" value={(user.mobile_number as string) ?? (user.phone as string) ?? '—'} />
          <Row label="Role" value={role ?? '—'} />
          {role === 'seller' ? (
            <>
              <Row label="Business" value={(user.business_name as string) ?? '—'} />
              <Row label="Address" value={(user.address as string) ?? '—'} />
            </>
          ) : (
            <Row label="Account type" value={(user.account_type as string) ?? 'individual'} />
          )}
        </View>

        {role === 'seller' && dashboard ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vendor dashboard</Text>
            {Object.entries(dashboard)
              .filter(([k, v]) => k !== 'seller' && (typeof v === 'string' || typeof v === 'number'))
              .map(([k, v]) => (
                <Row key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
              ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => navigation.navigate('Products')}
          style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlinePressed]}
        >
          <Text style={styles.outlineBtnText}>Browse marketplace</Text>
        </Pressable>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [styles.dangerBtn, pressed && styles.dangerPressed]}
        >
          <Text style={styles.dangerBtnText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: homePremium.charcoal },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  headerCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: homePremium.borderGold,
    backgroundColor: 'rgba(10, 10, 12, 0.8)',
    borderRadius: 6,
    gap: 6,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: homePremium.panel },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: homePremium.borderGold },
  avatarText: { color: homePremium.gold, fontSize: 32, fontWeight: '700' },
  name: { color: homePremium.zinc100, fontSize: 20, fontWeight: '700', marginTop: 8 },
  subtitle: { color: homePremium.zinc400, fontSize: 13 },
  statusPending: { marginTop: 6, color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  section: {
    borderWidth: 1,
    borderColor: homePremium.borderZinc,
    backgroundColor: 'rgba(20,20,22,0.92)',
    borderRadius: 6,
    padding: spacing.md,
  },
  sectionTitle: {
    color: homePremium.zinc100,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: spacing.md,
  },
  rowLabel: { color: homePremium.zinc400, fontSize: 12, textTransform: 'capitalize' },
  rowValue: { color: homePremium.zinc100, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  outlineBtn: {
    paddingVertical: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.6)',
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
    alignItems: 'center',
  },
  outlinePressed: { opacity: 0.85 },
  outlineBtnText: {
    color: homePremium.ctaOutlineText,
    fontWeight: '700',
    letterSpacing: 1.4,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  dangerBtn: {
    paddingVertical: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.65)',
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center',
  },
  dangerPressed: { opacity: 0.85 },
  dangerBtnText: {
    color: '#fca5a5',
    fontWeight: '700',
    letterSpacing: 1.4,
    fontSize: 12,
    textTransform: 'uppercase',
  },
});
