import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import { analyticsAPI } from '../services/api';
import './AnalyticsPage.css';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

function AnalyticsPage() {
  const [distribution, setDistribution] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [intensityData, setIntensityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [dist, weekly, monthly, intensity] = await Promise.all([
        analyticsAPI.getDistribution(),
        analyticsAPI.getWeeklyStats({ weeks: 12 }),
        analyticsAPI.getMonthlyTrends({ months: 6 }),
        analyticsAPI.getIntensityDistribution()
      ]);

      setDistribution(dist.data.distribution.map(d => ({
        name: d.type,
        value: Number(d.count),
        distance: Number(d.total_distance) / 1000
      })));

      setWeeklyStats(weekly.data.weeklyStats.map(w => ({
        week: new Date(w.week).toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' }),
        activities: Number(w.activities_count),
        distance: Number(w.total_distance) / 1000,
        duration: Number(w.total_duration) / 3600
      })).reverse());

      setMonthlyTrends(monthly.data.monthlyTrends.map(m => ({
        month: new Date(m.month).toLocaleDateString('pl-PL', { month: 'long' }),
        activities: Number(m.activities_count),
        distance: Number(m.total_distance) / 1000,
        avgDistance: Number(m.avg_distance) / 1000
      })));

      setIntensityData(intensity.data.intensityDistribution.map(i => ({
        name: i.intensity === 'LOW' ? 'Niska' : i.intensity === 'MEDIUM' ? 'Średnia' : 'Wysoka',
        value: Number(i.count)
      })));
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/');
      }
      console.error('Fetch analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Ładowanie analiz...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="analytics-page">
        <h1>Analiza treningów</h1>

        <div className="chart-section">
          <h2>Rozkład typów aktywności</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h2>Statystyki tygodniowe (ostatnie 12 tygodni)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="activities" fill="#667eea" name="Liczba treningów" />
              <Bar yAxisId="right" dataKey="distance" fill="#764ba2" name="Dystans (km)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h2>Trendy miesięczne</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="distance" stroke="#667eea" name="Całkowity dystans (km)" strokeWidth={2} />
              <Line type="monotone" dataKey="avgDistance" stroke="#f093fb" name="Średni dystans (km)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h2>Rozkład intensywności</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={intensityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#43e97b" name="Liczba treningów" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  );
}

export default AnalyticsPage;
