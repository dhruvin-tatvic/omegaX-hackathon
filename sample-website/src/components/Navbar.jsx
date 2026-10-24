import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import logoImg from '../assets/images/apex_moto_logo.jpg';
import './Navbar.css';

const navLinks = [
  { label: 'Motorcycles', path: '/motorcycles' },
  { label: 'Offers', path: '/offers' },
  { label: 'Finance', path: '/finance' },
  { label: 'Dealers', path: '/dealers' },
  { label: 'FAQ', path: '/faq' },
  { label: 'About', path: '/about' },
  { label: 'Contact', path: '/contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`} role="banner">
      <div className="navbar__inner container">
        {/* Logo */}
        <Link to="/" className="navbar__logo" aria-label="Apex Moto Home">
          <img src={logoImg} alt="Apex Moto" className="navbar__logo-img" />
        </Link>

        {/* Desktop Nav */}
        <nav className="navbar__links hide-mobile" aria-label="Main navigation">
          {navLinks.map(link => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* CTA Buttons */}
        <div className="navbar__cta hide-mobile">
          <Link to="/book-test-ride" className="btn btn-outline btn-sm">
            Test Ride
          </Link>
          <Link to="/book-test-ride" className="btn btn-primary btn-sm">
            Book Now
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          id="navbar-menu-toggle"
          className={`navbar__hamburger show-mobile ${menuOpen ? 'navbar__hamburger--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        id="mobile-menu"
        ref={menuRef}
        className={`navbar__mobile ${menuOpen ? 'navbar__mobile--open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <nav className="navbar__mobile-links">
          {navLinks.map(link => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) => `navbar__mobile-link ${isActive ? 'navbar__mobile-link--active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
          <div className="navbar__mobile-cta">
            <Link to="/book-test-ride" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Book a Test Ride
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
