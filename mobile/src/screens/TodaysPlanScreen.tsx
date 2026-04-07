import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../api';
import { colors, spacing, radius, typography } from '../theme';

export default function TodaysPlanScreen({ navigation }: any) {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const data = await apiFetch('/patient/todays-exercises');
      setExercises(data.exercises || []);
    } catch {
      Alert.alert('Error', 'Could not load today\'s plan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const completedCount = exercises.filter((e: any) => e.completedToday).length;
  const totalCount = exercises.length;

  const getPrescription = (ex: any) => {
    try {
      const p = typeof ex.prescription === 'string' ? JSON.parse(ex.prescription) : ex.prescription;
      return p;
    } catch { return null; }
  };

  const renderItem = ({ item: ex }: { item: any }) => {
    const p = getPrescription(ex);
    const tolerance = p?.tolerance ?? 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={[styles.exIcon, ex.completedToday && styles.exIconDone]}>
            <Ionicons
              name={ex.completedToday ? 'checkmark-circle' : 'barbell'}
              size={22}
              color={ex.completedToday ? colors.teal600 : colors.slate500}
            />
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.exName}>
            {ex.customTemplate?.name ?? ex.exercise?.name ?? 'Exercise'}
          </Text>
          {ex.customTemplateId && (
            <View style={styles.customBadge}>
              <Text style={styles.customBadgeText}>CUSTOM</Text>
            </View>
          )}
          {p && (
            <Text style={styles.prescription}>
              {p.sets} sets × {p.repsPerSet} reps
              {tolerance > 0 ? `  ±${tolerance}° ease` : '  • Strict Form'}
            </Text>
          )}
          {ex.exercise?.duration && (
            <Text style={styles.duration}>
              ~{ex.exercise.duration}s hold
            </Text>
          )}
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, ex.completedToday ? styles.statusDone : styles.statusPending]}>
            <Text style={[styles.statusText, ex.completedToday ? styles.statusTextDone : styles.statusTextPending]}>
              {ex.completedToday ? 'DONE' : 'PENDING'}
            </Text>
          </View>
        </View>
      </View>
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Today's Plan</Text>
          <Text style={styles.headerSub}>{completedCount} of {totalCount} completed</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' as any }]} />
      </View>

      {exercises.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle" size={56} color={colors.teal100} />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySub}>No exercises assigned for today, or all completed.</Text>
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[colors.teal600]} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.h3, color: colors.navy },
  headerSub: { fontSize: 12, color: colors.slate500, marginTop: 2 },

  progressBarBg: { height: 4, backgroundColor: colors.slate200 },
  progressBarFill: { height: 4, backgroundColor: colors.teal600 },

  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 80 },

  card: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardLeft: {},
  cardBody: { flex: 1 },
  cardRight: {},

  exIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center',
  },
  exIconDone: { backgroundColor: colors.teal50 },

  exName: { fontSize: 15, fontWeight: '700', color: colors.slate900 },
  customBadge: {
    backgroundColor: colors.teal50, borderRadius: 4, alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
  },
  customBadgeText: { fontSize: 9, fontWeight: '800', color: colors.teal700, letterSpacing: 0.8 },
  prescription: { fontSize: 12, color: colors.slate500, marginTop: 4 },
  duration: { fontSize: 12, color: colors.blue, marginTop: 2 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  statusDone: { backgroundColor: colors.emerald100 },
  statusPending: { backgroundColor: colors.slate100 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  statusTextDone: { color: colors.emerald700 },
  statusTextPending: { color: colors.slate500 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyTitle: { ...typography.h2, color: colors.navy, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.slate500, textAlign: 'center' },
});
