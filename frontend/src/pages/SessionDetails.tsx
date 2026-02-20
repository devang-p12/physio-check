import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Activity, TrendingUp, Clock, Award, AlertCircle } from 'lucide-react';

const SessionDetails = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [googleFitData, setGoogleFitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingFitData, setLoadingFitData] = useState(false);

  useEffect(() => {
    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/session/${sessionId}/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Session data:', JSON.stringify(data, null, 2));
        setSession(data);
        
        // If session has timestamps and was tracked mode, fetch Google Fit data
        if (data.session?.startTime && data.session?.endTime) {
          // try doctor endpoint first (if viewing as doctor), else fallback to patient endpoint
          // attempt to extract patientId from returned session
          const patientId = data.session?.patientId?._id || data.session?.patientId || data.session?.assignmentId?.patientId?._id || data.session?.assignmentId?.patientId;
          fetchGoogleFitData(data.session.startTime, data.session.endTime, patientId);
        }
      }
    } catch (error) {
      console.error('Error fetching session details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoogleFitData = async (startTime: string, endTime: string, patientId?: string) => {
    setLoadingFitData(true);
    try {
      const token = localStorage.getItem('token');
      // Expand time window: subtract 30 minutes from start, add 30 minutes to end
      const adjustedStart = new Date(new Date(startTime).getTime() - 30 * 60 * 1000).toISOString();
      const adjustedEnd = new Date(new Date(endTime).getTime() + 30 * 60 * 1000).toISOString();

      // If we have a patientId, try the doctor endpoint first
      if (patientId) {
        try {
          const doctorRes = await fetch(`http://localhost:5000/doctor/patient/${patientId}/google-fit?startTime=${adjustedStart}&endTime=${adjustedEnd}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (doctorRes.ok) {
            const data = await doctorRes.json();
            setGoogleFitData(data);
            console.log('Google Fit (doctor) data fetched:', data);
            return;
          }
          // if forbidden or other error, fall through to patient endpoint
          console.warn('Doctor google-fit fetch failed, falling back to patient endpoint:', doctorRes.status);
        } catch (err) {
          console.warn('Error calling doctor google-fit endpoint, falling back:', err);
        }
      }

      // Fallback: call the patient-only endpoint
      const response = await fetch(
        `http://localhost:5000/google-fit/history?startTime=${adjustedStart}&endTime=${adjustedEnd}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setGoogleFitData(data);
        console.log('Google Fit (patient) data fetched:', data);
      } else {
        console.log('Google Fit data not available (patient endpoint)');
      }
    } catch (error) {
      console.error('Error fetching Google Fit data:', error);
    } finally {
      setLoadingFitData(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Session not found</h3>
        </div>
      </div>
    );
  }

  const { analytics } = session;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {session.session?.assignmentId?.exerciseId?.name || 'Session Details'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {formatDate(session.session.startTime)}
          </p>
          {analytics?.repsCompleted !== undefined && (
            <p className="text-sm text-slate-600 mt-1">
              {analytics.repsCompleted} reps completed
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Key Metrics */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Performance Metrics</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {/* Start Time */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={20} className="text-slate-600" />
                    <span className="text-xs text-slate-500 font-medium">Started</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {session.session?.startTime ? new Date(session.session.startTime).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit'
                    }) : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {session.session?.startTime ? new Date(session.session.startTime).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    }) : ''}
                  </p>
                </div>

                {/* End Time */}
                {session.session?.endTime && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={20} className="text-slate-600" />
                      <span className="text-xs text-slate-500 font-medium">Ended</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {new Date(session.session.endTime).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(session.session.endTime).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                )}

                {/* Duration - Calculate from timestamps */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={20} className="text-slate-600" />
                    <span className="text-xs text-slate-500 font-medium">Duration</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {session.session?.startTime && session.session?.endTime 
                      ? formatDuration(Math.floor((new Date(session.session.endTime) - new Date(session.session.startTime)) / 1000))
                      : formatDuration(analytics?.totalDuration || 0)
                    }
                  </p>
                </div>

                {/* Avg Heart Rate - Always show for tracked sessions */}
                {session.session?.requiresSensorData && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart size={20} className="text-red-500" fill="currentColor" />
                      <span className="text-xs text-slate-500 font-medium">Avg Heart Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-red-900">
                      {googleFitData?.avgHeartRate || analytics?.avgHeartRate || 'N/A'}
                      {googleFitData?.avgHeartRate && <span className="text-sm ml-1">bpm</span>}
                    </p>
                    {loadingFitData && <span className="text-xs text-slate-400">Loading...</span>}
                    {!loadingFitData && !googleFitData?.avgHeartRate && !analytics?.avgHeartRate && (
                      <span className="text-xs text-slate-400">Not available</span>
                    )}
                  </div>
                )}

                {/* Calories - Always show for tracked sessions */}
                {session.session?.requiresSensorData && (
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={20} className="text-orange-500" />
                      <span className="text-xs text-slate-500 font-medium">Calories</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-900">
                      {googleFitData?.totalCalories ? Math.round(googleFitData.totalCalories) : (analytics?.totalCalories ? Math.round(analytics.totalCalories) : 'N/A')}
                    </p>
                    {loadingFitData && <span className="text-xs text-slate-400">Loading...</span>}
                    {!loadingFitData && !googleFitData?.totalCalories && !analytics?.totalCalories && (
                      <span className="text-xs text-slate-400">Not available</span>
                    )}
                  </div>
                )}

                {/* Reps */}
                {analytics?.repsCompleted !== undefined && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={20} className="text-blue-500" />
                      <span className="text-xs text-blue-600 font-medium">Reps</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      {analytics.repsCompleted}
                    </p>
                  </div>
                )}

                {/* Form Score */}
                {analytics?.formQuality?.score !== undefined && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Award size={20} className="text-purple-500" />
                      <span className="text-xs text-purple-600 font-medium">Form</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">
                      {Math.round(analytics.formQuality.score)}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Heart Rate Zones - Only show if data exists */}
            {analytics?.intensityZones && Object.keys(analytics.intensityZones).length > 0 && Object.values(analytics.intensityZones).some(v => v > 0) && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Heart Rate Zones</h2>
                <div className="space-y-3">
                  {Object.entries(analytics.intensityZones).map(([zone, seconds]) => {
                    const total = Object.values(analytics.intensityZones).reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? (seconds / total) * 100 : 0;
                    
                    const zoneColors = {
                      low: 'bg-blue-500',
                      moderate: 'bg-green-500',
                      high: 'bg-orange-500',
                      peak: 'bg-red-500'
                    };

                    return (
                      <div key={zone}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700 capitalize">{zone}</span>
                          <span className="text-slate-500">{formatDuration(seconds)}</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${zoneColors[zone]} transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Form Issues */}
            {analytics?.formQuality?.issues && analytics.formQuality.issues.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Form Issues Detected</h2>
                <ul className="space-y-2">
                  {analytics.formQuality.issues.map((issue, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                      <AlertCircle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Google Fit Data Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Google Fit Data</h2>
            {loadingFitData ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-2"></div>
                <p className="text-sm text-slate-500">Loading Google Fit data...</p>
              </div>
            ) : googleFitData ? (
              <div className="space-y-4">
                {googleFitData.available ? (
                  <>
                    {/* Display actual Google Fit data */}
                    {googleFitData.avgHeartRate && (
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                        <span className="text-sm font-medium text-red-900">Avg Heart Rate</span>
                        <span className="text-lg font-bold text-red-900">{googleFitData.avgHeartRate} bpm</span>
                      </div>
                    )}
                    {googleFitData.totalCalories && (
                      <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                        <span className="text-sm font-medium text-orange-900">Calories Burned</span>
                        <span className="text-lg font-bold text-orange-900">{Math.round(googleFitData.totalCalories)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <Activity size={48} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500 mb-2">Google Fit data not available</p>
                    <p className="text-xs text-slate-400">{googleFitData.message || 'API integration pending'}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <Activity size={48} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">No Google Fit data fetched</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Insights */}
            {analytics?.insights && analytics.insights.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-3">💡 Insights</h2>
                <ul className="space-y-2">
                  {analytics.insights.map((insight, index) => (
                    <li key={index} className="text-sm text-blue-800">{insight}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {analytics?.recommendations && analytics.recommendations.length > 0 && (
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-teal-900 mb-3">📋 Recommendations</h2>
                <ul className="space-y-2">
                  {analytics.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-teal-800">{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Session Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Session Info</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-medium text-slate-900 capitalize">{session.session.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Data Points</dt>
                  <dd className="font-medium text-slate-900">{session.session.dataPointsCollected}</dd>
                </div>
                {analytics?.averageDataRate && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Data Rate</dt>
                    <dd className="font-medium text-slate-900">{analytics.averageDataRate} pts/s</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDetails;
