import { Link } from 'react-router-dom';
import { getFeaturedMotorcycles } from '../data/motorcycles';
import ProductCard from '../components/ProductCard';
import heroImg from '../assets/images/hero_motorcycle.jpg';
import './Home.css';

const stats = [
  { value: '50,000+', label: 'Riders Worldwide' },
  { value: '4', label: 'Iconic Models' },
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

export default function Home() {
  const featured = getFeaturedMotorcycles();

  return (
    <main className="home">
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
            <h2>Legendary Lineup</h2>
            <p>Every Apex Moto is crafted with purpose. Find the one that matches your spirit.</p>
          </div>
          <div className="home-featured__grid">
            {featured.map(moto => (
              <ProductCard key={moto.id} motorcycle={moto} />
            ))}
          </div>
          <div className="home-featured__footer">
            <Link to="/motorcycles" className="btn btn-outline btn-lg" id="view-all-bikes-btn">
              View All Motorcycles →
            </Link>
          </div>
        </div>
      </section>

      {/* Campaign Banner */}
      <section className="home-campaign" aria-label="Promotional campaign">
        <div className="home-campaign__bg" />
        <div className="container home-campaign__inner">
          <div className="home-campaign__content">
            <span className="section-label">Limited Period Offer</span>
            <h2 className="home-campaign__title">Monsoon Mania Sale</h2>
            <p className="home-campaign__desc">
              Save up to <strong>₹25,000</strong> on the Thunderstrike 650 and Phantom 350.
              Free accessories kit and extended warranty included. Offer ends November 30, 2026.
            </p>
            <div className="home-campaign__cta">
              <Link to="/offers" className="btn btn-primary btn-lg" id="campaign-offers-btn">
                Explore Offers
              </Link>
              <Link to="/book-test-ride" className="btn btn-outline btn-lg" id="campaign-ride-btn">
                Book a Test Ride
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Pillars */}
      <section className="section home-pillars" aria-label="Brand values">
        <div className="container">
          <div className="section-header section-header--centered">
            <span className="section-label">Our Promise</span>
            <h2>The Apex Standard</h2>
            <p>Four pillars that define every motorcycle we build and every relationship we forge.</p>
          </div>
          <div className="grid-4">
            {pillars.map((p, i) => (
              <div key={i} className="home-pillar">
                <div className="home-pillar__icon" aria-hidden="true">{p.icon}</div>
                <h4 className="home-pillar__title">{p.title}</h4>
                <p className="home-pillar__desc">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lifestyle / CTA Banner */}
      <section className="home-lifestyle section" aria-label="Lifestyle call to action">
        <div className="container">
          <div className="home-lifestyle__card">
            <div className="home-lifestyle__text">
              <span className="section-label">Begin Your Journey</span>
              <h2>Your Next Adventure Starts Here</h2>
              <p>
                Visit your nearest Apex Moto dealership and experience our motorcycles for yourself.
                Our experts are ready to guide you to your perfect ride.
              </p>
              <div className="home-lifestyle__cta">
                <Link to="/dealers" className="btn btn-primary btn-lg" id="find-dealer-cta-btn">
                  Find a Dealer
                </Link>
                <Link to="/contact" className="btn btn-ghost btn-lg" id="contact-us-cta-btn">
                  Talk to Us
                </Link>
              </div>
            </div>
            <div className="home-lifestyle__icon-grid" aria-hidden="true">
              <div className="home-lifestyle__icon-item">
                <span className="home-lifestyle__big-icon">🏍️</span>
                <span>Test Ride</span>
              </div>
              <div className="home-lifestyle__icon-item">
                <span className="home-lifestyle__big-icon">🔧</span>
                <span>Expert Service</span>
              </div>
              <div className="home-lifestyle__icon-item">
                <span className="home-lifestyle__big-icon">💳</span>
                <span>Easy Finance</span>
              </div>
              <div className="home-lifestyle__icon-item">
                <span className="home-lifestyle__big-icon">🛡️</span>
                <span>5-Year Warranty</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
