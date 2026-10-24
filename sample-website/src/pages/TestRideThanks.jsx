import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function TestRideThanks() {
  return (
    <main className="thanks-page" style={{ padding: '6rem 0', minHeight: '65vh', display: 'flex', alignItems: 'center' }}>
      <SEO
        title="Test Ride Booking Confirmed"
        description="Your test ride request has been confirmed. Our team will contact you shortly."
        path="/book-test-ride/thanks"
      />
      <div className="container" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }} aria-hidden="true">
          ✅
        </div>
        <span className="section-label">Booking Confirmed</span>
        <h1 style={{ fontSize: '2.5rem', margin: '0.5rem 0 1rem' }}>Test Ride Booking Confirmed</h1>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '2rem' }}>
          Thank you for choosing Apex Moto! Your test ride appointment request has been logged successfully. An authorized dealer representative will call you within 24 hours to confirm your scheduled slot and provide riding guidelines.
        </p>

        <div style={{ background: 'var(--color-bg-card)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', marginBottom: '2.5rem', textAlign: 'left' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Reminder: What to bring on the day</h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            <li>Original two-wheeler driving licence</li>
            <li>Closed-toe footwear or riding boots</li>
            <li>Riding jacket and helmet (if you prefer your own)</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/motorcycles" className="btn btn-primary">
            Explore All Motorcycles
          </Link>
          <Link to="/" className="btn btn-outline">
            Return to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
