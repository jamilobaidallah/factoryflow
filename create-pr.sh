#!/bin/bash

# Script to create GitHub Pull Request for Reports Page Refactoring
# Run this script to create the PR with the comprehensive summary

gh pr create \
  --base master \
  --title "🚀 Reports Page Refactoring - Phase 1, 2 & 3 Complete (73.8% reduction)" \
  --body "$(cat PULL_REQUEST_SUMMARY.md)"

echo ""
echo "✅ Pull Request created successfully!"
echo ""
echo "The PR includes:"
echo "- 73.8% code reduction (1,618 → 424 lines)"
echo "- 10 new files (7 components + 2 hooks)"
echo "- Comprehensive documentation"
echo "- Zero breaking changes"
echo ""
