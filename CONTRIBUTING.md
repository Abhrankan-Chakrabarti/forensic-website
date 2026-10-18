# Contributing to Digital Image Forensics Platform

Thank you for your interest in contributing to the Digital Image Forensics Platform (`forensic.dpdns.org`)!

## 🛠️ Development Setup

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

4. **Verify linting & build**:
   ```bash
   npm run lint
   npm run build
   ```

---

## 📋 Pull Request Guidelines

1. **Branch Naming**: Use descriptive branch names (`feat/feature-name`, `fix/issue-description`, `docs/update-readme`).
2. **Code Standards**:
   - Follow ESLint conventions (`npm run lint`).
   - Use Tailwind CSS v4 canonical utility classes.
   - Maintain client-side privacy guarantees (never transmit image payloads to third-party endpoints).
3. **Commit Messages**: Write clear, imperative commit messages (e.g. `feat: add RGB histogram visualizer`).

---

## 🔒 Security

For security-related issues, please refer to [`SECURITY.md`](SECURITY.md).
