import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch, API_BASE } from '../api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, typography } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const QUOTES = [
  { text: 'Movement is medicine for creating change.', author: 'Carol Welch' },
  { text: 'Take care of your body. It\'s the only place you have to live.', author: 'Jim Rohn' },
  { text: 'Healing is a matter of time, but also opportunity.', author: 'Hippocrates' },
  { text: 'Your body can stand almost anything.', author: 'Unknown' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen({ navigation }: any) {
  const { name, logout } = useAuth();
  const [exercises, setExercises] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteIdx] = useState(Math.floor(Math.random() * QUOTES.length));

  const fetchData = async () => {
    try {
      const data = await apiFetch('/patient/todays-exercises');
      setExercises(data.exercises || []);
      setStreak(data.streak ?? 0);
      setTotalSessions(data.totalSessions ?? 0);
    } catch {}

    try {
      const token = await AsyncStorage.getItem('token');
      const aptRes = await fetch(`${API_BASE}/appointment/patient`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const aptData = await aptRes.json();
      if (aptData.appointments) {
        const upcoming = aptData.appointments
          .filter((a: any) => new Date(a.startTime) > new Date())
          .slice(0, 2);
        setUpcomingAppointments(upcoming);
      }
    } catch {}

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const completedCount = exercises.filter((e: any) => e.completedToday).length;
  const totalCount = exercises.length;
  const adherence = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const stats = [
    { label: 'Day Streak', value: streak, icon: 'flame', color: colors.red },
    { label: 'Total Sessions', value: totalSessions, icon: 'fitness', color: colors.teal600 },
    { label: 'Adherence', value: `${adherence}%`, icon: 'trending-up', color: colors.blue },
    { label: 'Done Today', value: `${completedCount}/${totalCount}`, icon: 'checkmark-circle', color: colors.emerald700 },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.teal600]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <LinearGradient colors={['#1D3557', '#457B9D']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroGreeting}>{greeting()},</Text>
            <Text style={styles.heroName}>{name || 'Patient'} 👋</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        {/* Quote */}
        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>"{QUOTES[quoteIdx].text}"</Text>
          <Text style={styles.quoteAuthor}>— {QUOTES[quoteIdx].author}</Text>
        </View>

        {/* Progress Ring */}
        <View style={styles.progressRow}>
          <View style={styles.progressCircle}>
            <Text style={styles.progressPercent}>{adherence}%</Text>
            <Text style={styles.progressLabel}>Today</Text>
          </View>
          <View style={styles.progressInfo}>
            <Text style={styles.progressTitle}>Today's Progress</Text>
            <Text style={styles.progressSub}>
              <Text style={styles.progressBold}>{completedCount}/{totalCount}</Text> exercises done
            </Text>
            <Text style={styles.progressStreak}>
              <Text style={styles.progressBold}>{streak}</Text> day streak 🔥
            </Text>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={[styles.ctaBtn, totalCount === 0 && styles.ctaBtnDisabled]}
          onPress={() => navigation.navigate('TodaysPlan')}
          disabled={totalCount === 0}
          activeOpacity={0.85}
        >
          <Ionicons name="play-circle" size={22} color={colors.navy} />
          <Text style={styles.ctaBtnText}>Open Today's Plan</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                <Ionicons name={s.icon as any} size={22} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            { label: "Today's Plan", icon: 'list', screen: 'TodaysPlan', color: colors.teal600 },
            { label: 'Session History', icon: 'time', screen: 'SessionHistory', color: colors.blue },
            { label: 'Find Doctors', icon: 'medical', screen: 'Doctors', color: colors.navy },
            { label: 'My Profile', icon: 'person', screen: 'Profile', color: colors.emerald700 },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionCard}
              onPress={() => navigation.navigate(a.screen)}
              activeOpacity={0.82}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color + '18' }]}>
                <Ionicons name={a.icon as any} size={26} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
          {upcomingAppointments.map((apt: any) => (
            <View key={apt._id} style={styles.aptCard}>
              <View style={styles.aptIcon}>
                <Ionicons name="calendar" size={20} color={colors.teal600} />
              </View>
              <View style={styles.aptInfo}>
                <Text style={styles.aptDoctor}>Dr. {apt.doctorId?.name || 'Doctor'}</Text>
                <Text style={styles.aptTime}>
                  {new Date(apt.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                  at {new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={[styles.aptBadge, { backgroundColor: apt.status === 'approved' ? colors.emerald100 : colors.amber100 }]}>
                <Text style={[styles.aptBadgeText, { color: apt.status === 'approved' ? colors.emerald700 : colors.amber700 }]}>
                  {apt.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Today's Exercises Preview */}
      {exercises.length > 0 && (
        <View style={[styles.section, { marginBottom: spacing.xxl }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Exercises</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TodaysPlan')}>
              <Text style={styles.seeAll}>See All →</Text>
            </TouchableOpacity>
          </View>
          {exercises.slice(0, 3).map((ex: any, i: number) => (
            <View key={i} style={styles.exCard}>
              <View style={[styles.exIcon, ex.completedToday && styles.exIconDone]}>
                <Ionicons
                  name={ex.completedToday ? 'checkmark-circle' : 'barbell'}
                  size={20}
                  color={ex.completedToday ? colors.teal600 : colors.slate500}
                />
              </View>
              <View style={styles.exInfo}>
                <Text style={styles.exName}>
                  {ex.customTemplate?.name ?? ex.exercise?.name ?? `Exercise #${i + 1}`}
                </Text>
                <Text style={styles.exSub}>
                  {ex.prescription ? (() => {
                    try {
                      const p = typeof ex.prescription === 'string' ? JSON.parse(ex.prescription) : ex.prescription;
                      return `${p.sets} sets × ${p.repsPerSet} reps`;
                    } catch { return ''; }
                  })() : ''}
                </Text>
              </View>
              <View style={[styles.exBadge, ex.completedToday ? styles.exBadgeDone : styles.exBadgePending]}>
                <Text style={[styles.exBadgeText, ex.completedToday ? styles.exBadgeTextDone : styles.exBadgeTextPending]}>
                  {ex.completedToday ? 'Done' : 'Pending'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  content: { paddingBottom: spacing.xxl },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50 },

  hero: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  heroGreeting: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500' },
  heroName: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 2 },
  logoutBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md },

  quoteCard: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  quoteText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontStyle: 'italic', lineHeight: 20 },
  quoteAuthor: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6, fontWeight: '600' },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  progressCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  progressPercent: { color: colors.white, fontSize: 20, fontWeight: '800' },
  progressLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' },
  progressInfo: { flex: 1 },
  progressTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  progressSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginBottom: 2 },
  progressStreak: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  progressBold: { fontWeight: '800', color: colors.white },

  ctaBtn: {
    backgroundColor: colors.cream, borderRadius: radius.md, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { color: colors.navy, fontSize: 15, fontWeight: '800' },

  section: { padding: spacing.md, paddingBottom: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: spacing.sm },
  seeAll: { color: colors.teal600, fontSize: 13, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    flex: 1, minWidth: (width - spacing.md * 2 - spacing.sm) / 2 - spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.navy },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  actionCard: {
    flex: 1, minWidth: (width - spacing.md * 2 - spacing.sm) / 2 - spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center', gap: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700', color: colors.slate700, textAlign: 'center' },

  aptCard: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  aptIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.teal50, alignItems: 'center', justifyContent: 'center' },
  aptInfo: { flex: 1 },
  aptDoctor: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  aptTime: { fontSize: 12, color: colors.slate500, marginTop: 2 },
  aptBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  aptBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  exCard: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  exIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  exIconDone: { backgroundColor: colors.teal50 },
  exInfo: { flex: 1 },
  exName: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  exSub: { fontSize: 12, color: colors.slate500, marginTop: 2 },
  exBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  exBadgeDone: { backgroundColor: colors.emerald100 },
  exBadgePending: { backgroundColor: colors.slate100 },
  exBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  exBadgeTextDone: { color: colors.emerald700 },
  exBadgeTextPending: { color: colors.slate500 },
});
