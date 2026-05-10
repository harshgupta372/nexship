import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleHome = { CUSTOMER: '/customer', AGENT: '/agent', ADMIN: '/admin' };
const AUTH_PATHS = ['/login', '/register'];

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (AUTH_PATHS.includes(location.pathname)) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav style={{
      backgroundColor: '#1e1e1e', borderBottom: '1px solid #2e2e2e',
      padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <Link to={user ? roleHome[user.role] : '/'} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <div style={{
          width: '32px', height: '32px',
          background: 'linear-gradient(135deg, #1a73e8, #0d47a1)',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
        </div>
        <span style={{ fontSize: '17px', fontWeight: '500', color: '#e8eaed' }}>NexShip</span>
      </Link>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', color: '#9aa0a6' }}>
            {user.name} ·{' '}
            <span style={{ color: '#8ab4f8', fontWeight: '500' }}>{user.role}</span>
          </span>
          <button onClick={handleLogout} style={{
            backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '6px',
            padding: '7px 16px', fontSize: '13px', fontWeight: '500', color: '#e8eaed',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'background-color 0.15s',
          }}
            onMouseEnter={e => e.target.style.backgroundColor = '#2a2a2a'}
            onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
