import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, typography } from '../theme';

export default function BookingScreen({ route, navigation }: any) {
  const { doctorId, doctorName } = route.params;
  const [activeTab, setActiveTab] = useState<'book' | 'appointments'>('book');
  const [slots, setSlots] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [step, setStep] = useState(1);
  const [sessionMode, setSessionMode] = useState<'online' | 'offline'>('online');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchSlots();
    fetchAppointments();
  }, []);

  const getToken = () => AsyncStorage.getItem('token');

  const fetchSlots = async () => {
    setFetching(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/patient/doctor-availability/${doctorId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {}
    setFetching(false);
  };

  const fetchAppointments = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/appointment/patient`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch {}
  };

  const handleBook = async () => {
    if (!selectedSlot || !reason.trim()) {
      Alert.alert('Error', 'Please select a slot and provide a reason.');
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/appointment/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ doctorId, startTime: selectedSlot.startTime, endTime: selectedSlot.endTime, reason, sessionMode }),
      });
      if (res.ok) {
        Alert.alert('Booked! 🎉', 'Your appointment request has been sent.');
        setStep(1); setSelectedSlot(null); setSelectedDate(null); setReason(''); setSessionMode('online');
        fetchAppointments();
        setActiveTab('appointments');
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Booking failed.');
      }
    } catch { Alert.alert('Error', 'Server error.'); }
    setLoading(false);
  };

  const groupedSlots = slots.reduce((acc: any, slot: any) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});
  const availableDates = Object.keys(groupedSlots).sort();

  const getStatusColor = (s: string) => ({
    bg: s === 'approved' ? colors.emerald100 : s === 'pending' ? colors.amber100 : colors.redLight,
    text: s === 'approved' ? colors.emerald700 : s === 'pending' ? colors.amber700 : colors.red,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Dr. {doctorName}</Text>
          <Text style={styles.headerSub}>Schedule or manage appointments</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([['book', 'Book Appointment'], ['appointments', 'My Appointments']] as const).map(([tab, label]) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'book' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {fetching ? (
            <View style={styles.center}><ActivityIndicator color={colors.teal600} /><Text style={styles.loadingText}>Loading calendar...</Text></View>
          ) : availableDates.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={48} color={colors.slate200} />
              <Text style={styles.emptyTitle}>No availability set</Text>
              <Text style={styles.emptySub}>This doctor hasn't added any available slots yet.</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={fetchSlots}>
                <Ionicons name="refresh" size={16} color={colors.teal600} />
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Step 1: Mode */}
              <View style={styles.step}>
                <Text style={styles.stepLabel}>STEP 1: CONSULTATION MODE</Text>
                <View style={styles.modeGrid}>
                  {([['online', 'videocam', 'Online Video'], ['offline', 'location', 'In-Clinic']] as const).map(([mode, icon, label]) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.modeCard, sessionMode === mode && styles.modeCardActive]}
                      onPress={() => { setSessionMode(mode); setStep(Math.max(step, 2)); }}
                    >
                      <Ionicons name={icon as any} size={28} color={sessionMode === mode ? colors.teal600 : colors.slate400} />
                      <Text style={[styles.modeLabel, sessionMode === mode && styles.modeLabelActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Step 2: Date */}
              {step >= 2 && (
                <View style={styles.step}>
                  <Text style={styles.stepLabel}>STEP 2: CHOOSE DATE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                    {availableDates.map((date) => {
                      const d = new Date(date);
                      const isSelected = selectedDate === date;
                      return (
                        <TouchableOpacity
                          key={date}
                          style={[styles.dateCard, isSelected && styles.dateCardActive]}
                          onPress={() => { setSelectedDate(date); setSelectedSlot(null); setStep(Math.max(step, 3)); }}
                        >
                          <Text style={[styles.dateDay, isSelected && styles.dateDayActive]}>
                            {d.toLocaleDateString('en-US', { weekday: 'short' })}
                          </Text>
                          <Text style={[styles.dateNum, isSelected && styles.dateNumActive]}>{d.getDate()}</Text>
                          <Text style={[styles.dateMon, isSelected && styles.dateMonActive]}>
                            {d.toLocaleDateString('en-US', { month: 'short' })}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Step 3: Time */}
              {step >= 3 && selectedDate && (
                <View style={styles.step}>
                  <Text style={styles.stepLabel}>STEP 3: CHOOSE TIME</Text>
                  <View style={styles.timesGrid}>
                    {groupedSlots[selectedDate].map((slot: any, idx: number) => {
                      const time = new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const isUnavailable = slot.status !== 'available';
                      const isSelected = selectedSlot === slot;
                      return (
                        <TouchableOpacity
                          key={idx}
                          disabled={isUnavailable}
                          onPress={() => { setSelectedSlot(slot); setStep(4); }}
                          style={[styles.timeChip,
                            isUnavailable && styles.timeChipUnavailable,
                            isSelected && styles.timeChipSelected,
                          ]}
                        >
                          <Text style={[styles.timeChipText, isSelected && styles.timeChipTextSelected, isUnavailable && styles.timeChipTextUnavailable]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Step 4: Confirm */}
              {step >= 4 && selectedSlot && (
                <View style={styles.step}>
                  <Text style={styles.stepLabel}>STEP 4: CONFIRM BOOKING</Text>
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                      <Ionicons name={sessionMode === 'online' ? 'videocam' : 'location'} size={18} color={colors.teal600} />
                      <Text style={styles.summaryLabel}>Mode</Text>
                      <Text style={styles.summaryValue}>{sessionMode} Consultation</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Ionicons name="calendar" size={18} color={colors.teal600} />
                      <Text style={styles.summaryLabel}>Date & Time</Text>
                      <Text style={styles.summaryValue}>
                        {new Date(selectedSlot.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {' '}
                        {new Date(selectedSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <TextInput
                      style={styles.reasonInput}
                      placeholder="Reason / Notes for this appointment..."
                      placeholderTextColor={colors.slate400}
                      value={reason}
                      onChangeText={setReason}
                      multiline
                      numberOfLines={3}
                    />
                    <TouchableOpacity
                      style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
                      onPress={handleBook}
                      disabled={loading}
                    >
                      {loading
                        ? <ActivityIndicator color={colors.white} />
                        : <><Ionicons name="checkmark-circle" size={20} color={colors.white} /><Text style={styles.confirmBtnText}>Confirm Booking</Text></>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        /* My Appointments Tab */
        <FlatList
          data={appointments}
          keyExtractor={(a) => a._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={48} color={colors.slate200} />
              <Text style={styles.emptyTitle}>No appointments yet</Text>
              <Text style={styles.emptySub}>Book one through the Book tab.</Text>
            </View>
          }
          renderItem={({ item: apt }) => {
            const st = getStatusColor(apt.status);
            return (
              <View style={styles.aptCard}>
                <View style={styles.aptHeader}>
                  <Text style={styles.aptDoctor}>Dr. {apt.doctorId?.name || 'Doctor'}</Text>
                  <View style={[styles.aptBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.aptBadgeText, { color: st.text }]}>{apt.status}</Text>
                  </View>
                </View>
                <View style={styles.aptMeta}>
                  <View style={styles.aptMetaRow}>
                    <Ionicons name="calendar" size={14} color={colors.slate400} />
                    <Text style={styles.aptMetaText}>
                      {new Date(apt.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={styles.aptMetaRow}>
                    <Ionicons name="time" size={14} color={colors.slate400} />
                    <Text style={styles.aptMetaText}>
                      {new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.aptMetaRow}>
                    <Ionicons name={apt.sessionMode === 'online' ? 'videocam' : 'location'} size={14} color={colors.slate400} />
                    <Text style={styles.aptMetaText}>{apt.sessionMode}</Text>
                  </View>
                </View>
                {apt.reason && <Text style={styles.aptReason}>"{apt.reason}"</Text>}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.h3, color: colors.navy },
  headerSub: { fontSize: 12, color: colors.slate500, marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.teal600 },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.slate500 },
  tabTextActive: { color: colors.teal600, fontWeight: '700' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, marginTop: 60 },
  loadingText: { color: colors.slate500, marginTop: spacing.sm },
  step: { gap: spacing.sm },
  stepLabel: { fontSize: 10, fontWeight: '800', color: colors.slate400, letterSpacing: 1.2, textTransform: 'uppercase' },
  modeGrid: { flexDirection: 'row', gap: spacing.sm },
  modeCard: {
    flex: 1, padding: spacing.md, borderRadius: radius.lg, borderWidth: 2,
    borderColor: colors.slate200, backgroundColor: colors.white, alignItems: 'center', gap: spacing.sm,
  },
  modeCardActive: { borderColor: colors.teal600, backgroundColor: colors.teal50 },
  modeLabel: { fontSize: 13, fontWeight: '700', color: colors.slate500 },
  modeLabelActive: { color: colors.teal600 },
  dateCard: {
    width: 70, height: 80, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.slate200,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dateCardActive: { borderColor: colors.teal600, backgroundColor: colors.teal600 },
  dateDay: { fontSize: 10, fontWeight: '700', color: colors.slate400, textTransform: 'uppercase' },
  dateDayActive: { color: 'rgba(255,255,255,0.8)' },
  dateNum: { fontSize: 22, fontWeight: '800', color: colors.slate900 },
  dateNumActive: { color: colors.white },
  dateMon: { fontSize: 11, color: colors.slate500 },
  dateMonActive: { color: 'rgba(255,255,255,0.8)' },
  timesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.slate200, backgroundColor: colors.white,
  },
  timeChipSelected: { borderColor: colors.teal600, backgroundColor: colors.teal600 },
  timeChipUnavailable: { backgroundColor: colors.slate50, borderColor: colors.slate100 },
  timeChipText: { fontSize: 13, fontWeight: '700', color: colors.slate700 },
  timeChipTextSelected: { color: colors.white },
  timeChipTextUnavailable: { color: colors.slate300 },
  summaryCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryLabel: { fontSize: 13, color: colors.slate500, flex: 1 },
  summaryValue: { fontSize: 13, fontWeight: '700', color: colors.navy },
  reasonInput: {
    backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.md, padding: spacing.md, fontSize: 14, color: colors.slate900,
    textAlignVertical: 'top', minHeight: 80,
  },
  confirmBtn: {
    backgroundColor: colors.teal600, borderRadius: radius.md, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  confirmBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 80 },
  aptCard: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2, gap: spacing.sm,
  },
  aptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aptDoctor: { fontSize: 15, fontWeight: '700', color: colors.slate900 },
  aptBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  aptBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  aptMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  aptMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  aptMetaText: { fontSize: 13, color: colors.slate600 },
  aptReason: { fontSize: 13, color: colors.slate500, fontStyle: 'italic' },
  emptyTitle: { ...typography.h3, color: colors.navy, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.slate500, textAlign: 'center' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  refreshText: { color: colors.teal600, fontWeight: '700' },
});
