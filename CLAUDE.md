# Cost Calculator — Matador Fire

**Live URL:** https://costcalculator.matadorfire.cloud
**Password:** `FIRE!`
**Cloudflare Project:** `cost-calculator`
**Architecture:** Single-file vanilla HTML/CSS/JS (`index.html`, ~1504 lines — all inline)

## Deploy
```bash
CLOUDFLARE_API_TOKEN="PzLHFCOv2Ki2ee3TlJ1FeDjh92Zw9JzdOhcYND6-" CLOUDFLARE_ACCOUNT_ID="eb9a41161e2d92331ea8a95d440f9109" \
  wrangler pages deploy . --project-name cost-calculator --branch main
```
Run from this directory.

## What It Does
5-question slider-based calculator showing wildfire defense system breakeven analysis for Southern California homeowners.

**Inputs:** Insurance Premium → Home Size → Rebuild Cost → Fire Probability → ZIP Code

**System pricing:**
- ≤2,500 sqft → 1 system = $1,800/yr
- 2,501–4,000 sqft → 2 systems = $3,600/yr
- 4,001–6,000 sqft → 3 systems = $5,400/yr
- 6,001+ sqft → 4 systems = $7,200/yr

**Breakeven formula:** `(MATADOR_ANNUAL_COST / (prob * totalExposure)) * 100`

## Known Issues (P0)
- Hero text says "Answer three questions" — needs to say "five questions" (or rephrase generically)

## Brand Rules
- Background: `#0D0B09` (Charcoal — NOT pure black)
- Primary/CTAs: `#EC1B34` (Red)
- Secondary: `#C44A0A` (Ember)
- Text: `#F0E8DC` (Bone — NOT white)
- Labels: `#6D6F70` (Ash)
- **BANNED:** Yellow `#FAB812`, blues, greens, purples
- Fonts: Clarendon (H1/H2), Cabinet Grotesk (body/buttons — always UPPERCASE on buttons)
- Page title format: `[Name] — Matador Fire` (em dash)
- Never fear-monger, no survival guarantees, no brush clearance emphasis
- Never include AI tool attribution

## CSS Notes
All styles are inline in `index.html`. Prefix new class names (e.g., `hazard-zone-*`) to avoid collisions. Password input selector: `input[type="password"]:visible`.

## DNS (if re-adding custom domain)
```bash
# 1. CNAME record (error 81057 = already exists, ignore)
curl -X POST "https://api.cloudflare.com/client/v4/zones/497a74a9f00382d9a78f145a40f34a08/dns_records" \
  -H "Authorization: Bearer PzLHFCOv2Ki2ee3TlJ1FeDjh92Zw9JzdOhcYND6-" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"costcalculator","content":"cost-calculator.pages.dev","ttl":1,"proxied":true}'

# 2. Register domain on Pages project (error 8000018 = already exists, ignore)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/eb9a41161e2d92331ea8a95d440f9109/pages/projects/cost-calculator/domains" \
  -H "Authorization: Bearer PzLHFCOv2Ki2ee3TlJ1FeDjh92Zw9JzdOhcYND6-" \
  -H "Content-Type: application/json" \
  -d '{"name":"costcalculator.matadorfire.cloud"}'
```
