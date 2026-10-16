// Genera los PNG de marca a partir de assets/brand/*.svg.
// Uso: npm i --no-save sharp && node scripts/render-brand.mjs
import sharp from "sharp";

const out = "assets/images";
const jobs = [
  ["icon", "icon.png", 1024, { flatten: true }],
  ["android-icon-background", "android-icon-background.png", 1024],
  ["android-icon-foreground", "android-icon-foreground.png", 1024],
  ["android-icon-monochrome", "android-icon-monochrome.png", 1024],
  ["splash-icon", "splash-icon.png", 1024],
  ["favicon", "favicon.png", 48],
];
for (const [name, file, size, opts] of jobs) {
  let img = sharp(`assets/brand/${name}.svg`, { density: 288 }).resize(size, size);
  if (opts?.flatten) img = img.flatten({ background: "#2340C8" });
  await img.png().toFile(`${out}/${file}`);
  console.log("ok", file);
}
