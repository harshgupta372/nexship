import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

const StatCard = ({ label, value, sub, accent }) => (
  <div style={{
    backgroundColor: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: '8px',
    padding: '24px', borderTop: `3px solid ${accent || '#1a73e8'}`,
  }}>
    <p style={{ fontSize: '12px', color: '#9aa0a6', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
    <p style={{ fontSize: '32px', fontWeight: '400', color: '#e8eaed', margin: '0 0 4px' }}>{value ?? '—'}</p>
    {sub && <p style={{ fontSize: '12px', color: '#5f6368', margin: 0 }}>{sub}</p>}
  </div>
);

const Analytics = () => {
  const [summary, setSummary]   = useState(null);
  const [avgTime, setAvgTime]   = useState(null);
  const [byStatus, setByStatus] = useState([]);
  const [agents, setAgents]     = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/summary'),
      api.get('/analytics/avg-delivery-time'),
      api.get('/analytics/orders-by-status'),
      api.get('/analytics/agent-performance'),
    ])
      .then(([s, t, b, a]) => {
        setSummary(s.data);
        setAvgTime(t.data);
        setByStatus(b.data.breakdown);
        setAgents(a.data.agents);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9aa0a6', fontFamily: 'inherit' }}>Loading analytics…</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', fontFamily: "'Google Sans', Roboto, Arial, sans-serif" }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '36px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '400', color: '#e8eaed', margin: '0 0 4px' }}>Analytics</h1>
            <p style={{ fontSize: '13px', color: '#9aa0a6', margin: 0 }}>Platform-wide shipment metrics</p>
          </div>
          <Link to="/admin" style={{
            backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '6px',
            padding: '9px 18px', fontSize: '13px', fontWeight: '500', color: '#8ab4f8',
            textDecoration: 'none',
          }}>← Orders</Link>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Total Orders"  value={summary?.totalOrders} accent="#1a73e8" />
          <StatCard label="Delivered"     value={summary?.delivered}   sub={summary?.deliveryRate}     accent="#34a853" />
          <StatCard label="Cancelled"     value={summary?.cancelled}   sub={summary?.cancellationRate} accent="#ea4335" />
          <StatCard label="In Progress"   value={summary?.inProgress}  accent="#fbbc04" />
        </div>

        {/* Avg delivery time + by status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: '8px', padding: '24px' }}>
            <p style={{ fontSize: '12px', color: '#9aa0a6', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Delivery Time</p>
            {avgTime?.avgDeliveryTimeHours != null ? (
              <>
                <p style={{ fontSize: '36px', fontWeight: '400', color: '#e8eaed', margin: '0 0 4px' }}>
                  {avgTime.avgDeliveryTimeHours}
                  <span style={{ fontSize: '16px', color: '#9aa0a6', marginLeft: '4px' }}>hrs</span>
                </p>
                <p style={{ fontSize: '12px', color: '#5f6368', margin: 0 }}>Based on {avgTime.basedOn} completed deliveries</p>
              </>
            ) : (
              <p style={{ color: '#5f6368', fontSize: '14px', margin: 0 }}>Not enough data yet</p>
            )}
          </div>

          <div style={{ backgroundColor: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: '8px', padding: '24px' }}>
            <p style={{ fontSize: '12px', color: '#9aa0a6', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Orders by Status</p>
            {byStatus.length === 0 ? (
              <p style={{ color: '#5f6368', fontSize: '14px', margin: 0 }}>No data yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {byStatus.map(({ status, count }) => (
                  <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#9aa0a6' }}>{status.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#e8eaed' }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Agent performance */}
        <div style={{ backgroundColor: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: '8px', padding: '24px' }}>
          <p style={{ fontSize: '12px', color: '#9aa0a6', margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent Performance</p>
          {agents.length === 0 ? (
            <p style={{ color: '#5f6368', fontSize: '14px', margin: 0 }}>No agent data yet</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Agent ID', 'Assigned', 'Delivered', 'Cancelled', 'Rate'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: '11px', color: '#5f6368', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: '12px', borderBottom: '1px solid #2e2e2e' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => {
                  const rate = a.assigned > 0 ? ((a.delivered / a.assigned) * 100).toFixed(0) : 0;
                  return (
                    <tr key={a.agentId} style={{ borderBottom: '1px solid #2e2e2e' }}>
                      <td style={{ padding: '12px 0', fontSize: '12px', color: '#9aa0a6', fontFamily: 'monospace' }}>{a.agentId}</td>
                      <td style={{ padding: '12px 0', fontSize: '14px', color: '#e8eaed' }}>{a.assigned}</td>
                      <td style={{ padding: '12px 0', fontSize: '14px', color: '#e8eaed' }}>{a.delivered}</td>
                      <td style={{ padding: '12px 0', fontSize: '14px', color: '#e8eaed' }}>{a.cancelled}</td>
                      <td style={{ padding: '12px 0' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: Number(rate) >= 80 ? '#34a853' : '#fbbc04' }}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
};

export default Analytics;
