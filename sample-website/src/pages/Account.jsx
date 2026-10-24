import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function Account() {
  return (
    <main className="account-page" style={{ padding: '6rem 0', minHeight: '65vh' }}>
      <SEO
        title="My Account — Apex Moto Rider Portal"
        description="Manage your Apex Moto rider profile, saved motorcycles, bookings, and service schedule."
        path="/account"
      />
      <div className="container" style={{ maxWidth: '640px', margin: '0 auto' }}>
        <span className="section-label">Rider Portal</span>
        <h1>My Account</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
          Welcome to the Apex Moto Rider Portal. This demo environment demonstrates member-only route access.
        </p>

        <div style={{ background: 'var(--color-bg-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <strong>Demo Rider Profile</strong>
            <p style={{ margin: '0.25rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              rider@apexmoto.in • Member since 2026
            </p>
          </div>
          <hr style={{ borderColor: 'var(--color-border)', margin: '0.5rem 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Active Test Ride Bookings:</span>
            <strong style={{ color: 'var(--color-primary)' }}>1 Pending Confirmation</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Saved Garage Models:</span>
            <strong>Thunderstrike 650</strong>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <Link to="/book-test-ride" className="btn btn-primary btn-sm">
              Book Another Ride
            </Link>
            <Link to="/motorcycles" className="btn btn-outline btn-sm">
              Explore Bikes
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
