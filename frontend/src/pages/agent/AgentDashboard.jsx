import { useEffect, useState } from 'react';
import api from '../../api/axios';
import StatusBadge from '../../components/StatusBadge';

const NEXT_STATUS = {
  ASSIGNED: 'PICKED_UP',
  PICKED_UP: 'IN_TRANSIT',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

const AgentDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const fetchOrders = () => {
    api.get('/orders')
      .then(({ data }) => setOrders(data.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  const advanceStatus = async (orderId, nextStatus) => {
    setUpdating(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status: nextStatus });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  const active = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status));
  const done   = orders.filter(o =>  ['DELIVERED', 'CANCELLED'].includes(o.status));

  const cardStyle = {
    backgroundColor: '#1e1e1e', border: '1px solid #2e2e2e',
    borderRadius: '8px', padding: '20px 24px',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', fontFamily: "'Google Sans', Roboto, Arial, sans-serif" }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '400', color: '#e8eaed', margin: '0 0 4px' }}>My Deliveries</h1>
          <p style={{ fontSize: '13px', color: '#9aa0a6', margin: 0 }}>{active.length} active · {done.length} completed</p>
        </div>

        {loading ? (
          <p style={{ color: '#9aa0a6', fontSize: '14px' }}>Loading…</p>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚚</div>
            <p style={{ color: '#9aa0a6', fontSize: '15px' }}>No deliveries assigned yet</p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Active</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {active.map(order => (
                    <div key={order._id} style={cardStyle}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#3a3a3a'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#2e2e2e'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#5f6368', fontFamily: 'monospace' }}>#{order._id}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '500', color: '#e8eaed' }}>{order.origin.city}</span>
                        <span style={{ color: '#5f6368' }}>→</span>
                        <span style={{ fontSize: '15px', fontWeight: '500', color: '#e8eaed' }}>{order.destination.city}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#9aa0a6', margin: '0 0 16px' }}>
                        {order.destination.address}, {order.destination.pincode}
                      </p>
                      {NEXT_STATUS[order.status] && (
                        <button
                          disabled={updating === order._id}
                          onClick={() => advanceStatus(order._id, NEXT_STATUS[order.status])}
                          style={{
                            backgroundColor: updating === order._id ? '#2a2a2a' : '#1a73e8',
                            color: updating === order._id ? '#9aa0a6' : 'white',
                            border: 'none', borderRadius: '6px', padding: '8px 18px',
                            fontSize: '13px', fontWeight: '500', cursor: updating === order._id ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit', transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={e => { if (updating !== order._id) e.target.style.backgroundColor = '#1557b0'; }}
                          onMouseLeave={e => { if (updating !== order._id) e.target.style.backgroundColor = '#1a73e8'; }}>
                          {updating === order._id ? 'Updating…' : `Mark as ${NEXT_STATUS[order.status].replace(/_/g, ' ')}`}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {done.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Completed</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {done.map(order => (
                    <div key={order._id} style={{ ...cardStyle, opacity: 0.7 }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#3a3a3a'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#2e2e2e'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: '#5f6368', fontFamily: 'monospace', display: 'block', marginBottom: '4px' }}>#{order._id}</span>
                          <span style={{ fontSize: '14px', color: '#9aa0a6' }}>{order.origin.city} → {order.destination.city}</span>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AgentDashboard;
