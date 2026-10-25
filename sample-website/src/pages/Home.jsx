import { Link } from 'react-router-dom';
import { getFeaturedBikes, allBikes } from '../data/catalogue';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';
import { SITE_URL } from '../config/siteUrl.js';
import heroImg from '../assets/images/hero_motorcycle.jpg';
import './Home.css';

const stats = [
  { value: '50,000+', label: 'Riders Worldwide' },
  { value: `${allBikes.length}`, label: 'Iconic Models' },
  { value: '120+', label: 'Dealers Across India' },
  { value: '10 Yrs', label: 'Engineering Excellence' },
];

const pillars = [
  {
    icon: '⚙️',
    title: 'Engineering First',
    desc: 'Every component is precision-engineered for performance, reliability, and longevity.',
  },
  {
    icon: '🎨',
    title: 'Designed to Inspire',
    desc: 'Timeless aesthetics that turn every ride into a statement. Built to be noticed.',
  },
  {
    icon: '🛡️',
    title: 'Built to Last',
    desc: 'Rigorous quality testing across 50+ parameters ensures your Apex Moto goes the distance.',
  },
  {
    icon: '🌏',
    title: 'Rider Community',
    desc: 'Join 50,000+ Apex Moto riders in a global community of passion, adventure, and brotherhood.',
  },
];

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Apex Moto',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
};

export default function Home() {
  const featured = getFeaturedBikes();

  return (
    <main className="home">
      <SEO
        title="Apex Moto — Born to Ride. Built to Last."
        description="Explore 18 iconic motorcycles precision-engineered for adventure, street, touring, cruising, and electric performance."
        path="/"
        schema={organizationSchema}
      />

      {/* Hero Section */}
      <section className="home-hero" aria-label="Hero banner">
        <div
          className="home-hero__bg"
          style={{ backgroundImage: `url(${heroImg})` }}
          role="img"
          aria-label="Apex Moto flagship motorcycle on a mountain road at golden hour"
        />
        <div className="home-hero__overlay" />
        <div className="home-hero__content container">
          <div className="home-hero__text">
            <span className="section-label">APEX MOTO — Est. 2014</span>
            <h1 className="home-hero__title">
              Born to Ride.<br />
              <span className="home-hero__title-accent">Built to Last.</span>
            </h1>
            <p className="home-hero__desc">
              Precision-engineered motorcycles forged for those who demand more from every road.
              Power. Style. Character. This is the Apex difference.
            </p>
            <div className="home-hero__cta">
              <Link to="/motorcycles" className="btn btn-primary btn-lg" id="hero-explore-btn">
                Explore Motorcycles →
              </Link>
              <Link to="/book-test-ride" className="btn btn-outline btn-lg" id="hero-testrip-btn">
                Book a Test Ride
              </Link>
              <Link to="/dealers" className="btn btn-ghost btn-lg" id="hero-dealer-btn">
                Find a Dealer
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="home-hero__scroll" aria-hidden="true">
          <div className="home-hero__scroll-dot" />
        </div>
      </section>

      {/* Stats Banner */}
      <section className="home-stats" aria-label="Brand statistics">
        <div className="container">
          <div className="home-stats__grid">
            {stats.map((stat, i) => (
              <div key={i} className="home-stats__item">
                <span className="stat-number">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Motorcycles */}
      <section className="section home-featured" aria-label="Featured motorcycles">
        <div className="container">
          <div className="section-header">
            <span className="section-label">Our Machines</span>
            <h2>Featured Motorcycles</h2>
            <p>From pure urban aggression to trans-continental capability. Handpicked from our line-up.</p>
          </div>

          <div className="home-featured__grid">
            {featured.map(moto => (
              <ProductCard key={moto.id} motorcycle={moto} />
            ))}
          </div>

          <div className="home-featured__all">
            <Link to="/motorcycles" className="btn btn-outline btn-lg" id="home-view-all-btn">
              View All {allBikes.length} Models →
            </Link>
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="section home-pillars" aria-label="Brand pillars">
        <div className="container">
          <div className="section-header section-header--centered">
            <span className="section-label">The Apex Standard</span>
            <h2>Built Without Compromise</h2>
            <p>Four cornerstones that define every motorcycle that leaves our facility.</p>
          </div>

          <div className="home-pillars__grid">
            {pillars.map((pillar, i) => (
              <div key={i} className="home-pillar-card">
                <span className="home-pillar-card__icon" aria-hidden="true">{pillar.icon}</span>
                <h3 className="home-pillar-card__title">{pillar.title}</h3>
                <p className="home-pillar-card__desc">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Test Ride Banner */}
      <section className="home-test-ride" aria-label="Book test ride promotion">
        <div className="container">
          <div className="home-test-ride__inner">
            <div className="home-test-ride__content">
              <span className="section-label">Feel The Ride</span>
              <h2>Ready to Experience Apex Moto?</h2>
              <p>Book a free, zero-obligation test ride at your nearest dealership today. Helmet and safety gear provided.</p>
              <div className="home-test-ride__actions">
                <Link to="/book-test-ride" className="btn btn-primary btn-lg" id="home-cta-testrip-btn">
                  Book Your Test Ride
                </Link>
                <Link to="/dealers" className="btn btn-outline btn-lg" id="home-cta-dealer-btn">
                  Find Nearest Dealer
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
