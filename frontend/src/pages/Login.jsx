import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleHome = { CUSTOMER: '/customer', AGENT: '/agent', ADMIN: '/admin' };

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(roleHome[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    padding: '13px 16px',
    fontSize: '14px',
    color: '#e8eaed',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#121212',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '0 24px' }}>

        {/* Card */}
        <div style={{
          backgroundColor: '#1e1e1e',
          border: '1px solid #2e2e2e',
          borderRadius: '12px',
          padding: '48px 40px 40px',
        }}>

          {/* Logo + title */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{
              width: '64px', height: '64px',
              background: 'linear-gradient(135deg, #1a73e8, #0d47a1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '500', color: '#e8eaed', margin: '0 0 6px' }}>
              NexShip
            </h1>
            <p style={{ fontSize: '13px', color: '#9aa0a6', margin: 0 }}>
              Shipment tracking platform
            </p>
          </div>

          {error && (
            <div style={{
              backgroundColor: '#2d1b1b',
              border: '1px solid #5c2b2b',
              borderRadius: '6px',
              padding: '11px 14px',
              marginBottom: '20px',
              color: '#f28b82',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#9aa0a6', marginBottom: '6px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#1a73e8'}
                onBlur={e => e.target.style.borderColor = '#3a3a3a'}
              />
            </div>

            <div style={{ marginBottom: '28px', marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#9aa0a6', marginBottom: '6px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#1a73e8'}
                onBlur={e => e.target.style.borderColor = '#3a3a3a'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#1a73e8',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '13px',
                fontSize: '15px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: loading ? 0.7 : 1,
                transition: 'background-color 0.15s',
                letterSpacing: '0.25px',
              }}
              onMouseEnter={e => { if (!loading) e.target.style.backgroundColor = '#1557b0'; }}
              onMouseLeave={e => { if (!loading) e.target.style.backgroundColor = '#1a73e8'; }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #2e2e2e', margin: '28px 0 20px' }} />

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#9aa0a6', margin: 0 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#8ab4f8', textDecoration: 'none', fontWeight: '500' }}>
              Create account
            </Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#5f6368' }}>
          NexShip · Shipment Tracking Platform
        </p>
      </div>
    </div>
  );
};

export default Login;
