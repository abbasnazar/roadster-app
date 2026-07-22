/**
 * On Linux, Metro without Watchman uses Node's FallbackWatcher and can hit ENOSPC
 * when inotify limits are low. Exit before Expo so the user gets clear steps
 * instead of a stack trace.
 *
 * Passes if: not Linux, OR watchman is on PATH, OR both limits look high enough.
 */
const fs = require('fs');
const { execSync } = require('child_process');

const MIN_WATCHES = 524288;
const MIN_INSTANCES = 1024;

if (process.env.EXPO_SKIP_METRO_LINUX_GUARD === '1') {
  process.exit(0);
}

if (process.platform !== 'linux') {
  process.exit(0);
}

function hasWatchman() {
  try {
    execSync('command -v watchman', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readInt(relPath) {
  try {
    return parseInt(fs.readFileSync(relPath, 'utf8').trim(), 10);
  } catch {
    return null;
  }
}

if (hasWatchman()) {
  process.exit(0);
}

const watches = readInt('/proc/sys/fs/inotify/max_user_watches');
const instances = readInt('/proc/sys/fs/inotify/max_user_instances');

const okWatches = watches != null && watches >= MIN_WATCHES;
const okInstances = instances != null && instances >= MIN_INSTANCES;

if (okWatches && okInstances) {
  process.exit(0);
}

console.error(`
[roadster-mobile] Metro will likely crash on Linux (ENOSPC: inotify limits + Node file watcher).

  fs.inotify.max_user_watches   = ${watches ?? '?'}  (need >= ${MIN_WATCHES} without Watchman)
  fs.inotify.max_user_instances = ${instances ?? '?'}  (need >= ${MIN_INSTANCES} without Watchman)
  watchman on PATH              = no

Fix (pick A or B):

  A) Install Watchman (recommended):
       sudo apt update && sudo apt install -y watchman

  B) Raise limits for this session, then persist:
       sudo sysctl fs.inotify.max_user_watches=${MIN_WATCHES}
       sudo sysctl fs.inotify.max_user_instances=${MIN_INSTANCES}
       npm run fix:inotify

Then retry: npm run web   (or npm start)
`);

process.exit(1);
