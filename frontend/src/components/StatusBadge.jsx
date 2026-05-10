const colors = {
  CREATED:          { bg: '#1e3a2f', color: '#81c995', border: '#2d5a3d' },
  ASSIGNED:         { bg: '#1a2e4a', color: '#8ab4f8', border: '#2a4a7a' },
  PICKED_UP:        { bg: '#3a2e1a', color: '#fdd663', border: '#5a4a2a' },
  IN_TRANSIT:       { bg: '#3a2a1a', color: '#ffb74d', border: '#5a3a1a' },
  OUT_FOR_DELIVERY: { bg: '#2e1a3a', color: '#ce93d8', border: '#4a2a5a' },
  DELIVERED:        { bg: '#1e3a2f', color: '#34a853', border: '#2d5a3d' },
  CANCELLED:        { bg: '#3a1a1a', color: '#f28b82', border: '#5a2a2a' },
};

const StatusBadge = ({ status }) => {
  const c = colors[status] || { bg: '#2a2a2a', color: '#9aa0a6', border: '#3a3a3a' };
  return (
    <span style={{
      backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: '4px', padding: '3px 10px', fontSize: '11px', fontWeight: '600',
      letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

export default StatusBadge;
