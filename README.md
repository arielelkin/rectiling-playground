# Rectiling Playground

**Live demo**: https://rectiling-playground.netlify.app/

Interactive static web app that re-implements Adam Ponting’s 2017 Sage/Cython script
[`Rectiling I`](https://www.adamponting.com/rectiling-i/) directly in the browser.
It reproduces the extrapolation logic that grows rectangle side lengths from a handful
of seed tiles and then renders the resulting packing on an HTML canvas.

## Features

- Two starter presets (the original Ponting configuration and a square tessellation demo)
- Live parameter controls (grid size, colour scaling, canvas size, etc.) that regenerate
  the tiling automatically
- Optional colour/label overlays plus one-click PNG export

## Running Locally

No build tooling is required:

```bash
# From the repository root
python -m http.server
```

Now open <http://localhost:8000> and load `index.html`. Any modern browser works.

## Project Structure

```
index.html   – UI layout and controls
styles.css   – Styling for the control panel + canvas
app.js       – Ported extrapolation/drawing algorithm and canvas rendering
```

## Notes

- The logic is a port of the algorithms described in Adam Ponting’s original
  write-up to pure JavaScript.
- Grid extrapolation can produce very large tilings; adjust `cx`/grid width iteratively
  if you run into performance issues.
