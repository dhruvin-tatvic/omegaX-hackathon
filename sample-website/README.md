# Apex Moto — Sample Motorcycle Website

Apex Moto is a full-featured, dark-themed, responsive motorcycle brand website developed with React, Vite, and custom CSS design tokens.

🌐 **Live Demo:** [https://apex-moto-one.vercel.app](https://apex-moto-one.vercel.app)

---

## 🏍️ Features

- **Dynamic Motorcycle Catalog:** Filter bikes by category (Adventure, Classic, Street, Scrambler) with real-time counters.
- **Detailed Model Pages:** Interactive variant selector, color preview swatches, and tabbed specifications (Overview, Specs, Features).
- **Test Ride Booking Flow:** Client-side form with real-time field validation, date selection, and automatic pre-selection of bikes passed via query parameters (`?bike=<slug>`).
- **Dealer Locator:** Searchable dealership network by city or PIN code with quick-filter pills for major metropolitan areas.
- **Special Offers & Financing Matrix:** Interactive promotional cards and partner bank financing comparison tables.
- **Full SEO & Social Meta:** Semantic HTML5, theme-color metadata, dynamic titles, and custom SVG favicon.
- **Dark-Theme Design System:** Engineered with CSS custom properties (`variables.css`) for high visual fidelity and smooth micro-interactions.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation & Local Run

```bash
# Navigate to the sample-website directory
cd sample-website

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173` to explore the site.

### Build & Lint

```bash
# Run oxlint checks
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🛠️ Tech Stack

- **Framework:** React 19 + Vite 8
- **Routing:** React Router v7
- **Styling:** Vanilla CSS with custom design tokens (`variables.css`)
- **Linting:** Oxlint
- **Hosting:** Vercel (with client-side SPA routing rewrites)
