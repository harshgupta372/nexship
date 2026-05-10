import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const PlaceOrder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    origin: { address: '', city: '', pincode: '' },
    destination: { address: '', city: '', pincode: '' },
    packageDetails: { weight: '', description: '' },
    customerEmail: user?.email || '',
  });

  const set = (section, field, value) =>
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/orders', {
        ...form,
        packageDetails: { ...form.packageDetails, weight: Number(form.packageDetails.weight) },
      });
      navigate('/customer');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', backgroundColor: '#2a2a2a',
    border: '1px solid #3a3a3a', borderRadius: '6px', padding: '11px 14px',
    fontSize: '14px', color: '#e8eaed', outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  };

  const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: '500', color: '#9aa0a6',
    marginBottom: '6px', letterSpacing: '0.3px', textTransform: 'uppercase',
  };

  const sectionStyle = {
    backgroundColor: '#1e1e1e', border: '1px solid #2e2e2e',
    borderRadius: '8px', padding: '24px',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', fontFamily: "'Google Sans', Roboto, Arial, sans-serif" }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '28px' }}>
          <Link to="/customer" style={{ fontSize: '13px', color: '#8ab4f8', textDecoration: 'none' }}>← Back</Link>
          <h1 style={{ fontSize: '24px', fontWeight: '400', color: '#e8eaed', margin: '12px 0 4px' }}>Place New Order</h1>
          <p style={{ fontSize: '13px', color: '#9aa0a6', margin: 0 }}>Fill in shipment details below</p>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#2d1b1b', border: '1px solid #5c2b2b', borderRadius: '6px',
            padding: '11px 14px', marginBottom: '20px', color: '#f28b82', fontSize: '13px',
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Pickup */}
          <div style={sectionStyle}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#8ab4f8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pickup Address</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Street Address</label>
                <input style={inputStyle} placeholder="123 Main St" required value={form.origin.address}
                  onChange={e => set('origin', 'address', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#1a73e8'}
                  onBlur={e => e.target.style.borderColor = '#3a3a3a'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input style={inputStyle} placeholder="Mumbai" required value={form.origin.city}
                    onChange={e => set('origin', 'city', e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'}
                    onBlur={e => e.target.style.borderColor = '#3a3a3a'} />
                </div>
                <div>
                  <label style={labelStyle}>Pincode</label>
                  <input style={inputStyle} placeholder="400001" required value={form.origin.pincode}
                    onChange={e => set('origin', 'pincode', e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'}
                    onBlur={e => e.target.style.borderColor = '#3a3a3a'} />
                </div>
              </div>
            </div>
          </div>

          {/* Destination */}
          <div style={sectionStyle}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#8ab4f8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Delivery Address</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Street Address</label>
                <input style={inputStyle} placeholder="456 Park Ave" required value={form.destination.address}
                  onChange={e => set('destination', 'address', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#1a73e8'}
                  onBlur={e => e.target.style.borderColor = '#3a3a3a'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input style={inputStyle} placeholder="Delhi" required value={form.destination.city}
                    onChange={e => set('destination', 'city', e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'}
                    onBlur={e => e.target.style.borderColor = '#3a3a3a'} />
                </div>
                <div>
                  <label style={labelStyle}>Pincode</label>
                  <input style={inputStyle} placeholder="110001" required value={form.destination.pincode}
                    onChange={e => set('destination', 'pincode', e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'}
                    onBlur={e => e.target.style.borderColor = '#3a3a3a'} />
                </div>
              </div>
            </div>
          </div>

          {/* Package */}
          <div style={sectionStyle}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#8ab4f8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Package Details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Weight (kg)</label>
                <input style={inputStyle} placeholder="2.5" type="number" min="0.1" step="0.1" required
                  value={form.packageDetails.weight}
                  onChange={e => set('packageDetails', 'weight', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#1a73e8'}
                  onBlur={e => e.target.style.borderColor = '#3a3a3a'} />
              </div>
              <div>
                <label style={labelStyle}>Description (optional)</label>
                <input style={inputStyle} placeholder="Electronics, clothing, etc."
                  value={form.packageDetails.description}
                  onChange={e => set('packageDetails', 'description', e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#1a73e8'}
                  onBlur={e => e.target.style.borderColor = '#3a3a3a'} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px',
            padding: '13px', fontSize: '15px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: loading ? 0.7 : 1, transition: 'background-color 0.15s',
          }}
            onMouseEnter={e => { if (!loading) e.target.style.backgroundColor = '#1557b0'; }}
            onMouseLeave={e => { if (!loading) e.target.style.backgroundColor = '#1a73e8'; }}>
            {loading ? 'Placing order…' : 'Place Order'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PlaceOrder;
