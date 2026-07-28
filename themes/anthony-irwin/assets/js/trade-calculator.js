/**
 * Interactive Trade Loss Calculator
 * Lets users set their account balance and risk per trade,
 * then shows the compounding effect of consecutive losses.
 */
(function () {
  const TRADE_COUNTS = [1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 250, 300, 350, 400, 450, 500];

  function formatBalance(val) {
    return '$' + val.toFixed(2);
  }

  function formatDrawdown(val) {
    const prefix = val > 20 ? '~' : '';
    return prefix + val.toFixed(1) + '%';
  }

  function calculate() {
    const balanceInput = document.getElementById('calc-balance');
    const riskInput = document.getElementById('calc-risk');
    const tbody = document.getElementById('calc-tbody');

    if (!balanceInput || !riskInput || !tbody) return;

    const balance = parseFloat(balanceInput.value) || 10000;
    const risk = (parseFloat(riskInput.value) || 1) / 100;

    let rows = '';
    TRADE_COUNTS.forEach(function (n) {
      const remaining = balance * Math.pow(1 - risk, n);
      const dd = (1 - Math.pow(1 - risk, n)) * 100;
      const prefix = dd > 20 ? '~' : '';

      rows += '<tr>' +
        '<td style="text-align: right">' + n + '</td>' +
        '<td style="text-align: right">' + prefix + formatBalance(remaining) + '</td>' +
        '<td style="text-align: right">' + formatDrawdown(dd) + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = rows;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var balanceInput = document.getElementById('calc-balance');
    var riskInput = document.getElementById('calc-risk');

    if (!balanceInput || !riskInput) return;

    calculate();

    balanceInput.addEventListener('input', calculate);
    riskInput.addEventListener('input', calculate);
  });
})();
