# CI/CD Setup Guide - FactoryFlow

## 🚀 Overview

This guide shows you how to set up automated testing and deployment for FactoryFlow using GitHub Actions.

---

## 📋 What's Included

### ✅ Automated Testing
- Runs on every push and pull request
- 171 unit tests
- Code quality checks (ESLint, TypeScript)
- Coverage reporting

### ✅ Automated Deployment
- Deploy to Vercel or Firebase Hosting
- Runs only on main branch
- Production-ready builds

### ✅ Security Audits
- npm audit on every run
- Dependency vulnerability checks

---

## 🔧 Setup Instructions

### Step 1: Push to GitHub

If you haven't already, initialize a git repository and push to GitHub:

```bash
cd factory-flow

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit with CI/CD setup"

# Add remote (replace with your repository)
git remote add origin https://github.com/YOUR_USERNAME/factory-flow.git

# Push to GitHub
git push -u origin main
```

### Step 2: GitHub Actions will Auto-Run

Once you push, GitHub Actions will automatically:
1. ✅ Run ESLint
2. ✅ Run TypeScript type check
3. ✅ Run all 171 tests
4. ✅ Build the application
5. ✅ Run security audit

### Step 3: View Results

Go to your GitHub repository → **Actions** tab to see the workflow runs.

---

## 🎯 Available Workflows

### 1. Main CI/CD Pipeline

**File:** `.github/workflows/ci.yml`

**Triggers:**
- Push to `main`, `master`, or `develop` branches
- Pull requests to these branches
- Manual trigger (workflow_dispatch)

**Jobs:**
1. **Lint & Type Check** - Code quality validation
2. **Test Suite** - Run all 171 tests
3. **Build** - Build production application
4. **Security Audit** - Check for vulnerabilities
5. **Deploy to Vercel** - (Optional, see deployment setup)
6. **Deploy to Firebase** - (Optional, see deployment setup)

**Status Badge:**
Add this to your README to show build status:
```markdown
![CI/CD](https://github.com/YOUR_USERNAME/factory-flow/workflows/CI/CD%20Pipeline/badge.svg)
```

### 2. Pull Request Checks

**File:** `.github/workflows/pr-check.yml`

**Triggers:**
- When a PR is opened
- When a PR is updated
- When a PR is reopened

**Features:**
- Quick validation (lint + test + build)
- Auto-comments on PR with results
- Prevents merging broken code

---

## 📊 Test Configuration

### Current Test Suite

```
✅ 8 Test Suites
✅ 171 Tests Passing
✅ 74% Utility Coverage
⏱️ ~6 seconds runtime
```

### Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in CI mode
npm run test:ci

# Watch mode (development)
npm run test:watch
```

---

## 🌐 Deployment Setup

### Option A: Deploy to Vercel

1. **Create Vercel Account**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub

2. **Get Vercel Tokens**
   ```bash
   npm i -g vercel
   vercel login
   vercel --token
   ```

3. **Add GitHub Secrets**
   - Go to your repo → Settings → Secrets and variables → Actions
   - Add:
     - `VERCEL_TOKEN` - Your Vercel token
     - `VERCEL_ORG_ID` - From `.vercel/project.json`
     - `VERCEL_PROJECT_ID` - From `.vercel/project.json`

4. **Enable Deployment**

   Edit `.github/workflows/ci.yml`:

   Uncomment the Vercel deployment section:
   ```yaml
   - name: Deploy to Vercel
     uses: amondnet/vercel-action@v25
     with:
       vercel-token: ${{ secrets.VERCEL_TOKEN }}
       vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
       vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
       vercel-args: '--prod'
   ```

### Option B: Deploy to Firebase Hosting

1. **Get Firebase Service Account**
   ```bash
   cd factory-flow
   firebase login
   firebase projects:list
   ```

2. **Create Service Account**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project
   - Go to Project Settings → Service Accounts
   - Generate new private key
   - Save the JSON file

3. **Add GitHub Secret**
   - Go to your repo → Settings → Secrets
   - Add `FIREBASE_SERVICE_ACCOUNT`
   - Paste the entire JSON content

4. **Enable Deployment**

   Edit `.github/workflows/ci.yml`:

   Uncomment the Firebase deployment section:
   ```yaml
   - name: Deploy to Firebase Hosting
     uses: FirebaseExtended/action-hosting-deploy@v0
     with:
       repoToken: '${{ secrets.GITHUB_TOKEN }}'
       firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
       channelId: live
       projectId: your-project-id
   ```

---

## 🔒 Security Best Practices

### Environment Variables

**Never commit:**
- ❌ API keys
- ❌ Firebase credentials
- ❌ Service account tokens

**Instead:**
1. Add to GitHub Secrets
2. Reference in workflow: `${{ secrets.YOUR_SECRET }}`

### GitHub Secrets Setup

1. Go to: Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add required secrets:

**For Vercel:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

**For Firebase:**
- `FIREBASE_SERVICE_ACCOUNT`

---

## 📈 Monitoring & Alerts

### GitHub Actions Status

View at: `https://github.com/YOUR_USERNAME/factory-flow/actions`

