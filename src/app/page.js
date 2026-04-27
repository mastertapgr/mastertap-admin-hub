export default function Home() {
  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#000',
      color: '#fff',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '3rem', fontWeight: '900', letterSpacing: '-0.05em', marginBottom: '1rem' }}>
        MASTERTAP <span style={{ color: '#229ED9' }}>ADMIN HUB</span>
      </h1>
      <div style={{ 
        padding: '10px 20px', 
        borderRadius: '50px', 
        backgroundColor: 'rgba(34, 158, 217, 0.1)', 
        color: '#229ED9',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.1em'
      }}>
        ● System Operational
      </div>
      <p style={{ marginTop: '2rem', opacity: 0.5, fontSize: '0.9rem' }}>
        Central Communication Hub for Telegram Notifications
      </p>
    </div>
  );
}
