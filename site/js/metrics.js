(function () {
  var LOCAL_KEY = "tachiai-cho-metrics-v1";
  var ALLOWED = {
    view: true,
    app_open: true,
    first_mark: true,
    summary: true,
    print_blocked: true,
    print: true,
    pay_click: true,
    unlock_seen: true,
    import_fail: true,
    export: true
  };

  function readLocal() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function track(name) {
    if (!ALLOWED[name]) return;
    try {
      var cur = readLocal();
      cur[name] = (cur[name] || 0) + 1;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(cur));
    } catch (e) {
      /* 計測できないだけで記録機能は続ける */
    }
    var endpoint = window.TACHIAI_CONFIG && window.TACHIAI_CONFIG.metricsEndpoint;
    if (!endpoint || typeof navigator === "undefined" || !navigator.sendBeacon) return;
    try {
      var blob = new Blob([JSON.stringify({ event: name })], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
    } catch (e2) {
      /* サーバー未設置でも操作は止めない */
    }
  }

  window.TachiaiMetrics = {
    ALLOWED: ALLOWED,
    track: track,
    readLocal: readLocal
  };
})();
