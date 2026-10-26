#!/usr/bin/env node
// Copies src/ into docs/ so GitHub Pages serves what the tests check.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
for (const f of ["alih.js", "alih.css"]) {
  fs.copyFileSync(path.join(root, "src", f), path.join(root, "docs", f));
  console.log("docs/" + f + " updated");
}
