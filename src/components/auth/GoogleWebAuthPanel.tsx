import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { homePremium } from '../../theme/homePremium';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  webClientId: string;
  disabled?: boolean;
  onIdToken: (idToken: string) => Promise<void>;
};

/**
 * Google ID token flow for **web** only. Parent must render only when `Platform.OS === 'web'`.
 */
export function GoogleWebAuthPanel({ webClientId, disabled, onIdToken }: Props) {
  const consumed = useRef(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (response?.type !== 'success' || consumed.current) return;
    const idToken =
      typeof response.params?.id_token === 'string' ? response.params.id_token : undefined;
    if (!idToken) return;
    consumed.current = true;
    void (async () => {
      try {
        await onIdToken(idToken);
      } catch (e: unknown) {
        consumed.current = false;
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Sign-in failed';
        Alert.alert('Google Sign-In', msg);
      }
    })();
  }, [onIdToken, response]);

  const busy = !request;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={() => {
        void promptAsync();
      }}
      style={({ pressed }) => [styles.googleBtn, (pressed || disabled) && styles.googleBtnPressed]}
    >
      {busy ? (
        <ActivityIndicator color={homePremium.zinc100} size="small" />
      ) : (
        <Text style={styles.googleG}>G</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: homePremium.tagPillBorder,
    backgroundColor: homePremium.tagPillBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnPressed: { opacity: 0.85 },
  googleG: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4285F4',
  },
});
