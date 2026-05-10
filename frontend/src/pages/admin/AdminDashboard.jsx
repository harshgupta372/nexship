import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import StatusBadge from '../../components/StatusBadge';

const AdminDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [agentInputs, setAgentInputs] = useState({});

  const fetchOrders = () => {
    api.get('/orders')
      .then(({ data }) => setOrders(data.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  const assignAgent = async (orderId) => {
    const agentId = agentInputs[orderId]?.trim();
    if (!agentId) return;
    setAssigning(orderId);
    try {
      await api.patch(`/orders/${orderId}/assign`, { agentId });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Assignment failed');
    } finally {
      setAssigning(null);
    }
  };

  const pending   = orders.filter(o => o.status === 'CREATED');
  const active    = orders.filter(o => !['CREATED', 'DELIVERED', 'CANCELLED'].includes(o.status));
  const completed = orders.filter(o => ['DELIVERED', 'CANCELLED'].includes(o.status));

  const cardStyle = {
    backgroundColor: '#1e1e1e', border: '1px solid #2e2e2e',
    borderRadius: '8px', padding: '20px 24px', transition: 'border-color 0.15s',
  };

  const Section = ({ title, count, children }) => (
    <div style={{ marginBottom: '36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <p style={{ fontSize: '11px', fontWeight: '600', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>{title}</p>
        <span style={{ backgroundColor: '#2a2a2a', color: '#9aa0a6', borderRadius: '4px', padding: '1px 8px', fontSize: '11px' }}>{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', fontFamily: "'Google Sans', Roboto, Arial, sans-serif" }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '400', color: '#e8eaed', margin: '0 0 4px' }}>All Orders</h1>
            <p style={{ fontSize: '13px', color: '#9aa0a6', margin: 0 }}>{orders.length} total · {pending.length} awaiting assignment</p>
          </div>
          <Link to="/admin/analytics" style={{
            backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '6px',
            padding: '9px 18px', fontSize: '13px', fontWeight: '500', color: '#8ab4f8',
            textDecoration: 'none', transition: 'background-color 0.15s',
          }}>
            Analytics →
          </Link>
        </div>

        {loading ? (
          <p style={{ color: '#9aa0a6', fontSize: '14px' }}>Loading…</p>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <p style={{ color: '#9aa0a6', fontSize: '15px' }}>No orders in the system yet</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <Section title="Awaiting Assignment" count={pending.length}>
                {pending.map(order => (
                  <div key={order._id} style={{ ...cardStyle, borderLeft: '3px solid #f28b82' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#3a3a3a'}
                    onMouseLeave={e => e.currentTarget.style.borderLeftColor = '#f28b82'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#5f6368', fontFamily: 'monospace' }}>#{order._id}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '500', color: '#e8eaed' }}>{order.origin.city}</span>
                      <span style={{ color: '#5f6368' }}>→</span>
                      <span style={{ fontSize: '15px', fontWeight: '500', color: '#e8eaed' }}>{order.destination.city}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#9aa0a6', margin: '0 0 16px' }}>
                      Customer: {order.customerId} · {order.packageDetails.weight} kg
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        placeholder="Agent ID"
                        value={agentInputs[order._id] || ''}
                        onChange={e => setAgentInputs({ ...agentInputs, [order._id]: e.target.value })}
                        style={{
                          backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px',
                          padding: '8px 12px', fontSize: '13px', color: '#e8eaed', outline: 'none',
                          fontFamily: 'monospace', width: '220px',
                        }}
                        onFocus={e => e.target.style.borderColor = '#1a73e8'}
                        onBlur={e => e.target.style.borderColor = '#3a3a3a'}
                      />
                      <button
                        disabled={assigning === order._id}
                        onClick={() => assignAgent(order._id)}
                        style={{
                          backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px',
                          padding: '8px 16px', fontSize: '13px', fontWeight: '500',
                          cursor: assigning === order._id ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', opacity: assigning === order._id ? 0.7 : 1,
                        }}
                        onMouseEnter={e => { if (assigning !== order._id) e.target.style.backgroundColor = '#1557b0'; }}
                        onMouseLeave={e => { if (assigning !== order._id) e.target.style.backgroundColor = '#1a73e8'; }}>
                        {assigning === order._id ? 'Assigning…' : 'Assign'}
                      </button>
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {active.length > 0 && (
              <Section title="In Progress" count={active.length}>
                {active.map(order => (
                  <div key={order._id} style={cardStyle}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#3a3a3a'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#2e2e2e'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#5f6368', fontFamily: 'monospace' }}>#{order._id}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#e8eaed' }}>{order.origin.city}</span>
                      <span style={{ color: '#5f6368' }}>→</span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#e8eaed' }}>{order.destination.city}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#9aa0a6', margin: 0 }}>
                      Agent: {order.agentId} · {order.packageDetails.weight} kg
                    </p>
                  </div>
                ))}
              </Section>
            )}

            {completed.length > 0 && (
              <Section title="Completed" count={completed.length}>
                {completed.map(order => (
                  <div key={order._id} style={{ ...cardStyle, opacity: 0.6 }}
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
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
