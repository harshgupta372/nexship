import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import StatusBadge from '../../components/StatusBadge';

const TrackOrder = () => {
  const { orderId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/tracking/${orderId}`)
      .then(({ data }) => setData(data))
      .catch(() => setError('Could not load tracking info'))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', fontFamily: "'Google Sans', Roboto, Arial, sans-serif" }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 24px' }}>
        <Link to="/customer" style={{ fontSize: '13px', color: '#8ab4f8', textDecoration: 'none' }}>← Back</Link>

        <div style={{ margin: '16px 0 32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '400', color: '#e8eaed', margin: '0 0 6px' }}>Track Shipment</h1>
          <p style={{ fontSize: '12px', color: '#5f6368', margin: 0, fontFamily: 'monospace' }}>#{orderId}</p>
        </div>

        {loading && <p style={{ color: '#9aa0a6', fontSize: '14px' }}>Loading…</p>}
        {error && <p style={{ color: '#f28b82', fontSize: '14px' }}>{error}</p>}

        {data && (
          <>
            <div style={{
              backgroundColor: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: '8px',
              padding: '20px 24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <span style={{ fontSize: '13px', color: '#9aa0a6' }}>Current status</span>
              <StatusBadge status={data.currentStatus} />
            </div>

            {/* Timeline */}
            <div style={{ position: 'relative', paddingLeft: '28px' }}>
              <div style={{
                position: 'absolute', left: '7px', top: '8px', bottom: '8px',
                width: '2px', backgroundColor: '#2e2e2e',
              }} />

              {[...data.timeline].reverse().map((event, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: '16px' }}>
                  <div style={{
                    position: 'absolute', left: '-24px', top: '16px',
                    width: '10px', height: '10px', borderRadius: '50%',
                    backgroundColor: i === 0 ? '#1a73e8' : '#3a3a3a',
                    border: `2px solid ${i === 0 ? '#1a73e8' : '#2e2e2e'}`,
                  }} />
                  <div style={{
                    backgroundColor: '#1e1e1e', border: `1px solid ${i === 0 ? '#1a73e8' : '#2e2e2e'}`,
                    borderRadius: '8px', padding: '16px 20px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: event.note ? '8px' : 0 }}>
                      <StatusBadge status={event.status} />
                      <span style={{ fontSize: '12px', color: '#5f6368' }}>
                        {new Date(event.occurredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {event.note && <p style={{ fontSize: '13px', color: '#9aa0a6', margin: 0 }}>{event.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TrackOrder;
