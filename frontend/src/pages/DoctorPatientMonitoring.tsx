import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Activity, TrendingUp, Calendar, User } from 'lucide-react';

const DoctorPatientMonitoring = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (patientId) {
      fetchPatientPerformance();
    }
  }, [patientId]);

  const fetchPatientPerformance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/doctor/patient/${patientId}/performance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPatientData(data);
      }
    } catch (error) {
      console.error('Error fetching patient performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <User size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Patient not found</h3>
        </div>
      </div>
    );
  }

  const { patient, summary, recentSessions, assignments } = patientData;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/doctor')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft size={20} />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{patient.name}</h1>
              <p className="text-sm text-slate-500">{patient.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Activity size={24} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Sessions</p>
                <p className="text-2xl font-bold text-slate-900">{summary.totalSessions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 rounded-lg">
                <Heart size={24} className="text-red-500" fill="currentColor" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Avg Heart Rate</p>
                <p className="text-2xl font-bold text-slate-900">
                  {summary.avgHeartRate || 0}
                  <span className="text-sm font-normal text-slate-500 ml-1">bpm</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 rounded-lg">
                <TrendingUp size={24} className="text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Avg Form Score</p>
                <p className="text-2xl font-bold text-slate-900">
                  {summary.avgFormScore || 0}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-50 rounded-lg">
                <Activity size={24} className="text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Reps</p>
                <p className="text-2xl font-bold text-slate-900">{summary.totalReps || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Sessions */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Sessions</h2>
              
              {recentSessions.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No sessions yet</p>
              ) : (
                <div className="space-y-3">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 border border-slate-200 rounded-lg hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => navigate(`/doctor/session/${session.id}`)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-slate-900">{session.exerciseName}</h3>
                        <span className="text-xs text-slate-500">{formatDate(session.startTime)}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Activity size={14} className="text-slate-400" />
                          <span className="text-slate-600">{session.reps} reps</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="text-slate-600">{formatDuration(session.duration)}</span>
                        </div>
                        {session.formScore && (
                          <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            session.formScore >= 85 ? 'bg-green-100 text-green-700' :
                            session.formScore >= 70 ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            Form: {Math.round(session.formScore)}%
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assignments */}
          <div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Active Assignments</h2>
              
              {assignments.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No assignments</p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-4 border border-slate-200 rounded-lg hover:border-teal-300 transition-colors cursor-pointer"
                      onClick={() => navigate(`/doctor/assignment/${assignment.id}`)}
                    >
                      <h3 className="font-medium text-slate-900 mb-2">{assignment.exerciseName}</h3>
                      <div className="space-y-1 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span>Sessions:</span>
                          <span className="font-medium">{assignment.totalSessions}</span>
                        </div>
                        {assignment.averagePerformance?.avgHeartRate && (
                          <div className="flex justify-between">
                            <span>Avg HR:</span>
                            <span className="font-medium">{assignment.averagePerformance.avgHeartRate} bpm</span>
                          </div>
                        )}
                        {assignment.averagePerformance?.totalReps > 0 && (
                          <div className="flex justify-between">
                            <span>Total Reps:</span>
                            <span className="font-medium">{assignment.averagePerformance.totalReps}</span>
                          </div>
                        )}
                        {assignment.lastSession && (
                          <div className="flex justify-between text-slate-500 mt-2 pt-2 border-t border-slate-100">
                            <span>Last session:</span>
                            <span>{formatDate(assignment.lastSession)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorPatientMonitoring;
