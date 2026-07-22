import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { DEFAULT_DIAL_CODE, digitsOnly, toE164 } from '../lib/phoneE164';
import { GoogleWebAuthPanel } from '../components/auth/GoogleWebAuthPanel';
import { useSession, SessionUser } from '../lib/session';

type Props = NativeStackScreenProps<AppStackParamList, 'SignIn'>;

type Role = 'customer' | 'seller';
type AuthMethod = 'email' | 'otp' | 'google';
type AccountType = 'individual' | 'club';

function pickToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const nested = p.data && typeof p.data === 'object' ? (p.data as Record<string, unknown>) : null;
  return (
    (typeof p.token === 'string' && p.token) ||
    (typeof p.jwt === 'string' && p.jwt) ||
    (typeof p.accessToken === 'string' && p.accessToken) ||
    (nested && typeof nested.token === 'string' && nested.token) ||
    null
  );
}

const DIAL_PRESETS = [
  { label: 'IN +91', code: '+91' },
  { label: 'US +1', code: '+1' },
  { label: 'UK +44', code: '+44' },
];

function Checkbox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.checkbox, checked && styles.checkboxChecked]} hitSlop={8}>
      {checked && <Text style={styles.checkmark}>✓</Text>}
    </Pressable>
  );
}

export default function SignInScreen({ navigation }: Props) {
  const { signIn } = useSession();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<Role>('customer');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [accountType, setAccountType] = useState<AccountType>('individual');

  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [localPhone, setLocalPhone] = useState('');
  const [mobileE164, setMobileE164] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const webGoogleClientId = useMemo(
    () => process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '',
    [],
  );

  useEffect(() => {
    if (role === 'seller') setAuthMethod('email');
  }, [role]);

  const goProfile = useCallback(() => {
    // After auth, land on the Community feed (Home in the back stack so the
    // bottom tab bar and back gesture behave naturally).
    navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'Community' }] });
  }, [navigation]);

  const persistCustomerSession = useCallback(
    async (token: string, customer: unknown, message?: string) => {
      await signIn(token, (customer as SessionUser) ?? null, 'customer');
      const body = message?.trim() ? message : 'Signed in.';
      // Navigate immediately — on web Alert button callbacks (onPress) are
      // dropped, so we must not rely on the alert to trigger navigation.
      goProfile();
      Alert.alert('Welcome', body);
    },
    [goProfile, signIn],
  );

  const persistSellerSession = useCallback(
    async (token: string, seller: unknown) => {
      await signIn(token, (seller as SessionUser) ?? null, 'seller');
      goProfile();
      Alert.alert('Welcome back', 'You are signed in as a vendor.');
    },
    [goProfile, signIn],
  );

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter email and password.');
      return;
    }
    setLoading(true);
    try {
      if (role === 'seller') {
        const { data } = await http.post(API_ENDPOINTS.SELLERS_LOGIN, { email: email.trim(), password });
        const token = pickToken(data) ?? (data as { token?: string }).token ?? null;
        if (!token) { Alert.alert('Sign in', 'No token returned from server.'); return; }
        await persistSellerSession(token, (data as { seller?: unknown }).seller ?? data);
      } else {
        const { data } = await http.post(API_ENDPOINTS.USERS_LOGIN, { email: email.trim(), password });
        const token = pickToken(data) ?? (data as { token?: string }).token ?? null;
        if (!token) { Alert.alert('Sign in', 'No token returned from server.'); return; }
        await persistCustomerSession(token, (data as { user?: unknown }).user ?? data, (data as { message?: string }).message);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      Alert.alert('Sign in failed', err.response?.data?.error ?? 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterCustomer = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter name, email, and password.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords', 'Password and confirmation do not match.');
      return;
    }
    setLoading(true);
    try {
      await http.post(API_ENDPOINTS.USERS_REGISTER, { name: name.trim(), email: email.trim(), password, account_type: accountType });
      setMode('signin');
      Alert.alert('Account created', 'You can sign in now with your email and password.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      Alert.alert('Registration failed', err.response?.data?.error ?? 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSeller = async () => {
    if (!name.trim() || !email.trim() || !password || !businessName.trim() || !businessAddress.trim() || !businessPhone.trim()) {
      Alert.alert('Missing fields', 'Fill all vendor registration fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords', 'Password and confirmation do not match.');
      return;
    }
    setLoading(true);
    try {
      await http.post(API_ENDPOINTS.SELLERS_REGISTER, {
        name: name.trim(), email: email.trim(), password,
        business_name: businessName.trim(), address: businessAddress.trim(), phone: digitsOnly(businessPhone),
      });
      setMode('signin');
      Alert.alert('Registration submitted', 'Your vendor account is pending approval.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      Alert.alert('Registration failed', err.response?.data?.error ?? 'Could not register vendor');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (role !== 'customer') return;
    const digits = digitsOnly(localPhone);
    if (digits.length < 7) { Alert.alert('Invalid number', 'Enter a valid mobile number.'); return; }
    const e164 = toE164(dialCode, localPhone);
    setMobileE164(e164);
    setLoading(true);
    try {
      await http.post(API_ENDPOINTS.SEND_OTP, { mobileNumber: e164 });
      setOtpSent(true);
      Alert.alert('OTP sent', 'Check your phone for the verification code.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      Alert.alert('Error', err.response?.data?.error ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!mobileE164 || otp.replace(/\D/g, '').length < 4) {
      Alert.alert('Missing values', 'Send OTP first, then enter the code.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await http.post(API_ENDPOINTS.VERIFY_OTP, { mobileNumber: mobileE164, otp: otp.trim(), account_type: accountType });
      const token = pickToken(data) ?? (data as { token?: string }).token ?? null;
      if (!token) { Alert.alert('Verification', 'OTP verified but no token returned.'); return; }
      await persistCustomerSession(token, (data as { customer?: unknown }).customer ?? data, (data as { message?: string }).message);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      Alert.alert('Verification failed', err.response?.data?.error ?? 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter your email above, then tap Forgot password again.');
      return;
    }
    setLoading(true);
    try {
      const path = role === 'seller' ? API_ENDPOINTS.SELLERS_FORGOT_PASSWORD : API_ENDPOINTS.USERS_FORGOT_PASSWORD;
      await http.post(path, { email: email.trim() });
      Alert.alert('Check your email', 'If an account exists, a reset link was sent.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      Alert.alert('Request failed', err.response?.data?.error ?? err.message ?? 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleIdToken = useCallback(
    async (idToken: string) => {
      setGoogleSubmitting(true);
      try {
        const { data } = await http.post(API_ENDPOINTS.CUSTOMER_GOOGLE_SIGNIN, { idToken, account_type: accountType });
        const token = pickToken(data) ?? (data as { token?: string }).token ?? null;
        if (!token) { Alert.alert('Google', 'No token returned.'); return; }
        await persistCustomerSession(token, (data as { customer?: unknown }).customer ?? data, (data as { message?: string }).message);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        Alert.alert('Google Sign-In', err.response?.data?.error ?? 'Failed');
      } finally {
        setGoogleSubmitting(false);
      }
    },
    [accountType, persistCustomerSession],
  );

  const setMethodGoogle = () => {
    if (role === 'seller') { Alert.alert('Vendor sign-in', 'Vendors must use Email & Password.'); return; }
    setAuthMethod('google');
  };

  const headerTitle = mode === 'signup' ? 'Create Account' : 'Sign In';
  const headerSubtitle = mode === 'signup'
    ? 'Register as Autophile or Vendor'
    : 'Choose your preferred sign-in method';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={64}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Branding header */}
          <View style={styles.brandHeader}>
            <Text style={styles.brandTitle}>ROADSTER</Text>
            <View style={styles.brandSubRow}>
              <View style={styles.brandLine} />
              <Text style={styles.brandSubtitle}>RELICS &amp; AUTO</Text>
              <View style={styles.brandLine} />
            </View>
          </View>

          {/* Screen title with chevrons */}
          <View style={styles.titleRow}>
            <View style={styles.titleLineLeft}>
              <View style={styles.decorLine} />
              <Text style={styles.chevron}>◀</Text>
            </View>
            <Text style={styles.screenTitle}>{headerTitle}</Text>
            <View style={styles.titleLineRight}>
              <Text style={styles.chevron}>▶</Text>
              <View style={styles.decorLine} />
            </View>
          </View>
          <Text style={styles.screenSub}>{headerSubtitle}</Text>

          {/* Role toggle */}
          <View style={styles.segmentRow}>
            <Pressable onPress={() => setRole('customer')} style={[styles.roleBtn, role === 'customer' && styles.roleBtnActive]}>
              <Text style={[styles.roleIcon, role === 'customer' && styles.roleIconActive]}>👤</Text>
              <Text style={[styles.roleLabel, role === 'customer' && styles.roleLabelActive]}>Autophile</Text>
            </Pressable>
            <Pressable onPress={() => setRole('seller')} style={[styles.roleBtn, role === 'seller' && styles.roleBtnActive]}>
              <Text style={[styles.roleIcon, role === 'seller' && styles.roleIconActive]}>🏪</Text>
              <Text style={[styles.roleLabel, role === 'seller' && styles.roleLabelActive]}>Vendor</Text>
            </Pressable>
          </View>

          {/* Auth method tabs */}
          <View style={styles.methodRow}>
            <Pressable onPress={() => setAuthMethod('email')} style={[styles.methodBtn, authMethod === 'email' && styles.methodBtnActive]}>
              <Text style={styles.methodIcon}>✉</Text>
              <Text style={[styles.methodLabel, authMethod === 'email' && styles.methodLabelActive]} numberOfLines={1}>
                Email &amp; Password
              </Text>
            </Pressable>
            <Pressable
              onPress={() => (role === 'customer' ? setAuthMethod('otp') : undefined)}
              style={[styles.methodBtn, authMethod === 'otp' && styles.methodBtnActive, role !== 'customer' && styles.methodDisabled]}
            >
              <Text style={styles.methodIcon}>📱</Text>
              <Text style={[styles.methodLabel, authMethod === 'otp' && styles.methodLabelActive]}>Mobile OTP</Text>
            </Pressable>
            <Pressable onPress={setMethodGoogle} style={[styles.methodBtn, authMethod === 'google' && styles.methodBtnActive]}>
              <Text style={[styles.methodIcon, styles.googleMethodIcon]}>G</Text>
              <Text style={[styles.methodLabel, authMethod === 'google' && styles.methodLabelActive]}>Google</Text>
            </Pressable>
          </View>

          {/* Email & Password form */}
          {authMethod === 'email' && (
            <View style={styles.formGroup}>
              {mode === 'signup' && (
                <>
                  <Text style={styles.fieldLabel}>Full name</Text>
                  <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={homePremium.zinc400} style={styles.input} autoCapitalize="words" />
                </>
              )}

              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>✉</Text>
                <TextInput
                  value={email} onChangeText={setEmail} placeholder="you@example.com"
                  placeholderTextColor={homePremium.zinc400} style={styles.inputFlex}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                />
              </View>

              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  value={password} onChangeText={setPassword} placeholder="••••••••••"
                  placeholderTextColor={homePremium.zinc400} style={styles.inputFlex}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                  <Text style={styles.eye}>{showPassword ? '🙈' : '👁'}</Text>
                </Pressable>
              </View>

              {mode === 'signup' && (
                <>
                  <Text style={styles.fieldLabel}>Confirm password</Text>
                  <View style={styles.inputRow}>
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat password" placeholderTextColor={homePremium.zinc400} style={styles.inputFlex} secureTextEntry={!showPassword} />
                  </View>
                  {role === 'customer' && (
                    <View style={styles.accountTypeRow}>
                      <Text style={styles.fieldLabel}>Account type</Text>
                      <View style={styles.pillRow}>
                        <Pressable onPress={() => setAccountType('individual')} style={[styles.pill, accountType === 'individual' && styles.pillActive]}>
                          <Text style={[styles.pillText, accountType === 'individual' && styles.pillTextActive]}>Individual</Text>
                        </Pressable>
                        <Pressable onPress={() => setAccountType('club')} style={[styles.pill, accountType === 'club' && styles.pillActive]}>
                          <Text style={[styles.pillText, accountType === 'club' && styles.pillTextActive]}>Club</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                  {role === 'seller' && (
                    <>
                      <Text style={styles.fieldLabel}>Business name</Text>
                      <TextInput value={businessName} onChangeText={setBusinessName} placeholder="Garage / shop name" placeholderTextColor={homePremium.zinc400} style={styles.input} />
                      <Text style={styles.fieldLabel}>Business address</Text>
                      <TextInput value={businessAddress} onChangeText={setBusinessAddress} placeholder="Street, city" placeholderTextColor={homePremium.zinc400} style={styles.input} />
                      <Text style={styles.fieldLabel}>Business phone</Text>
                      <TextInput value={businessPhone} onChangeText={setBusinessPhone} placeholder="Digits only" placeholderTextColor={homePremium.zinc400} style={styles.input} keyboardType="phone-pad" />
                    </>
                  )}
                </>
              )}

              {mode === 'signin' && (
                <View style={styles.rememberRow}>
                  <View style={styles.rememberLeft}>
                    <Checkbox checked={rememberMe} onPress={() => setRememberMe((v) => !v)} />
                    <Text style={styles.rememberText}>Remember me</Text>
                  </View>
                  <Pressable onPress={forgotPassword} hitSlop={8}>
                    <Text style={styles.forgotLink}>Forgot your password?</Text>
                  </Pressable>
                </View>
              )}

              <Pressable
                onPress={() => {
                  if (mode === 'signup') void (role === 'seller' ? handleRegisterSeller() : handleRegisterCustomer());
                  else void handleEmailSignIn();
                }}
                disabled={loading}
                style={({ pressed }) => [styles.primaryCta, pressed && styles.primaryCtaPressed, loading && styles.primaryDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color={homePremium.charcoal} />
                ) : (
                  <>
                    <Text style={styles.primaryCtaIcon}>🛡</Text>
                    <Text style={styles.primaryCtaText}>{mode === 'signup' ? 'Create Account' : 'Sign In'}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* OTP form */}
          {authMethod === 'otp' && role === 'customer' && (
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Country</Text>
              <View style={styles.dialRow}>
                {DIAL_PRESETS.map((d) => (
                  <Pressable key={d.code} onPress={() => setDialCode(d.code)} style={[styles.dialChip, dialCode === d.code && styles.dialChipActive]}>
                    <Text style={[styles.dialChipText, dialCode === d.code && styles.dialChipTextActive]}>{d.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Mobile number</Text>
              <TextInput value={localPhone} onChangeText={(t) => setLocalPhone(digitsOnly(t))} placeholder="Digits without country code" placeholderTextColor={homePremium.zinc400} style={styles.input} keyboardType="phone-pad" />

              <View style={styles.accountTypeRow}>
                <Text style={styles.fieldLabel}>Account type</Text>
                <View style={styles.pillRow}>
                  <Pressable onPress={() => setAccountType('individual')} style={[styles.pill, accountType === 'individual' && styles.pillActive]}>
                    <Text style={[styles.pillText, accountType === 'individual' && styles.pillTextActive]}>Individual</Text>
                  </Pressable>
                  <Pressable onPress={() => setAccountType('club')} style={[styles.pill, accountType === 'club' && styles.pillActive]}>
                    <Text style={[styles.pillText, accountType === 'club' && styles.pillTextActive]}>Club</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable onPress={sendOtp} disabled={loading} style={({ pressed }) => [styles.secondaryCta, pressed && styles.secondaryPressed]}>
                <Text style={styles.secondaryCtaText}>{loading ? 'Sending…' : 'Send OTP'}</Text>
              </Pressable>

              <Text style={styles.fieldLabel}>OTP</Text>
              <TextInput value={otp} onChangeText={setOtp} placeholder="Enter code" placeholderTextColor={homePremium.zinc400} style={styles.input} keyboardType="number-pad" maxLength={8} />
              {otpSent && <Text style={styles.hintMuted}>Sent to {mobileE164 || toE164(dialCode, localPhone)}</Text>}

              <Pressable onPress={verifyOtp} disabled={loading} style={({ pressed }) => [styles.primaryCta, pressed && styles.primaryCtaPressed, loading && styles.primaryDisabled]}>
                {loading ? <ActivityIndicator color={homePremium.charcoal} /> : <Text style={styles.primaryCtaText}>Verify OTP &amp; Sign In</Text>}
              </Pressable>
            </View>
          )}

          {/* Google form */}
          {authMethod === 'google' && role === 'customer' && (
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Account type (for new Google users)</Text>
              <View style={styles.pillRow}>
                <Pressable onPress={() => setAccountType('individual')} style={[styles.pill, accountType === 'individual' && styles.pillActive]}>
                  <Text style={[styles.pillText, accountType === 'individual' && styles.pillTextActive]}>Individual</Text>
                </Pressable>
                <Pressable onPress={() => setAccountType('club')} style={[styles.pill, accountType === 'club' && styles.pillActive]}>
                  <Text style={[styles.pillText, accountType === 'club' && styles.pillTextActive]}>Club</Text>
                </Pressable>
              </View>
              {Platform.OS === 'web' && webGoogleClientId ? (
                <View style={[styles.socialRow, { marginTop: spacing.md }]}>
                  <GoogleWebAuthPanel webClientId={webGoogleClientId} disabled={googleSubmitting} onIdToken={onGoogleIdToken} />
                </View>
              ) : (
                <Text style={[styles.hintMuted, { marginTop: 8 }]}>
                  Add <Text style={{ fontWeight: '700' }}>EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID</Text> to{' '}
                  <Text style={{ fontWeight: '700' }}>.env</Text> and open in a browser.
                </Text>
              )}
            </View>
          )}

          {/* Social divider + icons */}
          {authMethod !== 'google' && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.divider} />
              </View>

              <View style={styles.socialRow}>
                {Platform.OS === 'web' && webGoogleClientId && role === 'customer' ? (
                  <GoogleWebAuthPanel webClientId={webGoogleClientId} disabled={googleSubmitting} onIdToken={onGoogleIdToken} />
                ) : (
                  <Pressable
                    style={styles.socialIcon}
                    onPress={() => Alert.alert('Google', role === 'seller' ? 'Vendors use email & password.' : 'Use the Google tab above on web.')}
                  >
                    <Text style={styles.googleG}>G</Text>
                  </Pressable>
                )}
                <Pressable style={styles.socialIcon} onPress={() => Alert.alert('Facebook', 'Not connected on this build.')}>
                  <Text style={styles.fbText}>f</Text>
                </Pressable>
                <Pressable style={styles.socialIcon} onPress={() => Alert.alert('Apple', 'Apple Sign-In is not wired yet.')}>
                  <Text style={styles.appleText}>⌘</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Footer */}
          <Pressable
            onPress={() => { setMode((m) => (m === 'signin' ? 'signup' : 'signin')); setPassword(''); setConfirmPassword(''); }}
            style={styles.footerLinkWrap}
          >
            <Text style={styles.footerMuted}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.footerGold}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</Text>
            </Text>
          </Pressable>

          <Text style={styles.footerNote}>
            Register to set Individual or Club. Sign in proves it's you—change account type later in Profile.
          </Text>

          <View style={styles.trustFooter}>
            <Text style={styles.trustIcon}>🛡</Text>
            <Text style={styles.trustText}>Your data is protected with enterprise-grade security</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: homePremium.charcoal },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },

  /* Branding header */
  brandHeader: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.lg },
  brandTitle: {
    color: homePremium.gold,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  brandSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  brandLine: { flex: 1, height: 1, backgroundColor: homePremium.gold, maxWidth: 40 },
  brandSubtitle: { color: homePremium.gold, fontSize: 11, letterSpacing: 4, fontWeight: '600' },

  /* Title row with chevrons */
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 },
  titleLineLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleLineRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  decorLine: { width: 32, height: 1, backgroundColor: homePremium.gold, opacity: 0.6 },
  chevron: { color: homePremium.gold, fontSize: 10, fontWeight: '700' },
  screenTitle: {
    color: homePremium.zinc100,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  screenSub: {
    color: homePremium.zinc400,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontSize: 14,
    lineHeight: 20,
  },

  /* Role toggle */
  segmentRow: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: spacing.md,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: homePremium.tagPillBorder,
    overflow: 'hidden',
    backgroundColor: homePremium.panel,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 50,
  },
  roleBtnActive: { backgroundColor: homePremium.gold },
  roleIcon: { fontSize: 15 },
  roleIconActive: {},
  roleLabel: { color: homePremium.zinc300, fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  roleLabelActive: { color: homePremium.charcoal },

  /* Auth method tabs */
  methodRow: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: homePremium.tagPillBorder,
    overflow: 'hidden',
    backgroundColor: homePremium.panel,
  },
  methodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 3,
    borderRadius: 8,
  },
  methodBtnActive: { backgroundColor: homePremium.gold },
  methodDisabled: { opacity: 0.4 },
  methodIcon: { fontSize: 13 },
  googleMethodIcon: { color: '#4285F4', fontWeight: '800', fontSize: 14 },
  methodLabel: { color: homePremium.zinc400, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  methodLabelActive: { color: homePremium.charcoal },

  /* Form fields */
  formGroup: { gap: spacing.sm, marginBottom: spacing.sm },
  fieldLabel: { color: homePremium.zinc100, fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: homePremium.searchInner,
    borderWidth: 1,
    borderColor: homePremium.tagPillBorder,
    borderRadius: 8,
    color: homePremium.zinc100,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: homePremium.searchInner,
    borderWidth: 1,
    borderColor: homePremium.tagPillBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
  },
  inputIcon: { fontSize: 15, marginRight: 8, color: homePremium.zinc400 },
  inputFlex: { flex: 1, color: homePremium.zinc100, paddingVertical: Platform.OS === 'ios' ? 14 : 10, fontSize: 15 },
  eye: { fontSize: 17, padding: 4 },

  /* Remember me */
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  rememberLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rememberText: { color: homePremium.zinc300, fontSize: 14 },
  forgotLink: { color: homePremium.gold, fontSize: 13, fontWeight: '600' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: homePremium.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: { backgroundColor: homePremium.gold },
  checkmark: { color: homePremium.charcoal, fontSize: 12, fontWeight: '800', lineHeight: 14 },

  /* Primary CTA */
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: homePremium.ctaGoldFillTop,
    marginTop: 4,
  },
  primaryCtaPressed: { opacity: 0.9 },
  primaryDisabled: { opacity: 0.5 },
  primaryCtaIcon: { fontSize: 16 },
  primaryCtaText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  /* Secondary CTA */
  secondaryCta: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.6)',
    backgroundColor: 'rgba(201, 162, 39, 0.1)',
  },
  secondaryPressed: { opacity: 0.85 },
  secondaryCtaText: { color: homePremium.ctaOutlineText, fontWeight: '700', fontSize: 13 },

  /* Misc */
  hintMuted: { color: homePremium.zinc400, fontSize: 11, lineHeight: 16 },
  dialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dialChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1, borderColor: homePremium.tagPillBorder, backgroundColor: homePremium.panel,
  },
  dialChipActive: { borderColor: homePremium.gold, backgroundColor: 'rgba(201, 162, 39, 0.15)' },
  dialChipText: { color: homePremium.zinc400, fontSize: 12, fontWeight: '600' },
  dialChipTextActive: { color: homePremium.gold },
  accountTypeRow: { marginTop: 4 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1, borderColor: homePremium.tagPillBorder, backgroundColor: homePremium.panel,
  },
  pillActive: { borderColor: homePremium.gold, backgroundColor: 'rgba(201, 162, 39, 0.2)' },
  pillText: { color: homePremium.zinc400, fontWeight: '600', fontSize: 12 },
  pillTextActive: { color: homePremium.gold },

  /* Social */
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg, gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: homePremium.borderZinc },
  dividerText: { color: homePremium.zinc400, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: spacing.lg },
  socialIcon: {
    width: 56, height: 56, borderRadius: 12,
    borderWidth: 1, borderColor: homePremium.tagPillBorder,
    backgroundColor: homePremium.tagPillBg,
    alignItems: 'center', justifyContent: 'center',
  },
  googleG: { fontSize: 22, fontWeight: '800', color: '#4285F4' },
  fbText: { color: '#1877F2', fontSize: 24, fontWeight: '800' },
  appleText: { color: homePremium.zinc100, fontSize: 22, fontWeight: '600' },

  /* Footer */
  footerLinkWrap: { alignSelf: 'center', marginBottom: spacing.sm },
  footerMuted: { color: homePremium.zinc300, fontSize: 14, textAlign: 'center' },
  footerGold: { color: homePremium.gold, fontWeight: '700' },
  footerNote: {
    color: homePremium.zinc400, fontSize: 11, lineHeight: 17,
    textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.sm,
  },
  trustFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: spacing.md },
  trustIcon: { fontSize: 14 },
  trustText: { color: homePremium.zinc400, fontSize: 11, flex: 1, textAlign: 'center' },
});
