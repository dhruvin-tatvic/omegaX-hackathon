import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';

import Home from './pages/Home';
import Motorcycles from './pages/Motorcycles';
import MotorcycleDetail from './pages/MotorcycleDetail';
import Offers from './pages/Offers';
import Dealers from './pages/Dealers';
import Finance from './pages/Finance';
import FAQ from './pages/FAQ';
import About from './pages/About';
import Contact from './pages/Contact';
import BookTestRide from './pages/BookTestRide';
import TestRideThanks from './pages/TestRideThanks';
import Account from './pages/Account';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

import './App.css';

export function AppContent() {
  return (
    <div className="app-layout">
      <ScrollToTop />
      <Navbar />
      <div className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/motorcycles" element={<Motorcycles />} />
          <Route path="/motorcycles/:slug" element={<MotorcycleDetail />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/dealers" element={<Dealers />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/book-test-ride" element={<BookTestRide />} />
          <Route path="/book-test-ride/thanks" element={<TestRideThanks />} />
          <Route path="/account" element={<Account />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
