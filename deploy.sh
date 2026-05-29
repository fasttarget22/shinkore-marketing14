#!/data/data/com.termux/files/usr/bin/bash
# Shinkore deploy script — builds first, only pushes if build succeeds.
MSG="$1"
if [ -z "$MSG" ]; then
  echo "❌ Please provide a commit message:  ./deploy.sh \"your message\""
  exit 1
fi
echo "🔨 Building..."
npm run build 2>&1 | tail -3
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo "❌ BUILD FAILED — nothing committed or pushed. Fix the error above."
  exit 1
fi
echo "✅ Build OK. Committing and pushing..."
git add -A && git commit -m "$MSG" && git push
echo "🚀 Done."
