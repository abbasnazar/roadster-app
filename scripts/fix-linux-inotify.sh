#!/usr/bin/env bash
# Metro / Expo on Linux: ENOSPC = inotify limits OR missing Watchman (Node fallback watches every dir).
# Prefer Watchman; raise sysctl if you still hit limits.

set -e
echo "Current limits:"
echo "  fs.inotify.max_user_watches = $(cat /proc/sys/fs/inotify/max_user_watches)"
echo "  fs.inotify.max_user_instances = $(cat /proc/sys/fs/inotify/max_user_instances)"
echo ""
if command -v watchman >/dev/null 2>&1; then
  echo "Watchman: $(watchman --version 2>/dev/null || echo installed)"
else
  echo "Watchman: not found (Metro falls back to Node watchers → many more inotify watches)."
  echo ""
  echo "Step 1 — install Watchman (Ubuntu/Debian):"
  echo "  sudo apt update && sudo apt install -y watchman"
  echo "Then retry:  npm start"
  echo ""
fi
echo "Step 2 — raise inotify for this session (if ENOSPC persists):"
echo "  sudo sysctl fs.inotify.max_user_watches=524288"
echo "  sudo sysctl fs.inotify.max_user_instances=1024"
echo ""
echo "Persist after reboot:"
echo "  echo fs.inotify.max_user_watches=524288 | sudo tee /etc/sysctl.d/99-inotify-expo.conf"
echo "  echo fs.inotify.max_user_instances=1024 | sudo tee -a /etc/sysctl.d/99-inotify-expo.conf"
echo "  sudo sysctl --system"