### Enable Email Notifications

1. Go to GitHub → Settings → Notifications
2. Enable "Actions" notifications
3. Get emailed when builds fail

### Slack Integration (Optional)

Add to workflow:
```yaml
- name: Slack Notification
  uses: 8398a7/action-slack@v3
  if: failure()
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🐛 Troubleshooting

### Tests Failing in CI but Pass Locally

**Common causes:**
1. Different Node version
   - Solution: Ensure same version in `.nvmrc` and workflow

2. Missing environment variables
   - Solution: Add to GitHub Secrets

3. Timezone differences
   - Solution: Mock Date in tests

### Build Failing

**Check:**
1. All dependencies installed: `npm ci`
2. TypeScript errors: `npx tsc --noEmit`
3. Build logs in Actions tab

### Deployment Failing

**Check:**
1. Secrets are set correctly
2. Project IDs match
3. Service account has proper permissions

---

## 📊 Coverage Reporting

### Codecov Integration (Optional)

1. **Sign up:** [codecov.io](https://codecov.io)

2. **Add to workflow:** (Already included)
   ```yaml
   - name: Upload coverage
     uses: codecov/codecov-action@v4
     with:
       files: ./coverage/lcov.info
   ```

3. **Add badge to README:**
   ```markdown
   ![Coverage](https://codecov.io/gh/YOUR_USERNAME/factory-flow/branch/main/graph/badge.svg)
   ```

---

## ⚡ Performance Tips

### Speed Up CI

1. **Cache Dependencies**
   ```yaml
   - uses: actions/setup-node@v4
     with:
       cache: 'npm'  # ✅ Already enabled
   ```

2. **Run Jobs in Parallel**
   ```yaml
   # Lint and tests run in parallel
   # ✅ Already configured
   ```

3. **Use Matrix Strategy** (for multiple Node versions)
   ```yaml
   strategy:
     matrix:
       node-version: [16, 18, 20]
   ```

---

## 📋 Workflow Checklist

### Before Merging PR

- [ ] All tests pass
- [ ] ESLint passes
- [ ] TypeScript compiles
- [ ] Build succeeds
- [ ] Security audit passes
- [ ] Code review approved

### Before Deploying to Production

- [ ] All CI checks green
- [ ] Manual testing complete
- [ ] Firebase indexes deployed
- [ ] Environment variables set
- [ ] Backup database

---

## 🎯 Next Steps

### 1. Set Up Branch Protection

Go to: Settings → Branches → Add rule

Enable:
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Require approvals (for teams)

### 2. Add More Tests

Current coverage: 74%
Goal: 85%

Focus areas:
- Component integration tests
- E2E tests with Playwright
- API mocking tests

### 3. Add Performance Monitoring

Options:
- Firebase Performance
- Vercel Analytics
- Google Analytics

### 4. Set Up Error Tracking

Options:
- Sentry
- LogRocket
- Firebase Crashlytics

---

## 📚 Resources

### GitHub Actions
- [Documentation](https://docs.github.com/en/actions)
- [Marketplace](https://github.com/marketplace?type=actions)

### Deployment
- [Vercel Docs](https://vercel.com/docs)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)

### Testing
- [Jest CI Integration](https://jestjs.io/docs/configuration#cifalse-boolean)
- [Coverage Thresholds](https://jestjs.io/docs/configuration#coveragethreshold-object)

---

## ✅ Summary

### What You Have Now

✅ **Automated Testing** - 171 tests run on every push
✅ **Code Quality Checks** - ESLint + TypeScript
✅ **Security Audits** - npm audit on every run
✅ **Build Validation** - Ensures code compiles
✅ **PR Validation** - Auto-check pull requests
✅ **Deployment Ready** - Vercel & Firebase configs
✅ **Coverage Reporting** - Track test coverage
✅ **Professional CI/CD** - Industry-standard setup

### Benefits

🐛 **Catch bugs early** - Before they reach production
📈 **Confidence** - Know your code works
🚀 **Fast feedback** - Results in ~2 minutes
👥 **Team collaboration** - Automated PR checks
📊 **Quality metrics** - Track coverage trends
⚡ **Automated deployment** - Push to deploy

---

**Your CI/CD pipeline is ready! Push your code and watch it test & deploy automatically.** 🎉

**Last Updated:** November 24, 2025
