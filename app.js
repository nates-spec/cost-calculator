// ===== SLIDER UPDATES =====
    const premiumSlider = document.getElementById('premiumSlider');
    const sqftSlider = document.getElementById('sqftSlider');
    const homeValueSlider = document.getElementById('homeValueSlider');
    const probSlider = document.getElementById('probSlider');

    function formatCurrency(n) {
      if (n >= 1000000) return '$' + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M';
      if (n >= 1000) return '$' + Math.round(n).toLocaleString();
      return '$' + n;
    }

    premiumSlider.addEventListener('input', function() {
      document.getElementById('premiumDisplay').textContent = '$' + parseInt(this.value).toLocaleString();
    });

    function getSystemCost(sqft) {
      if (sqft <= 2500) return { systems: 1, cost: 1800 };
      if (sqft <= 4000) return { systems: 2, cost: 3600 };
      if (sqft <= 6000) return { systems: 3, cost: 5400 };
      return { systems: 4, cost: 7200 };
    }

    sqftSlider.addEventListener('input', function() {
      const sqft = parseInt(this.value);
      document.getElementById('sqftDisplay').textContent = sqft.toLocaleString();
      const { systems, cost } = getSystemCost(sqft);
      document.getElementById('unitCountLabel').textContent = systems + ' system' + (systems > 1 ? 's' : '') + ' \u2022 $' + cost.toLocaleString() + '/yr';
    });

    homeValueSlider.addEventListener('input', function() {
      const val = parseInt(this.value);
      document.getElementById('homeValueDisplay').textContent = formatCurrency(val);
    });

    probSlider.addEventListener('input', function() {
      document.getElementById('probDisplay').textContent = parseFloat(this.value) + '%';
    });

    // ===== CALCULATE =====
    function calculateResults() {
      const premium = Number.parseInt(premiumSlider.value, 10) || 0;
      const sqft = parseInt(sqftSlider.value);
      const { systems, cost: MATADOR_ANNUAL_COST } = getSystemCost(sqft);
      const homeValue = Number.parseInt(homeValueSlider.value, 10) || 0;
      const prob = Math.max(parseFloat(probSlider.value) / 100, 0.000001);

      // Weighted annual risk = probability * (rebuild cost + deductible + displacement costs)
      // We use rebuild cost as the primary loss figure since insurance doesn't cover everything
      // Personal property, displacement, deductible, uninsured gaps — so use a multiplier
      const totalExposure = homeValue; // Keep it simple: the rebuild cost they stated
      const weightedAnnualRisk = prob * totalExposure;

      // Breakeven: at what % effectiveness does $1,800 = probability * effectiveness * totalExposure
      // $1,800 = prob * breakeven * totalExposure
      // breakeven = $1,800 / (prob * totalExposure)
      const breakevenPct = (MATADOR_ANNUAL_COST / (prob * totalExposure)) * 100;

      // Update displays
      document.getElementById('riskCostValue').textContent = '$' + Math.round(weightedAnnualRisk).toLocaleString();
      document.getElementById('defenseCostValue').textContent = '$' + MATADOR_ANNUAL_COST.toLocaleString();
      document.getElementById('defenseUnitNote').textContent = systems + ' system' + (systems > 1 ? 's' : '') + ' for a ' + sqft.toLocaleString() + ' sq ft home';

      // Breakeven display
      const resultsSectionEl = document.getElementById('resultsSection');
      const breakevenEl = document.getElementById('breakevenPct');
      const breakevenLabelEl = document.getElementById('breakevenLabel');

      if (breakevenPct < 1) {
        breakevenEl.textContent = '<1% of the time';
        breakevenLabelEl.textContent = 'The system only needs to work less than 1% of the time to pay for itself. At those odds, it\'s not a question of if — it\'s a question of why you haven\'t started.';
      } else if (breakevenPct >= 100) {
        breakevenEl.textContent = Math.round(breakevenPct) + '% of the time';
        breakevenLabelEl.textContent = 'At your current estimates, the math is tight. But consider: most homeowners underestimate their actual risk, and this calculation doesn\'t include personal property, displacement, or the things insurance won\'t cover.';
      } else {
        breakevenEl.textContent = breakevenPct.toFixed(1) + '% of the time';
        breakevenLabelEl.textContent = 'That\'s all the system needs to work to pay for itself. Every point of effectiveness above that is pure value — money you keep, damage you avoid.';
      }

      // Premium context
      const premiumContextEl = document.getElementById('premiumContextText');
      const pctOfPremium = ((MATADOR_ANNUAL_COST / premium) * 100).toFixed(0);
      if (MATADOR_ANNUAL_COST < premium) {
        premiumContextEl.innerHTML = `<strong>For context:</strong> You're already paying <strong>$${premium.toLocaleString()}/year</strong> for insurance — a policy that pays out <em>after</em> your home is destroyed. Matador Fire's defense system costs just <strong>${pctOfPremium}%</strong> of that premium, and it works <em>before</em> the fire arrives. It works to save the things money can't replace.`;
      } else {
        premiumContextEl.innerHTML = `<strong>For context:</strong> You're paying <strong>$${premium.toLocaleString()}/year</strong> for insurance that covers you after destruction. For <strong>$${MATADOR_ANNUAL_COST.toLocaleString()}/year</strong>, Matador Fire's system works before the fire arrives — protecting what insurance can only reimburse. It works to save the things money can't replace.`;
      }

      // Explanation text
      const explanationEl = document.getElementById('explanationText');
      const riskFormatted = '$' + Math.round(weightedAnnualRisk).toLocaleString();
      const homeFormatted = formatCurrency(homeValue);
      const probFormatted = (prob * 100).toFixed(1);

      explanationEl.innerHTML = `<strong>Here's the math:</strong> You estimated a ${probFormatted}% chance of wildfire damage to a ${homeFormatted} home. That puts your weighted annual risk at <strong>${riskFormatted}</strong> — the expected cost of that risk each year. Matador Fire's Wildfire Defense System costs <strong>$${MATADOR_ANNUAL_COST.toLocaleString()}/year</strong>. For the system to break even, it only needs to reduce your risk by <strong>${breakevenPct < 1 ? 'less than 1' : breakevenPct.toFixed(1)}%</strong>. Given that the retardant has a 100% structural survival record when used by professional firefighters across 432 homes in the 2025 fire season, the question isn't whether it works — it's whether you can afford to wait.`;

      // Highlight matching hazard zone row
      const probPct = prob * 100; // Convert back to percentage
      document.querySelectorAll('.zone-row').forEach(r => r.classList.remove('active-zone'));
      const noteEl = document.getElementById('hazardZoneNote');
      if (probPct <= 0.4) {
        document.getElementById('zoneModerate').classList.add('active-zone');
        noteEl.innerHTML = 'Your estimate of <strong>' + probPct.toFixed(1) + '%</strong> annual probability falls in the <strong>Moderate</strong> hazard zone range.';
      } else if (probPct <= 0.9) {
        document.getElementById('zoneHigh').classList.add('active-zone');
        noteEl.innerHTML = 'Your estimate of <strong>' + probPct.toFixed(1) + '%</strong> annual probability falls in the <strong>High</strong> hazard zone range.';
      } else {
        document.getElementById('zoneVeryHigh').classList.add('active-zone');
        noteEl.innerHTML = 'Your estimate of <strong>' + probPct.toFixed(1) + '%</strong> annual probability falls in the <strong>Very High (Extreme)</strong> hazard zone range.';
      }

      // Show results, hide inputs and hero
      document.getElementById('calcInputs').style.display = 'none';
      document.getElementById('heroSection').style.display = 'none';
      document.getElementById('resultsSection').classList.add('visible');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      const zipCode = document.getElementById('zipInput').value.trim();
      // Pre-fill CTA form zip if user entered one
      if (zipCode) {
        document.getElementById('formZip').value = zipCode;
      }
      logger.action('Calculator submitted', {
        premium, homeValue, probability: prob,
        weightedRisk: weightedAnnualRisk,
        breakevenPct: breakevenPct,
        zipCode: zipCode
      });
    }

    function recalculate() {
      document.getElementById('resultsSection').classList.remove('visible');
      document.getElementById('heroSection').style.display = 'block';
      document.getElementById('calcInputs').style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      logger.action('User clicked recalculate');
    }

    // ===== FORM SUBMISSION =====
    function submitForm() {
      const name = document.getElementById('formName').value.trim();
      const email = document.getElementById('formEmail').value.trim();
      const phone = document.getElementById('formPhone').value.trim();
      const zip = document.getElementById('formZip').value.trim();
      const notes = document.getElementById('formNotes').value.trim();

      if (!name || !email) {
        alert('Please enter your name and email.');
        return;
      }

      // Log the lead
      logger.action('Lead form submitted', { name, email, phone, zip, notes });

      // Show success state
      document.getElementById('leadForm').style.display = 'none';
      document.getElementById('formSuccess').classList.add('visible');
    }

    // ===== SHARING =====
    function shareTwitter() {
      const text = encodeURIComponent('I just ran the numbers on wildfire risk for my home. The math is eye-opening. Check yours:');
      const url = encodeURIComponent(window.location.href);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
      logger.action('Shared on Twitter');
    }

    function shareFacebook() {
      const url = encodeURIComponent(window.location.href);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
      logger.action('Shared on Facebook');
    }

    function copyLink(event) {
      const btn = event.currentTarget;
      navigator.clipboard.writeText(window.location.href).then(() => {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => {
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }, 2000);
      });
      logger.action('Copied link');
    }

    // Init
    logger.info('Wildfire Defense Calculator initialized', { category: 'LIFECYCLE' });
