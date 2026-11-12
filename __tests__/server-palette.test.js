const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

/* THE RETIRED WARM COLOURS STAY OUT OF WHAT THE SERVER SENDS. The palette
   left cream on 2026-11-12, and the renewal reminder email kept a beige
   header row (#E9E6DE) that the sweep missed, because nothing scanned the
   email templates. */
describe("the server sends no retired cream", () => {
  it.each(["#F7F6F1", "#FCFBF8", "#E9E6DE", "#DCDEDB"])("%s is gone from server.js", (hex) => {
    expect(SRC.toUpperCase()).not.toContain(hex);
  });
});
