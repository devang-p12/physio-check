import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, typography } from '../theme';

interface Session {
  _id: string;
  assignmentId: {
    exerciseId?: { name: string };
    customTemplateId?: { name: string };
  };
  startTime: string;
  endTime?: string;
  status: string;
  analytics?: {
    repsCompleted?: number;
    formQuality?: { score: number };
    totalDuration?: number;
  };
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const formatDuration = (s?: number) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '0:00';

export default function SessionHistoryScreen({ navigation }: any) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/session/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load session history');
      const data = await res.json();
      setSessions(data.sessions || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const getExName = (s: Session) =>
    s.assignmentId?.exerciseId?.name || s.assignmentId?.customTemplateId?.name || 'Exercise Session';

  const filtered = sessions.filter((s) => {
    const name = getExName(s).toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || s.status.toLowerCase().includes(q);
  });

  const getStatusStyle = (status: string) => {
    if (status === 'completed') return { bg: colors.emerald100, text: colors.emerald700 };
    if (status === 'in-progress') return { bg: colors.blue50, text: colors.blue700 };
    return { bg: colors.slate100, text: colors.slate600 };
  };

  const renderItem = ({ item: s }: { item: Session }) => {
    const st = getStatusStyle(s.status);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SessionDetails', { sessionId: s._id })}
        activeOpacity={0.82}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="fitness" size={20} color={colors.teal600} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{getExName(s)}</Text>
          <Text style={styles.cardDate}>
            {formatDate(s.startTime)} · {formatTime(s.startTime)}
          </Text>
          <View style={styles.cardMeta}>
            {s.analytics?.repsCompleted != null && (
              <View style={styles.metaBadge}>
                <Ionicons name="barbell" size={10} color={colors.slate500} />
                <Text style={styles.metaText}>{s.analytics.repsCompleted} reps</Text>
              </View>
            )}
            {s.analytics?.formQuality?.score != null && (
              <View style={[styles.metaBadge, { backgroundColor: colors.amber100 }]}>
                <Ionicons name="trophy" size={10} color={colors.amber700} />
                <Text style={[styles.metaText, { color: colors.amber700 }]}>
                  {Math.round(s.analytics.formQuality.score)}%
                </Text>
              </View>
            )}
            {s.analytics?.totalDuration != null && (
              <View style={[styles.metaBadge, { backgroundColor: colors.blue50 }]}>
                <Ionicons name="time" size={10} color={colors.blue700} />
                <Text style={[styles.metaText, { color: colors.blue700 }]}>
                  {formatDuration(s.analytics.totalDuration)}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.text }]}>{s.status}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.slate400} style={{ alignSelf: 'flex-end', marginTop: 8 }} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.teal600} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session History</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.slate400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search sessions..."
          placeholderTextColor={colors.slate400}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={28} color={colors.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="fitness-outline" size={56} color={colors.slate200} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Complete your first exercise to see history here.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.teal600]} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptySub}>No sessions match your search.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.h3, color: colors.navy },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    margin: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate200,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.slate900 },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 80 },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.teal50, alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  cardDate: { fontSize: 12, color: colors.slate500, marginTop: 2 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.slate100, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm,
  },
  metaText: { fontSize: 11, fontWeight: '700', color: colors.slate600 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, alignSelf: 'flex-end' },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { color: colors.red, textAlign: 'center', fontSize: 14 },
  retryBtn: { backgroundColor: colors.slate100, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: colors.navy, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, marginTop: 80 },
  emptyTitle: { ...typography.h3, color: colors.navy },
  emptySub: { fontSize: 14, color: colors.slate500, textAlign: 'center' },
});
