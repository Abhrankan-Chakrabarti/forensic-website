# 🔍 Digital Image Forensics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A modern, high-performance web portal and landing page for the **Digital Image Forensics Platform** (`forensic.dpdns.org`), tailored for investigators, journalists, researchers, and cybersecurity professionals performing digital media authenticity verification.

---

## 🌐 Live Services

- **Main Portal**: [forensic.dpdns.org](https://forensic.dpdns.org)
- **Pixel Forensics Tool**: [pixel.forensic.dpdns.org](https://pixel.forensic.dpdns.org) — Dedicated portal providing pixel-level examination, manipulation analysis, and authenticity verification.

---

## ✨ Features & Capabilities

- 🔬 **Error Level Analysis (ELA)**: Detect differences in compression levels across image regions to reveal digital modifications.
- 📋 **Metadata & EXIF Inspection**: Detailed extraction of camera make/model, timestamps, geolocation data, and embedded properties.
- 🗜️ **Compression Artefact Detection**: Identify inconsistencies in JPEG quantisation tables and recompression traces.
- 🧬 **Clone & Tamper Analysis**: Trace duplicated patterns, spliced areas, and copy-paste forgery.
- 🔍 **Pixel-Level Investigation**: Deep granular inspection of pixel luminance, high-frequency anomalies, and noise distributions.
- 📄 **Forensic Report Export**: Structured forensic findings formatted for investigative records and reporting.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (using `@tailwindcss/vite`)
- **Linting**: [ESLint](https://eslint.org/)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- `npm`, `pnpm`, or `yarn`

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Abhrankan-Chakrabarti/forensic-website.git
   cd forensic-website
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

---

## 📦 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server with Hot Module Replacement (HMR). |
| `npm run build` | Builds the project for production into the `dist/` folder. |
| `npm run preview` | Locally previews the production build. |
| `npm run lint` | Runs ESLint to check for code quality and style issues. |

---

## 📂 Project Structure

```text
forensic-website/
├── public/              # Static assets (favicons, SVG icons)
├── src/
│   ├── assets/          # Images and graphics
│   ├── App.css          # Component styling
│   ├── App.jsx          # Main platform landing view & capabilities
│   ├── index.css        # Global CSS & Tailwind imports
│   └── main.jsx         # React application entry point
├── eslint.config.js     # ESLint configuration
├── index.html           # HTML template
├── package.json         # Project metadata and dependencies
├── vite.config.js       # Vite build configuration
├── LICENSE              # MIT License
└── README.md            # Project documentation
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more details.
