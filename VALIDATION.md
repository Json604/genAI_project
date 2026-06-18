# Validation Results

Date: 2026-06-14
Base URL: `http://localhost:3000`
Generated using the project's automated validation pipeline.

## Image Search

Pass rate: **10/10 (100.0%)**

- PASS 17370: found in top 5
- PASS 52507: found in top 5
- PASS 15291: found in top 5
- PASS 52314: found in top 5
- PASS 1628: found in top 5
- PASS 52494: found in top 5
- PASS 55286: found in top 5
- PASS 14171: found in top 5
- PASS 31733: found in top 5
- PASS 57683: found in top 5

## Combined Search

- OBSERVE case 1: source 17370 - Arrow Men Formal Purple Tie+Cufflink+Pocket square - Combo Pack [Purple], query 'in Brown'. Image-only: 25060 - Lino Perros Men Formal Purple Accessory Gift Set [Purple]; text-only: 57812 - United Colors of Benetton Women Brown Jumpsuit [Brown]; combined: 25060 - Lino Perros Men Formal Purple Accessory Gift Set [Purple]. Combined style=True, colour=False; better than both single signals=False.
- OBSERVE case 2: source 52507 - Red Rose Black Nightdress [Black], query 'in White'. Image-only: 52481 - Red Rose Pink & Black Nightdress [Pink]; text-only: 12209 - Basics Men White T-shirt [White]; combined: 59756 - Avirate White Wired Corset Shapewear [White]. Combined style=False, colour=True; better than both single signals=False.
- PASS case 3: source 15291 - ADIDAS Originals Unisex ST Patch Black Backpacks [Black], query 'in Purple'. Image-only: 37674 - American Tourister Unisex Black Backpack [Black]; text-only: 56428 - Streetwear FX Cutey Petutti Eye Shadow [Pink]; combined: 5259 - Wildcraft Unisex Purple Printed Backpack [Purple]. Combined style=True, colour=True; better than both single signals=True.
- OBSERVE case 4: source 52314 - ToniQ Women Set of 4 Bangles [White], query 'in Steel'. Image-only: 48743 - Revv Men Steel Bangle [Steel]; text-only: 48561 - Revv Men Steel Bracelet [Steel]; combined: 48743 - Revv Men Steel Bangle [Steel]. Combined style=True, colour=True; better than both single signals=False.
- PASS case 5: source 1628 - Kipsta Xtra Bounce Basketball [Brown], query 'in Blue'. Image-only: 8426 - Spalding Unisex NBA Team Raptors SZ7 Red Basketball [Red]; text-only: 19518 - United Colors of Benetton Men Stripes Blue Sweater [Blue]; combined: 8427 - Spalding Unisex Blue Basketball [Blue]. Combined style=True, colour=True; better than both single signals=True.
- OBSERVE case 6: source 52494 - Red Rose Women Pink Bath Robe [Pink], query 'in White'. Image-only: 52510 - Red Rose Women White & Pink Striped Bath Robes [White]; text-only: 12209 - Basics Men White T-shirt [White]; combined: 52479 - Red Rose White Nightdress [White]. Combined style=False, colour=True; better than both single signals=False.

## Attribute Check

Result: **5/5 passed**

- PASS 42319: 5/5 non-empty values
- PASS 59851: 5/5 non-empty values
- PASS 22886: 5/5 non-empty values
- PASS 44621: 5/5 non-empty values
- PASS 50668: 5/5 non-empty values
