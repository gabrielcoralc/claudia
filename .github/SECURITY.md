# Security Policy

## Automated Security Checks

This project implements multiple layers of automated security verification:

### 1. Pre-commit Hooks (Local)

Every commit automatically runs:
- ✅ **ESLint** - Code quality and potential bugs
- ✅ **TypeScript** - Type safety checks
- ✅ **Security Audit** - Vulnerability scan in production dependencies
- ✅ **Code formatting** - Prettier on staged files

To bypass in emergencies (not recommended):
```bash
git commit --no-verify
```

### 2. GitHub Actions (CI/CD)

Runs on every push and pull request:
- **Security Audit** - Weekly + on every push
- **Lint & Type Check** - Code quality validation
- **Tests** - Unit test suite
- **Build Check** - Ensures app builds successfully

### 3. Manual Security Commands

Check security anytime:
```bash
# Full security check (audit + lint + typecheck)
npm run security:check

# Production dependencies only
npm run security:audit

# Check for outdated packages
npm outdated --registry=https://registry.npmjs.org/
```

## Dependency Updates

Update dependencies safely:
```bash
# Update patch versions (safe)
npm update

# Check for major updates
npm outdated --registry=https://registry.npmjs.org/

# Update specific package
npm update package-name --registry=https://registry.npmjs.org/
```

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it privately to:
- Email: [gabrielcoralc95@gmail.com](mailto:gabrielcoralc95@gmail.com)
- GitHub Security Advisory: Use "Report a vulnerability" button
- Create a private issue

**Do not** open public issues for security vulnerabilities.
