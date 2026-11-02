# ScentLedger — Perfume & Attar Cost Calculator

A React + Vite single-page application for estimating per-bottle production cost, retail price, profit and monthly break-even for perfume and attar products.

## Requirements
- Node.js 20.19+ or 22.12+ recommended
- npm

## Run locally
1. Extract the project ZIP.
2. Open a terminal in the extracted `perfume-cost-calculator` folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local URL Vite prints (normally `http://localhost:5173`).

## Build for production
Run `npm run build`. The deployable files are created in `dist/`. Run `npm run preview` to preview the build.

## Features
- Perfume bottle sizes: 10, 20, 30, 50 and 100 ml.
- Concentration: 10%, 15%, 20%, 25%, 30%, 50%, 100%.
- Oil purchase pack prices: 100, 500 and 1000 ml.
- Bottle cost by MOQ: 50, 100, 500 and 1000 units.
- Packaging cost per bottle size, base/alcohol cost per ml and other unit costs.
- Profit per bottle, margin, markup, suggested selling price, batch estimate and CSV export.
- Basic monthly break-even and target-profit planning.
- Inputs saved in browser localStorage; no backend/database required.

## Costing notes
- Oil cost per ml = purchase pack price / pack volume.
- Oil required = bottle volume × concentration percentage.
- Base required for spray = bottle volume − oil required.
- Unit cost = oil + base + bottle + packaging + other variable costs.
- Profit = selling price − unit cost.
- Margin = profit / selling price; markup = profit / unit cost.
- For pure attar, choose “Pure oil attar”; base/alcohol cost is set to zero.

This is an estimation tool, not accounting or tax advice. Enter actual supplier quotes and account for relevant tax, freight, wastage, fees, discounts and overhead before using the results for business decisions. Prices start at zero as placeholders.
