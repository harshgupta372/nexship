import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import StatusBadge from '../../components/StatusBadge';

const CustomerDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders')
      .then(({ data }) => setOrders(data.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', fontFamily: "'Google Sans', Roboto, Arial, sans-serif" }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '400', color: '#e8eaed', margin: '0 0 4px' }}>My Shipments</h1>
            <p style={{ fontSize: '13px', color: '#9aa0a6', margin: 0 }}>{orders.length} order{orders.length !== 1 ? 's' : ''} total</p>
          </div>
          <Link to="/customer/place-order" style={{
            backgroundColor: '#1a73e8', color: 'white', textDecoration: 'none',
            borderRadius: '6px', padding: '10px 20px', fontSize: '14px', fontWeight: '500',
            letterSpacing: '0.25px',
          }}>
            + New Order
          </Link>
        </div>

        {loading ? (
          <p style={{ color: '#9aa0a6', fontSize: '14px' }}>Loading…</p>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
            <p style={{ color: '#9aa0a6', fontSize: '15px', marginBottom: '16px' }}>No shipments yet</p>
            <Link to="/customer/place-order" style={{ color: '#8ab4f8', fontSize: '14px', textDecoration: 'none', fontWeight: '500' }}>
              Place your first order →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {orders.map((order) => (
              <div key={order._id} style={{
                backgroundColor: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: '8px', padding: '20px 24px',
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3a3a3a'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#2e2e2e'}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#5f6368', fontFamily: 'monospace' }}>#{order._id}</span>
                  <StatusBadge status={order.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '500', color: '#e8eaed' }}>{order.origin.city}</span>
                  <span style={{ color: '#5f6368', fontSize: '14px' }}>→</span>
                  <span style={{ fontSize: '15px', fontWeight: '500', color: '#e8eaed' }}>{order.destination.city}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#9aa0a6' }}>
                    {order.packageDetails.weight} kg · {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <Link to={`/customer/track/${order._id}`} style={{ fontSize: '13px', color: '#8ab4f8', textDecoration: 'none', fontWeight: '500' }}>
                    Track →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDashboard;
