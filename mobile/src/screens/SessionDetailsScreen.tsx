import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, typography } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const formatDuration = (s?: number) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : 'N/A';

export default function SessionDetailsScreen({ route, navigation }: any) {
  const { sessionId } = route.params;
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const res = await fetch(`${API_BASE}/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSession(data.session || data);
      } catch {}
      setLoading(false);
    };
    fetchSession();
  }, [sessionId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.teal600} /></View>;
  }
  if (!session) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.slate300} />
        <Text style={styles.noData}>Session data not found.</Text>
      </View>
    );
  }

  const exerciseName = session.assignmentId?.exerciseId?.name
    || session.assignmentId?.customTemplateId?.name
    || 'Exercise Session';
  const analytics = session.analytics || {};
  const score = analytics.formQuality?.score;

  const metricCards = [
    { label: 'Reps Completed', value: analytics.repsCompleted ?? 'N/A', icon: 'barbell', color: colors.teal600 },
    { label: 'Form Score', value: score != null ? `${Math.round(score)}%` : 'N/A', icon: 'trophy', color: colors.amber700 },
    { label: 'Duration', value: formatDuration(analytics.totalDuration), icon: 'time', color: colors.blue },
    { label: 'Status', value: session.status, icon: 'checkmark-circle', color: session.status === 'completed' ? colors.emerald700 : colors.slate500 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={['#1D3557', '#457B9D']} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="fitness" size={36} color={colors.white} />
          </View>
          <Text style={styles.heroName}>{exerciseName}</Text>
          <Text style={styles.heroDate}>
            {formatDate(session.startTime)} at {formatTime(session.startTime)}
          </Text>
          <View style={[styles.heroStatus, { backgroundColor: session.status === 'completed' ? colors.emerald100 : colors.slate100 }]}>
            <Text style={[styles.heroStatusText, { color: session.status === 'completed' ? colors.emerald700 : colors.slate600 }]}>
              {session.status?.toUpperCase()}
            </Text>
          </View>
        </LinearGradient>

        {/* Metrics */}
        <View style={styles.metricsGrid}>
          {metricCards.map((m) => (
            <View key={m.label} style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: m.color + '18' }]}>
                <Ionicons name={m.icon as any} size={22} color={m.color} />
              </View>
              <Text style={styles.metricValue}>{m.value}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Detailed Analytics */}
        {analytics && Object.keys(analytics).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analytics Breakdown</Text>
            {[
              ['Sets Attempted', analytics.setsAttempted],
              ['Sets Completed', analytics.setsCompleted],
              ['Average Angle', analytics.averageAngle != null ? `${analytics.averageAngle.toFixed(1)}°` : undefined],
              ['Peak Angle', analytics.peakAngle != null ? `${analytics.peakAngle.toFixed(1)}°` : undefined],
              ['Calories Burned', analytics.caloriesBurned != null ? `${analytics.caloriesBurned.toFixed(1)} kcal` : undefined],
            ]
              .filter(([, v]) => v != null)
              .map(([label, value]) => (
                <View key={label as string} style={styles.analyticsRow}>
                  <Text style={styles.analyticsLabel}>{label}</Text>
                  <Text style={styles.analyticsValue}>{value}</Text>
                </View>
              ))}
          </View>
        )}

        {/* Notes */}
        {session.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{session.notes}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  noData: { color: colors.slate500, fontSize: 15 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.h3, color: colors.navy },
  content: { paddingBottom: 80 },
  hero: {
    alignItems: 'center', padding: spacing.xl, gap: spacing.sm,
  },
  heroIcon: {
    width: 72, height: 72, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroName: { color: colors.white, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  heroDate: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  heroStatus: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, marginTop: spacing.sm },
  heroStatusText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  metricsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    padding: spacing.md,
  },
  metricCard: {
    flex: 1, minWidth: '45%', backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center', gap: spacing.xs,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metricIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 22, fontWeight: '800', color: colors.navy },
  metricLabel: { fontSize: 11, fontWeight: '700', color: colors.slate500, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.8 },
  section: { padding: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: spacing.sm },
  analyticsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  analyticsLabel: { fontSize: 14, color: colors.slate600 },
  analyticsValue: { fontSize: 14, fontWeight: '700', color: colors.navy },
  notesCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md },
  notesText: { fontSize: 14, color: colors.slate700, lineHeight: 22 },
});
