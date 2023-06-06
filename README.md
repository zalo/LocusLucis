# [LocusLucis](https://zalo.github.io/LocusLucis/)

<p align="left">
  <a href="https://github.com/zalo/LocusLucis/deployments/activity_log?environment=github-pages">
      <img src="https://img.shields.io/github/deployments/zalo/LocusLucis/github-pages?label=Github%20Pages%20Deployment" title="Github Pages Deployment"></a>
  <a href="https://github.com/zalo/LocusLucis/commits/main">
      <img src="https://img.shields.io/github/last-commit/zalo/LocusLucis" title="Last Commit Date"></a>
  <!--<a href="https://github.com/zalo/LocusLucis/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/zalo/LocusLucis" title="License: Apache V2"></a> -->
</p>

Experiments in 2D Radiosity, trying to find the fastest method.

See Experiments here:
- [Analytic 2D Radiosity via Visible Angle Computation](https://raw.githack.com/zalo/main/index.html)
- [2D Line Sweep Radiosity via Isovist Precomputation](https://raw.githack.com/zalo/LocusLucis/feat-line-sweep/index.html)
- [2D Radiosity via Per-Pixel Raytracing](https://raw.githack.com/zalo/LocusLucis/feat-raytracing/index.html)

 # Building

This can either be run without building (in Chrome/Edge/Opera since raw three.js examples need [Import Maps](https://caniuse.com/import-maps)), or built with:
```
npm install
npm run build
```
If building manually, make sure to edit the index .html to point from `"./src/main.js"` to `"./build/main.js"`.

 # Dependencies
 - [three.js](https://github.com/mrdoob/three.js/) (3D Rendering Engine)
 - [esbuild](https://github.com/evanw/esbuild/) (Bundler)
