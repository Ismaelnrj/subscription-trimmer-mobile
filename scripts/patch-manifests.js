/**
 * Removes unwanted Android permissions injected by library manifests.
 * Runs automatically via the "postinstall" npm script after every install.
 */
const fs = require("fs");
const path = require("path");

const PERMISSIONS_TO_REMOVE = [
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
];

function findManifests(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip deeply nested directories to keep it fast
      if (entry.name === "node_modules") continue;
      findManifests(fullPath, results);
    } else if (entry.name === "AndroidManifest.xml") {
      results.push(fullPath);
    }
  }
  return results;
}

const nodeModulesDir = path.join(__dirname, "..", "node_modules");
const manifests = findManifests(nodeModulesDir);

let patchedCount = 0;

for (const manifestPath of manifests) {
  try {
    let content = fs.readFileSync(manifestPath, "utf8");
    let changed = false;
    for (const perm of PERMISSIONS_TO_REMOVE) {
      const before = content;
      // Match both self-closing variants with any attributes/spacing
      content = content.replace(
        new RegExp(`\\s*<uses-permission[^>]*android:name="${perm}"[^>]*/>`,"g"),
        ""
      );
      if (content !== before) changed = true;
    }
    if (changed) {
      fs.writeFileSync(manifestPath, content, "utf8");
      patchedCount++;
      console.log(`[patch-manifests] Cleaned: ${manifestPath.replace(nodeModulesDir, "node_modules")}`);
    }
  } catch {
    // Ignore unreadable files
  }
}

console.log(`[patch-manifests] Done — patched ${patchedCount} manifest(s).`);
