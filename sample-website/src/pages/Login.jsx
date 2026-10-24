import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function Login() {
  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <main className="login-page" style={{ padding: '6rem 0', minHeight: '65vh' }}>
      <SEO
        title="Rider Login — Apex Moto"
        description="Sign in to your Apex Moto account to manage test rides, motorcycle orders, and service history."
        path="/login"
      />
      <div className="container" style={{ maxWidth: '440px', margin: '0 auto' }}>
        <span className="section-label">Portal Access</span>
        <h1>Rider Login</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
          Enter your registered email or phone to access your Apex Moto account.
        </p>

        <form onSubmit={handleSubmit} style={{ background: 'var(--color-bg-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email or Mobile Number</label>
            <input
              id="login-email"
              type="text"
              className="form-control"
              placeholder="rider@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            Sign In
          </button>

          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: '0.5rem 0 0' }}>
            Demo notice: Authentication is simulated. No credentials are required.
          </p>

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Link to="/account" className="btn btn-ghost btn-sm" style={{ width: '100%' }}>
              Continue as Guest to Account →
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
