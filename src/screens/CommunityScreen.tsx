import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useSession } from '../lib/session';
import { BottomTabBar } from '../components/BottomTabBar';

type Props = NativeStackScreenProps<AppStackParamList, 'Community'>;

const heroTitleFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

type Media = { media_url: string; media_type: 'image' | 'video' };
type FeedPost = {
  id: number;
  content: string;
  author_name: string;
  author_photo: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  user_liked: number;
  hashtags: string[];
  media: Media[];
};
type Hashtag = { id: number; tag: string; usage_count: number };
type Club = { id: number; name: string; slug: string; member_count: number; logo_image: string | null };
type EventItem = {
  id: number;
  title: string;
  slug: string;
  starts_at: string;
  location_name: string | null;
  city: string | null;
  country: string | null;
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All Posts' },
  { key: 'following', label: 'Following' },
  { key: 'clubs', label: 'Clubs' },
  { key: 'projects', label: 'Projects' },
  { key: 'mentions', label: 'Mentions' },
];

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

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

function extractHashtags(text: string): string[] {
  const out: string[] = [];
  const re = /#(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

function eventDateLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CommunityScreen({ navigation }: Props) {
  const { token, user } = useSession();
  const composerRef = useRef<TextInput>(null);

  const [filter, setFilter] = useState('all');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [interested, setInterested] = useState<Record<number, boolean>>({});

  // Comment modal
  const [commentFor, setCommentFor] = useState<FeedPost | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!token) {
      setPosts([]);
      return;
    }
    try {
      const { data } = await http.get<FeedPost[]>(API_ENDPOINTS.SOCIAL_FEED, { params: { filter, limit: 20 } });
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
    }
  }, [token, filter]);

  const loadSidebar = useCallback(async () => {
    try {
      const [h, c, e] = await Promise.allSettled([
        http.get<Hashtag[]>(API_ENDPOINTS.TRENDING_HASHTAGS, { params: { limit: 4 } }),
        http.get<{ clubs: Club[] }>(API_ENDPOINTS.CLUBS, { params: { limit: 4 } }),
        http.get<{ events: EventItem[] }>(API_ENDPOINTS.EVENTS, { params: { limit: 3 } }),
      ]);
      if (h.status === 'fulfilled') setHashtags(Array.isArray(h.value.data) ? h.value.data : []);
      if (c.status === 'fulfilled') setClubs(c.value.data?.clubs ?? []);
      if (e.status === 'fulfilled') setEvents(e.value.data?.events ?? []);
    } catch {
      /* sidebar is best-effort */
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadFeed(), loadSidebar()]);
    setLoading(false);
  }, [loadFeed, loadSidebar]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitPost = async () => {
    const content = composer.trim();
    if (!token) {
      navigation.navigate('SignIn');
      return;
    }
    if (!content) {
      composerRef.current?.focus();
      return;
    }
    setPosting(true);
    try {
      await http.post(API_ENDPOINTS.SOCIAL_POSTS, { content, hashtags: extractHashtags(content) });
      setComposer('');
      await loadFeed();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      Alert.alert('Could not post', err.response?.data?.error ?? 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (p: FeedPost) => {
    if (!token) { navigation.navigate('SignIn'); return; }
    const liked = !p.user_liked;
    setPosts((prev) =>
      prev.map((x) =>
        x.id === p.id ? { ...x, user_liked: liked ? 1 : 0, like_count: x.like_count + (liked ? 1 : -1) } : x,
      ),
    );
    try {
      await http.post(`${API_ENDPOINTS.SOCIAL_POSTS}/${p.id}/like`);
    } catch {
      void loadFeed(); // revert to server truth on failure
    }
  };

  const submitComment = async () => {
    if (!commentFor || !commentText.trim()) return;
    setCommentSaving(true);
    try {
      await http.post(`${API_ENDPOINTS.SOCIAL_POSTS}/${commentFor.id}/comment`, { comment_text: commentText.trim() });
      setPosts((prev) => prev.map((x) => (x.id === commentFor.id ? { ...x, comment_count: x.comment_count + 1 } : x)));
      setCommentText('');
      setCommentFor(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      Alert.alert('Comment failed', err.response?.data?.error ?? 'Please try again.');
    } finally {
      setCommentSaving(false);
    }
  };

  const joinClub = async (c: Club) => {
    if (!token) { navigation.navigate('SignIn'); return; }
    setJoined((prev) => ({ ...prev, [c.slug]: true }));
    try {
      await http.post(`${API_ENDPOINTS.CLUBS}/${c.slug}/join`);
    } catch (e: unknown) {
      setJoined((prev) => ({ ...prev, [c.slug]: false }));
      const err = e as { response?: { data?: { error?: string } } };
      Alert.alert('Join failed', err.response?.data?.error ?? 'Please try again.');
    }
  };

  const toggleInterested = async (ev: EventItem) => {
    if (!token) { navigation.navigate('SignIn'); return; }
    const next = !interested[ev.id];
    setInterested((prev) => ({ ...prev, [ev.id]: next }));
    try {
      if (next) await http.post(`${API_ENDPOINTS.EVENTS}/${ev.id}/rsvp`);
      else await http.delete(`${API_ENDPOINTS.EVENTS}/${ev.id}/rsvp`);
    } catch {
      setInterested((prev) => ({ ...prev, [ev.id]: !next }));
    }
  };

  const topContributors = useMemo(() => {
    const byAuthor = new Map<string, { name: string; photo: string | null; points: number }>();
    for (const p of posts) {
      const cur = byAuthor.get(p.author_name) ?? { name: p.author_name, photo: p.author_photo, points: 0 };
      cur.points += p.like_count * 10 + p.comment_count * 5 + 10;
      byAuthor.set(p.author_name, cur);
    }
    return [...byAuthor.values()].sort((a, b) => b.points - a.points).slice(0, 3);
  }, [posts]);

  const firstName = (user?.name ?? user?.email ?? 'You').toString().split(/[\s@]/)[0];
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={homePremium.gold} />}
      >
        {/* Title row */}
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>
              Community <Text style={styles.pageTitleAccent}>Feed</Text>
            </Text>
            <Text style={styles.pageLead}>
              Connect with fellow enthusiasts, share restoration progress, discover classic finds and meet collectors,
              restorers and clubs from around the world.
            </Text>
          </View>
        </View>
        <Pressable onPress={submitPost} style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}>
          <Text style={styles.createBtnText}>＋  Create Post</Text>
        </Pressable>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Composer */}
        <View style={styles.composerCard}>
          <View style={styles.composerHead}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{firstName[0]?.toUpperCase() ?? 'Y'}</Text></View>
            <View>
              <Text style={styles.composerName}>{signedOut ? 'Join the community' : firstName}</Text>
              <Text style={styles.composerSub}>{signedOut ? 'Sign in to share your thoughts' : 'Share your thoughts with the community'}</Text>
            </View>
          </View>
          {signedOut ? (
            <Pressable onPress={() => navigation.navigate('SignIn')} style={({ pressed }) => [styles.postBtn, pressed && styles.pressed, { alignSelf: 'flex-start', marginTop: spacing.sm }]}>
              <Text style={styles.postBtnText}>Sign In to Post</Text>
            </Pressable>
          ) : (
            <>
              <TextInput
                ref={composerRef}
                value={composer}
                onChangeText={setComposer}
                placeholder="What's on your mind? Share automotive passion, tips, or finds… Use #hashtags."
                placeholderTextColor={homePremium.zinc400}
                style={styles.composerInput}
                multiline
              />
              <View style={styles.composerFoot}>
                <Text style={styles.composerHint}>🖼 Media</Text>
                <Text style={styles.composerHint}># Hashtag</Text>
                <Pressable onPress={submitPost} disabled={posting} style={({ pressed }) => [styles.postBtn, pressed && styles.pressed]}>
                  {posting ? <ActivityIndicator color={homePremium.charcoal} size="small" /> : <Text style={styles.postBtnText}>➤ Post</Text>}
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* Feed */}
        {signedOut ? (
          <Pressable onPress={() => navigation.navigate('SignIn')} style={styles.feedPrompt}>
            <Text style={styles.promptTitle}>Sign in to see the feed</Text>
            <Text style={styles.promptText}>Follow enthusiasts, like and comment on restoration stories.</Text>
            <View style={styles.promptCta}><Text style={styles.promptCtaText}>Sign In</Text></View>
          </Pressable>
        ) : loading && posts.length === 0 ? (
          <ActivityIndicator color={homePremium.gold} style={{ marginVertical: spacing.lg }} />
        ) : posts.length === 0 ? (
          <View style={styles.feedPrompt}>
            <Text style={styles.promptTitle}>No posts yet</Text>
            <Text style={styles.promptText}>Be the first to share something with the community.</Text>
          </View>
        ) : (
          posts.map((p) => (
            <View key={p.id} style={styles.postCard}>
              <View style={styles.postHead}>
                {p.author_photo ? (
                  <Image source={{ uri: p.author_photo }} style={styles.postAvatar} />
                ) : (
                  <View style={styles.avatar}><Text style={styles.avatarText}>{p.author_name?.[0] ?? '?'}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.postAuthor}>{p.author_name}</Text>
                  <Text style={styles.postAgo}>{timeAgo(p.created_at)}</Text>
                </View>
                <Text style={styles.kebab}>⋯</Text>
              </View>
              {!!p.content && <Text style={styles.postBody}>{p.content}</Text>}
              {p.hashtags?.length > 0 && (
                <Text style={styles.postTags}>{p.hashtags.map((t) => `#${t}`).join(' ')}</Text>
              )}
              {p.media?.[0]?.media_url && p.media[0].media_type === 'image' && (
                <Image source={{ uri: p.media[0].media_url }} style={styles.postImage} />
              )}
              <View style={styles.postActions}>
                <Pressable onPress={() => toggleLike(p)} hitSlop={6} style={styles.actionBtn}>
                  <Text style={[styles.actionIcon, p.user_liked ? styles.liked : null]}>{p.user_liked ? '❤' : '♡'}</Text>
                  <Text style={styles.actionCount}>{p.like_count}</Text>
                </Pressable>
                <Pressable onPress={() => setCommentFor(p)} hitSlop={6} style={styles.actionBtn}>
                  <Text style={styles.actionIcon}>💬</Text>
                  <Text style={styles.actionCount}>{p.comment_count}</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Text style={styles.actionIcon}>🔖</Text>
              </View>
            </View>
          ))
        )}

        {/* Find Enthusiasts */}
        {clubs.length > 0 && (
          <View style={styles.sideCard}>
            <View style={styles.sideHead}>
              <Text style={styles.sideTitle}>Find Enthusiasts</Text>
              <Text style={styles.sideLink}>View All</Text>
            </View>
            {clubs.map((c) => (
              <View key={c.id} style={styles.clubRow}>
                <View style={styles.clubLogo}><Text style={styles.clubLogoText}>{c.name[0]}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clubName} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.clubMeta}>{compact(c.member_count || 0)} members</Text>
                </View>
                <Pressable onPress={() => joinClub(c)} style={[styles.joinBtn, joined[c.slug] && styles.joinedBtn]}>
                  <Text style={[styles.joinText, joined[c.slug] && styles.joinedText]}>{joined[c.slug] ? 'Joined' : 'Join'}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Upcoming Events */}
        <View style={styles.sideCard}>
          <View style={styles.sideHead}>
            <Text style={styles.sideTitle}>Upcoming Events</Text>
            <Text style={styles.sideLink}>View All</Text>
          </View>
          {events.length === 0 ? (
            <Text style={styles.emptyMeta}>No upcoming events right now.</Text>
          ) : (
            events.map((ev) => (
              <View key={ev.id} style={styles.eventRow}>
                <View style={styles.eventCal}><Text style={styles.eventCalText}>🗓</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
                  <Text style={styles.eventMeta}>{eventDateLabel(ev.starts_at)}</Text>
                  <Text style={styles.eventMeta} numberOfLines={1}>
                    {[ev.location_name, ev.city, ev.country].filter(Boolean).join(', ')}
                  </Text>
                  <Pressable onPress={() => toggleInterested(ev)} style={[styles.interestBtn, interested[ev.id] && styles.interestActive]}>
                    <Text style={[styles.interestText, interested[ev.id] && styles.interestTextActive]}>
                      ⭐ {interested[ev.id] ? 'Interested' : 'Interested'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Trending Hashtags */}
        {hashtags.length > 0 && (
          <View style={styles.sideCard}>
            <View style={styles.sideHead}>
              <Text style={styles.sideTitle}>Trending Hashtags</Text>
              <Text style={styles.sideLink}>View All</Text>
            </View>
            <View style={styles.tagGrid}>
              {hashtags.map((h) => (
                <View key={h.id} style={styles.tagChip}>
                  <Text style={styles.tagChipTag}># {h.tag}</Text>
                  <Text style={styles.tagChipCount}>{compact(h.usage_count)} posts</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Contributors */}
        {topContributors.length > 0 && (
          <View style={styles.sideCard}>
            <View style={styles.sideHead}>
              <Text style={styles.sideTitle}>Top Contributors</Text>
              <Text style={styles.sideLink}>View All</Text>
            </View>
            {topContributors.map((c, i) => (
              <View key={c.name} style={styles.contribRow}>
                {c.photo ? (
                  <Image source={{ uri: c.photo }} style={styles.contribAvatar} />
                ) : (
                  <View style={styles.avatar}><Text style={styles.avatarText}>{c.name[0]}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.contribName}>{c.name}</Text>
                  <Text style={styles.contribPoints}>{compact(c.points)} points</Text>
                </View>
                <View style={[styles.rank, i === 0 && styles.rankGold]}>
                  <Text style={[styles.rankText, i === 0 && styles.rankTextGold]}>{i + 1}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Comment modal */}
      <Modal visible={!!commentFor} transparent animationType="slide" onRequestClose={() => setCommentFor(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a comment</Text>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write your comment…"
              placeholderTextColor={homePremium.zinc400}
              style={[styles.composerInput, { minHeight: 70 }]}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => { setCommentFor(null); setCommentText(''); }} style={[styles.modalBtn, styles.modalCancel]}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitComment} disabled={commentSaving} style={[styles.modalBtn, styles.modalSave]}>
                {commentSaving ? <ActivityIndicator color={homePremium.charcoal} /> : <Text style={styles.modalSaveText}>Comment</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BottomTabBar active="Community" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: homePremium.charcoal },
  pressed: { opacity: 0.85 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12 },
  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 20, color: homePremium.zinc100 },
  brand: { alignItems: 'center' },
  brandTitle: { color: homePremium.gold, fontSize: 20, fontWeight: '800', letterSpacing: 4, fontFamily: heroTitleFont },
  brandSub: { color: homePremium.gold, fontSize: 9, letterSpacing: 3, marginTop: 2 },

  titleRow: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  pageTitle: { color: homePremium.zinc100, fontSize: 32, fontWeight: '700', fontFamily: heroTitleFont },
  pageTitleAccent: { color: homePremium.gold, fontStyle: 'italic', fontFamily: heroTitleFont },
  pageLead: { color: homePremium.zinc300, fontSize: 13, lineHeight: 20, marginTop: 6 },
  createBtn: { alignSelf: 'flex-start', marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: homePremium.ctaGoldFillTop, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  createBtnText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 14 },

  tabsRow: { gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  tabActive: { borderColor: homePremium.borderGold, backgroundColor: 'rgba(201,162,39,0.12)' },
  tabText: { color: homePremium.zinc400, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: homePremium.gold },

  composerCard: { marginHorizontal: spacing.md, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: homePremium.borderZinc, backgroundColor: homePremium.panel },
  composerHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: homePremium.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 16 },
  composerName: { color: homePremium.zinc100, fontSize: 14, fontWeight: '700' },
  composerSub: { color: homePremium.zinc400, fontSize: 12 },
  composerInput: { marginTop: spacing.sm, minHeight: 80, color: homePremium.zinc100, fontSize: 14, lineHeight: 20, backgroundColor: homePremium.searchInner, borderRadius: 10, padding: 12, textAlignVertical: 'top' },
  composerFoot: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: spacing.sm },
  composerHint: { color: homePremium.zinc400, fontSize: 12 },
  postBtn: { marginLeft: 'auto', backgroundColor: homePremium.ctaGoldFillTop, paddingVertical: 9, paddingHorizontal: 18, borderRadius: 8 },
  postBtnText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 13 },

  feedPrompt: { marginHorizontal: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: homePremium.borderZinc, backgroundColor: homePremium.panel, borderRadius: 14, padding: spacing.lg, alignItems: 'center', gap: 8 },
  promptTitle: { color: homePremium.zinc100, fontSize: 16, fontWeight: '700' },
  promptText: { color: homePremium.zinc400, fontSize: 13, textAlign: 'center' },
  promptCta: { marginTop: 8, backgroundColor: homePremium.ctaGoldFillTop, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 22 },
  promptCtaText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 13 },

  postCard: { marginHorizontal: spacing.md, marginTop: spacing.md, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: homePremium.borderZinc, backgroundColor: homePremium.panel },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222' },
  postAuthor: { color: homePremium.zinc100, fontSize: 14, fontWeight: '700' },
  postAgo: { color: homePremium.zinc400, fontSize: 11 },
  kebab: { color: homePremium.zinc400, fontSize: 18 },
  postBody: { color: homePremium.zinc100, fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  postTags: { color: homePremium.gold, fontSize: 13, marginTop: 6 },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginTop: spacing.sm, backgroundColor: '#222' },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIcon: { color: homePremium.zinc300, fontSize: 16 },
  liked: { color: '#f87171' },
  actionCount: { color: homePremium.zinc300, fontSize: 13 },

  sideCard: { marginHorizontal: spacing.md, marginTop: spacing.md, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: homePremium.borderZinc, backgroundColor: homePremium.panel },
  sideHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sideTitle: { color: homePremium.zinc100, fontSize: 17, fontWeight: '700', fontFamily: heroTitleFont },
  sideLink: { color: homePremium.gold, fontSize: 12, fontWeight: '600' },

  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  clubLogo: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: homePremium.borderGold, alignItems: 'center', justifyContent: 'center' },
  clubLogoText: { color: homePremium.gold, fontWeight: '800' },
  clubName: { color: homePremium.zinc100, fontSize: 13, fontWeight: '700' },
  clubMeta: { color: homePremium.zinc400, fontSize: 11 },
  joinBtn: { backgroundColor: homePremium.ctaGoldFillTop, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 16 },
  joinedBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: homePremium.borderGold },
  joinText: { color: homePremium.charcoal, fontWeight: '800', fontSize: 12 },
  joinedText: { color: homePremium.gold },

  eventRow: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  eventCal: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(201,162,39,0.1)', borderWidth: 1, borderColor: homePremium.borderGold, alignItems: 'center', justifyContent: 'center' },
  eventCalText: { fontSize: 16 },
  eventTitle: { color: homePremium.zinc100, fontSize: 14, fontWeight: '700' },
  eventMeta: { color: homePremium.zinc400, fontSize: 12, marginTop: 1 },
  interestBtn: { alignSelf: 'flex-start', marginTop: 6, borderWidth: 1, borderColor: homePremium.borderGold, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  interestActive: { backgroundColor: 'rgba(201,162,39,0.18)' },
  interestText: { color: homePremium.gold, fontSize: 12, fontWeight: '600' },
  interestTextActive: { color: homePremium.gold },
  emptyMeta: { color: homePremium.zinc400, fontSize: 13 },

  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tagChip: { width: '47%', flexGrow: 1, borderWidth: 1, borderColor: homePremium.borderZinc, borderRadius: 10, padding: 10, backgroundColor: 'rgba(24,24,27,0.6)' },
  tagChipTag: { color: homePremium.zinc100, fontSize: 13, fontWeight: '700' },
  tagChipCount: { color: homePremium.zinc400, fontSize: 11, marginTop: 2 },

  contribRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  contribAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222' },
  contribName: { color: homePremium.zinc100, fontSize: 13, fontWeight: '700' },
  contribPoints: { color: homePremium.zinc400, fontSize: 11 },
  rank: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(63,63,70,0.8)', alignItems: 'center', justifyContent: 'center' },
  rankGold: { backgroundColor: homePremium.gold },
  rankText: { color: homePremium.zinc100, fontSize: 12, fontWeight: '800' },
  rankTextGold: { color: homePremium.charcoal },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: homePremium.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg },
  modalTitle: { color: homePremium.zinc100, fontSize: 18, fontWeight: '800', fontFamily: heroTitleFont, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: spacing.md },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalCancel: { borderWidth: 1, borderColor: homePremium.tagPillBorder },
  modalCancelText: { color: homePremium.zinc300, fontWeight: '700' },
  modalSave: { backgroundColor: homePremium.ctaGoldFillTop },
  modalSaveText: { color: homePremium.charcoal, fontWeight: '800' },
});
