import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, typography } from '../theme';

export default function DoctorsScreen({ navigation }: any) {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchDoctors = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/patient`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDoctors(data.doctors);
        setError('');
      } else {
        setError(data.message || 'Failed to load doctors');
      }
    } catch {
      setError('Connection error. Is the backend running?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchDoctors(); }, []));

  const filtered = doctors.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.email.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item: doc }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{doc.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.docName}>Dr. {doc.name}</Text>
        <Text style={styles.docEmail}>{doc.email}</Text>
        <View style={styles.specBadge}>
          <Ionicons name="medal" size={12} color={colors.teal600} />
          <Text style={styles.specText}>Physiotherapy</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.bookBtn}
        onPress={() => navigation.navigate('Booking', { doctorId: doc._id, doctorName: doc.name })}
        activeOpacity={0.85}
      >
        <Text style={styles.bookBtnText}>Book</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.teal600} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Find a Doctor</Text>
          <Text style={styles.headerSub}>Browse our network of specialists</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.slate400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor={colors.slate400}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={28} color={colors.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchDoctors}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDoctors(); }} colors={[colors.teal600]} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.slate200} />
              <Text style={styles.emptyText}>No doctors found.</Text>
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
  headerSub: { fontSize: 12, color: colors.slate500, marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    margin: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.slate900 },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 80 },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.teal100, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: colors.teal700 },
  cardBody: { flex: 1 },
  docName: { fontSize: 15, fontWeight: '700', color: colors.slate900 },
  docEmail: { fontSize: 12, color: colors.slate500, marginTop: 2 },
  specBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
    backgroundColor: colors.teal50, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.sm, alignSelf: 'flex-start',
  },
  specText: { fontSize: 11, fontWeight: '700', color: colors.teal600 },
  bookBtn: {
    backgroundColor: colors.navy, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: radius.md,
  },
  bookBtnText: { color: colors.cream, fontWeight: '700', fontSize: 13 },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { color: colors.red, textAlign: 'center', fontSize: 14 },
  retryBtn: { backgroundColor: colors.slate100, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: colors.navy, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl, marginTop: 60 },
  emptyText: { fontSize: 14, color: colors.slate500 },
});
