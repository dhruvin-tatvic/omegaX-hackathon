import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './NotFound.css';

export default function NotFound() {
  return (
    <main className="not-found-page">
      <SEO
        title="404 — Road Ended Here | Apex Moto"
        description="The page you are looking for has been moved or does not exist."
        path="/404"
      />
      <div className="not-found__card">
        <div className="not-found__code">404</div>
        <h1 className="not-found__title">Road Ended Here</h1>
        <p className="not-found__desc">
          Looks like you took a detour off the charted route. The page you are looking for has been moved or doesn’t exist.
        </p>
        <div className="not-found__actions">
          <Link to="/" className="btn btn-primary btn-lg" id="notfound-home-btn">
            Back to Home
          </Link>
          <Link to="/motorcycles" className="btn btn-outline btn-lg" id="notfound-bikes-btn">
            Explore Bikes
          </Link>
        </div>
      </div>
    </main>
  );
}
