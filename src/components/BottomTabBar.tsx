import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { homePremium } from '../theme/homePremium';
import { useSession } from '../lib/session';

export type TabKey = 'Home' | 'Garage' | 'Community' | 'Marketplace' | 'Profile';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const TABS: Array<{ key: TabKey; icon: string; label: string }> = [
  { key: 'Home', icon: '🏠', label: 'Home' },
  { key: 'Garage', icon: '🚗', label: 'Garage' },
  { key: 'Community', icon: '👥', label: 'Community' },
  { key: 'Marketplace', icon: '🛍', label: 'Marketplace' },
  { key: 'Profile', icon: '👤', label: 'Profile' },
];

export function BottomTabBar({ active }: { active: TabKey }) {
  const navigation = useNavigation<Nav>();
  const { token } = useSession();

  const onPress = (key: TabKey) => {
    if (key === active) return;
    switch (key) {
      case 'Home':
        navigation.navigate('Home');
        break;
      case 'Garage':
        navigation.navigate('Garage');
        break;
      case 'Community':
        navigation.navigate('Community');
        break;
      case 'Profile':
        navigation.navigate(token ? 'Profile' : 'SignIn');
        break;
      // No dedicated screen yet — route to the marketplace listing.
      case 'Marketplace':
        navigation.navigate('Products');
        break;
    }
  };

  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Pressable key={t.key} onPress={() => onPress(t.key)} style={styles.tabItem} hitSlop={6}>
            <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{t.icon}</Text>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: homePremium.borderZinc,
    backgroundColor: homePremium.topbarBg,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon: { fontSize: 18, opacity: 0.6 },
  tabIconActive: { opacity: 1 },
  tabLabel: { color: homePremium.zinc400, fontSize: 10 },
  tabLabelActive: { color: homePremium.gold, fontWeight: '700' },
});
