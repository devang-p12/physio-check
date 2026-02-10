import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Heart, TrendingUp, Calendar, Clock, Award } from 'lucide-react';

const PatientSessionHistory = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, today, week

  useEffect(() => {
    fetchSessions();
  }, [filter]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/session/history?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(filterSessions(data.sessions));
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSessions = (allSessions) => {
    const now = new Date();
    return allSessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      
      switch(filter) {
        case 'today':
          return sessionDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return sessionDate > weekAgo;
        default:
          return true;
      }
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getFormScoreColor = (score) => {
    if (score >= 85) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-blue-600 bg-blue-50';
    if (score >= 50) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Session History</h1>
              <p className="text-sm text-slate-500 mt-1">{sessions.length} total sessions</p>
            </div>
            <button
              onClick={() => navigate('/patient')}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-4">
            {['all', 'today', 'week'].map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === filterOption
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filterOption === 'all' ? 'All Time' : 
                 filterOption === 'today' ? 'Today' : 'This Week'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No sessions found</h3>
            <p className="text-slate-500">Start your first exercise session to see it here!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session._id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 cursor-pointer"
                onClick={() => navigate(`/patient/session/details/${session._id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Session Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-2 h-2 rounded-full ${
                        session.status === 'completed' ? 'bg-green-500' : 
                        session.status === 'active' ? 'bg-blue-500 animate-pulse' : 
                        'bg-red-500'
                      }`} />
                      <h3 className="text-lg font-semibold text-slate-900">
                        {session.assignmentId?.exerciseId?.name || 'Exercise Session'}
                      </h3>
                    </div>

                    {/* Session Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">

                      {/* Start Time */}
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock size={16} className="text-slate-500" />
                          <span className="text-xs font-medium text-slate-500">Started</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDate(session.startTime)}
                        </p>
                      </div>

                      {/* End Time */}
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock size={16} className="text-slate-500" />
                          <span className="text-xs font-medium text-slate-500">Ended</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {session.endTime ? formatDate(session.endTime) : 'In Progress'}
                        </p>
                      </div>

                      {/* Duration */}
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp size={16} className="text-slate-500" />
                          <span className="text-xs font-medium text-slate-500">Duration</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {session.startTime && session.endTime 
                            ? formatDuration(Math.floor((new Date(session.endTime) - new Date(session.startTime)) / 1000))
                            : session.status === 'active' 
                              ? 'In Progress' 
                              : 'N/A'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Analytics Grid */}
                    {session.analytics && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* Heart Rate */}
                        {session.analytics.avgHeartRate && (
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-red-50 rounded-lg">
                              <Heart size={20} className="text-red-500" fill="currentColor" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Avg HR</p>
                              <p className="text-lg font-bold text-slate-900">
                                {session.analytics.avgHeartRate}
                                <span className="text-xs font-normal text-slate-500 ml-1">bpm</span>
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Reps */}
                        {session.analytics.repsCompleted !== undefined && (
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <Activity size={20} className="text-blue-500" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Reps</p>
                              <p className="text-lg font-bold text-slate-900">
                                {session.analytics.repsCompleted}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Form Score */}
                        {session.analytics.formQuality?.score !== undefined && (
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-purple-50 rounded-lg">
                              <Award size={20} className="text-purple-500" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Form</p>
                              <p className={`text-lg font-bold ${getFormScoreColor(session.analytics.formQuality.score)}`}>
                                {Math.round(session.analytics.formQuality.score)}%
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Calories */}
                        {session.analytics.totalCalories && (
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-orange-50 rounded-lg">
                              <TrendingUp size={20} className="text-orange-500" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Calories</p>
                              <p className="text-lg font-bold text-slate-900">
                                {Math.round(session.analytics.totalCalories)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Insights */}
                    {session.analytics?.insights && session.analytics.insights.length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs font-medium text-blue-900 mb-1">💡 Insight</p>
                        <p className="text-sm text-blue-700">{session.analytics.insights[0]}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientSessionHistory;
