// Progressive enhancement only: every page reads in full without this file.
(function () {
  var root = document.documentElement;

  // Theme: the DAO kit's tokens switch on data-theme="light" | "dark".
  var themeBtn = document.querySelector('.iconbtn.theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
    });
  }

  var menuBtn = document.querySelector('.menubtn');
  var nav = document.getElementById('nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // "Today" needle on the calendar ribbon, placed from the reader's own date.
  var now = document.querySelector('.ribbon .now');
  if (now) {
    var start = Date.parse(now.getAttribute('data-start'));
    var end = Date.parse(now.getAttribute('data-end'));
    var t = Date.now();
    if (t >= start && t <= end) {
      now.style.setProperty('--x', ((t - start) / (end - start) * 100).toFixed(2) + '%');
    } else {
      now.style.display = 'none';
    }
  }

  // Small DAP test: the four conditions in s 911A(2)(ja).
  var tool = document.querySelector('[data-tool="lowvalue"]');
  if (tool) {
    var $ = function (id) { return document.getElementById(id); };
    var items = tool.querySelectorAll('.verdict li');
    var out = tool.querySelector('.verdict .out');
    var run = function () {
      var volume = parseFloat($('lv-volume').value);
      var client = parseFloat($('lv-client').value);
      var results = {
        fp: $('lv-fp').value === 'no',
        volume: !isNaN(volume) && volume >= 0 && volume <= 10000000,
        client: !isNaN(client) && client >= 0 && client <= 5000,
        notice: $('lv-notice').value === 'yes'
      };
      var all = true;
      items.forEach(function (li) {
        var ok = results[li.getAttribute('data-c')];
        li.className = ok ? 'pass' : 'fail';
        if (!ok) all = false;
      });
      out.textContent = all
        ? 'All four conditions hold on these numbers. The exemption may be available; the platform is still a DAP.'
        : 'At least one condition fails, so this exemption would not apply on these numbers.';
    };
    tool.querySelectorAll('input, select').forEach(function (el) { el.addEventListener('input', run); el.addEventListener('change', run); });
    run();
  }

  // Custody explorer tabs.
  var tablist = document.querySelector('[data-tool="custody"] [role="tablist"]');
  if (tablist) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    var select = function (tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
    };
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
        if (next) { e.preventDefault(); select(next); next.focus(); }
      });
    });
    select(tabs[0]);
  }

  // Evidence page: filter and search the claim ledger and source list.
  var filters = document.querySelector('.filters');
  if (filters) {
    var buttons = filters.querySelectorAll('button[data-kind]');
    var search = filters.querySelector('input');
    var rows = document.querySelectorAll('[data-kind-row]');
    var current = 'all';
    var apply = function () {
      var q = (search && search.value || '').trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (r) {
        var okKind = current === 'all' || r.getAttribute('data-kind-row') === current;
        var okText = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
        r.hidden = !(okKind && okText);
        if (!r.hidden) shown++;
      });
      var count = document.getElementById('ledger-count');
      if (count) count.textContent = shown + ' shown';
    };
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        current = b.getAttribute('data-kind');
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        apply();
      });
    });
    if (search) search.addEventListener('input', apply);
    apply();
  }

  // Copy buttons on the share kit.
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-copy'));
      if (!target) return;
      var posts = target.querySelectorAll('.txt');
      var text = posts.length
        ? Array.prototype.map.call(posts, function (p) { return p.innerText.trim(); }).join('\n\n')
        : target.innerText.replace(/\[\d+\]/g, '').trim();
      var done = function () {
        var label = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('done');
        setTimeout(function () { btn.textContent = label; btn.classList.remove('done'); }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });
})();
