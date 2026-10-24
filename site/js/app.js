(function () {
  if (typeof Element !== "undefined" && !Element.prototype.replaceChildren) {
    Element.prototype.replaceChildren = function () {
      while (this.firstChild) this.removeChild(this.firstChild);
      for (var i = 0; i < arguments.length; i++) this.appendChild(arguments[i]);
    };
  }
  var M = window.TachiaiModel;
  var metrics = window.TachiaiMetrics;
  var config = window.TACHIAI_CONFIG || {};
  var root = document.getElementById("app");
  var printSheet = document.getElementById("print-sheet");
  var loaded = M.loadRecord(window.localStorage);
  var record = loaded.record;
  var saveError = loaded.error;
  var screen = { name: "rooms", roomId: "genkan" };
  if (isLocalHost() && new URLSearchParams(location.search).get("unlock") === "1") {
    M.setUnlocked(window.localStorage);
  }
  if (location.hash === "#summary") screen = { name: "summary" };

  metrics.track("app_open");
  render();
  registerServiceWorker();

  function isLocalHost() {
    return location.hostname === "localhost" || location.hostname === "127.0.0.1";
  }

  function unlocked() {
    return M.isUnlocked(window.localStorage);
  }

  function persist() {
    var result = M.saveRecord(window.localStorage, record);
    saveError = result.ok ? "" : result.error;
    return result.ok;
  }

  function render() {
    root.replaceChildren();
    if (saveError) root.appendChild(banner(saveError, "warn"));
    if (screen.name === "property") renderProperty();
    else if (screen.name === "room") renderRoom();
    else if (screen.name === "summary") renderSummary();
    else renderRooms();
  }

  function renderRooms() {
    root.appendChild(el("p", { className: "sub" }, "立会いの最中に、箇所ごとの状態と、その場で言われたことだけを残します。写真そのものは送りません。"));
    root.appendChild(banner("金額を書く欄が出たら、その場では埋めないでください。傷の確認と、修理代を払う了承は別です。法律相談ではありません。"));
    var property = el("button", { className: "room-card", type: "button" }, "");
    property.appendChild(el("span", {}, record.property.name || "物件名を入れる"));
    property.appendChild(el("span", { className: "chip" }, record.property.moveOut || "退去日"));
    property.addEventListener("click", function () {
      screen = { name: "property" };
      render();
    });
    root.appendChild(property);

    var list = el("div", { className: "room-list" });
    M.CATALOG.forEach(function (room) {
      var progress = M.roomProgress(record, room);
      var button = el("button", { className: "room-card", type: "button" }, "");
      var text = el("span", {}, "");
      text.appendChild(el("strong", {}, room.name));
      text.appendChild(document.createElement("br"));
      text.appendChild(document.createTextNode("傷や汚れ " + progress.damaged + "件"));
      button.appendChild(text);
      button.appendChild(el("span", { className: "chip " + chipClass(progress.label) }, progress.label));
      button.addEventListener("click", function () {
        screen = { name: "room", roomId: room.id };
        render();
      });
      list.appendChild(button);
    });
    root.appendChild(list);

    var row = el("div", { className: "actions" });
    row.appendChild(button("サンプルを入れる", function () {
      record = M.sampleRecord();
      persist();
      render();
    }, "secondary"));
    row.appendChild(button("まとめを見る", openSummary, ""));
    root.appendChild(row);
    root.appendChild(el("p", { className: "sub" }, "サンプルは実在の住所ではありません。本番の前に消せます。"));
  }

  function renderProperty() {
    root.appendChild(el("h2", {}, "物件"));
    root.appendChild(field("物件名", "text", record.property.name, function (value) {
      record = M.updateProperty(record, { name: value });
      persist();
    }));
    root.appendChild(field("住所（書かなくても使えます）", "text", record.property.address, function (value) {
      record = M.updateProperty(record, { address: value });
      persist();
    }));
    root.appendChild(field("退去日", "date", record.property.moveOut, function (value) {
      record = M.updateProperty(record, { moveOut: value });
      persist();
    }));
    var select = document.createElement("select");
    [["unknown", "まだ分からない"], ["yes", "入居時の写真がある"], ["no", "入居時の写真はない"]].forEach(function (pair) {
      var option = el("option", { value: pair[0] }, pair[1]);
      if (record.property.moveInPhotos === pair[0]) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", function () {
      record = M.updateProperty(record, { moveInPhotos: select.value });
      persist();
    });
    var wrap = el("div", {}, "");
    wrap.appendChild(el("label", {}, "入居時の写真"));
    wrap.appendChild(select);
    root.appendChild(wrap);
    root.appendChild(button("部屋の一覧へ", function () {
      screen = { name: "rooms" };
      render();
    }, ""));
  }

  function renderRoom() {
    var room = M.findRoom(screen.roomId) || M.CATALOG[0];
    root.appendChild(el("h2", {}, room.name));
    root.appendChild(banner("金額の欄は、その場で書かない。傷を見た記録と、修理代を払う了承は別です。"));
    root.appendChild(el("p", { className: "sub" }, room.hint));
    var note = document.createElement("textarea");
    note.maxLength = 200;
    note.value = record.roomNotes[room.id] || "";
    note.placeholder = "この部屋の補足。2部屋目は先頭に部屋名を書く";
    note.addEventListener("input", function () {
      record = M.updateRoomNote(record, room.id, note.value);
      persist();
    });
    var noteWrap = el("div", {}, "");
    noteWrap.appendChild(el("label", {}, "部屋のメモ"));
    noteWrap.appendChild(note);
    root.appendChild(noteWrap);

    room.items.forEach(function (spec) {
      root.appendChild(renderItem(room, spec[0], spec[1]));
    });

    var row = el("div", { className: "actions" });
    row.appendChild(button("一覧へ", function () {
      screen = { name: "rooms" };
      render();
    }, "secondary"));
    row.appendChild(button("まとめへ", openSummary, ""));
    root.appendChild(row);
  }

  function renderItem(room, itemId, itemName) {
    var item = M.getItem(record, room.id, itemId);
    var box = el("article", { className: "item" }, "");
    box.appendChild(el("h3", {}, itemName));
    box.appendChild(choiceRow([
      [M.DAMAGE.none, "目立った傷はない"],
      [M.DAMAGE.yes, "傷や汚れがある"],
      [M.DAMAGE.unknown, "まだ見ていない"]
    ], item.damage, function (value) {
      record = M.updateItem(record, room.id, itemId, { damage: value });
      persist();
      try {
        if (value !== M.DAMAGE.unknown && !sessionStorage.getItem("tachiai-marked")) {
          sessionStorage.setItem("tachiai-marked", "1");
          metrics.track("first_mark");
        }
      } catch (e) {
        /* 計測だけ諦める */
      }
      render();
    }));

    if (item.damage === M.DAMAGE.yes) {
      var area = document.createElement("textarea");
      area.maxLength = 200;
      area.value = item.note;
      area.placeholder = "場所と大きさだけ。例：窓の下、縦3cm";
      area.addEventListener("input", function () {
        record = M.updateItem(record, room.id, itemId, { note: area.value });
        persist();
      });
      var areaWrap = el("div", {}, "");
      areaWrap.appendChild(el("label", {}, "場所と見た目"));
      areaWrap.appendChild(area);
      box.appendChild(areaWrap);

      var photo = document.createElement("input");
      photo.type = "checkbox";
      photo.checked = item.photo;
      photo.addEventListener("change", function () {
        record = M.updateItem(record, room.id, itemId, { photo: photo.checked });
        persist();
      });
      var photoLabel = el("label", { className: "check" }, "");
      photoLabel.appendChild(photo);
      photoLabel.appendChild(document.createTextNode("自分のカメラで撮った"));
      box.appendChild(photoLabel);

      box.appendChild(el("label", {}, "その場の金額の話"));
      box.appendChild(choiceRow([
        [M.TALK.none, "出ていない"],
        [M.TALK.noted, "直す話だけ出た"],
        [M.TALK.amount, "金額を言われた"]
      ], item.talk, function (value) {
        record = M.updateItem(record, room.id, itemId, { talk: value });
        persist();
        render();
      }));

      if (item.talk === M.TALK.amount) {
        box.appendChild(field("言われた金額のメモ", "text", item.amount, function (value) {
          record = M.updateItem(record, room.id, itemId, { amount: value, talk: M.TALK.amount });
          persist();
        }));
        box.appendChild(el("p", { className: "sub" }, "ここに書いた金額は、払うと約束した記録ではありません。"));
      }
    }
    return box;
  }

  function renderSummary() {
    var summary = M.summarize(record);
    root.appendChild(el("h2", {}, "まとめ"));
    root.appendChild(el("p", {}, summary.decided + " / " + summary.total + "箇所を見ました。まだ見ていない箇所は " + summary.unseen + " です。"));
    if (summary.moveInPhotos === M.PHOTOS.no) {
      root.appendChild(banner("入居時の写真が無い記録です。立会いでは、今の状態を全体と寄りの両方で撮ってください。", "warn"));
    }
    root.appendChild(el("h3", {}, "傷や汚れがある箇所"));
    if (!summary.damaged.length) {
      root.appendChild(el("p", { className: "sub" }, "まだありません。"));
    }
    summary.damaged.forEach(function (row) {
      var card = el("article", { className: "item" }, "");
      card.appendChild(el("strong", {}, row.roomName + " / " + row.itemName));
      card.appendChild(el("p", {}, row.note || "メモはまだありません。"));
      if (row.amount) card.appendChild(el("p", {}, "言われた金額： " + row.amount));
      root.appendChild(card);
    });

    root.appendChild(el("h3", {}, "請求書が来てから開く確認"));
    M.visibleChecks(unlocked()).forEach(function (check) {
      var card = el("article", { className: "item" }, "");
      card.appendChild(el("h3", {}, check.title));
      card.appendChild(el("p", {}, check.body));
      root.appendChild(card);
    });
    if (!unlocked()) {
      root.appendChild(paywall());
    }

    var row = el("div", { className: "actions" });
    row.appendChild(button("一覧へ戻る", function () {
      screen = { name: "rooms" };
      render();
    }, "secondary"));
    row.appendChild(button(unlocked() ? "印刷用の記録を開く" : "印刷用の記録は有料", function () {
      if (!unlocked()) {
        metrics.track("print_blocked");
        var wall = document.getElementById("paywall");
        if (wall) wall.scrollIntoView();
        return;
      }
      metrics.track("print");
      fillPrint();
      window.print();
    }, ""));
    if (unlocked()) {
      row.appendChild(button("記録ファイルを保存", exportJson, "secondary"));
      row.appendChild(importButton());
    }
    row.appendChild(button("記録を消す", function () {
      if (!window.confirm("このブラウザの記録を消します。戻せません。")) return;
      record = M.blankRecord();
      persist();
      screen = { name: "rooms" };
      render();
    }, "secondary"));
    root.appendChild(row);
  }

  function paywall() {
    var box = el("section", { id: "paywall", className: "paywall" }, "");
    box.style.padding = "16px";
    box.appendChild(el("h3", {}, "印刷用の記録と、残りの確認リスト"));
    box.appendChild(el("p", {}, "画面の記録と、金額をその場で了承しない案内は無料です。買い切り " + Number(config.priceYen).toLocaleString("ja-JP") + "円で、印刷用の体裁、記録ファイルの保存、請求書が届いたあとの確認リストを開きます。"));
    box.appendChild(el("p", { className: "sub" }, "開くのは購入したブラウザだけです。コピー防止にはなっていません。" + (config.paymentUrl ? "" : "販売はまだ始めていません。")));
    if (config.paymentUrl) {
      var link = el("a", { className: "btn", href: config.paymentUrl }, "購入ページを開く");
      link.addEventListener("click", function () { metrics.track("pay_click"); });
      box.appendChild(link);
    } else {
      box.appendChild(el("p", { className: "banner warn" }, "購入URLは未設定です。決済はまだ使えません。"));
      if (isLocalHost()) {
        var test = el("a", { href: "thanks.html" }, "この端末だけの確認用ページ");
        box.appendChild(test);
      }
    }
    return box;
  }

  function openSummary() {
    screen = { name: "summary" };
    metrics.track("summary");
    render();
  }

  function exportJson() {
    metrics.track("export");
    var blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "tachiai-record.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importButton() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.hidden = true;
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          record = M.parseImport(String(reader.result || ""));
          persist();
          render();
        } catch (e) {
          metrics.track("import_fail");
          saveError = e.message || "読み込めませんでした。";
          render();
        }
      };
      reader.readAsText(file);
    });
    var trigger = button("記録ファイルを読み込む", function () { input.click(); }, "secondary");
    var holder = el("span", {}, "");
    holder.appendChild(trigger);
    holder.appendChild(input);
    return holder;
  }

  function fillPrint() {
    printSheet.replaceChildren();
    printSheet.appendChild(el("h1", {}, "立会い帳"));
    printSheet.appendChild(el("p", {}, "物件名： " + (record.property.name || "未記入")));
    printSheet.appendChild(el("p", {}, "住所： " + (record.property.address || "未記入")));
    printSheet.appendChild(el("p", {}, "退去日： " + (record.property.moveOut || "未記入")));
    printSheet.appendChild(el("p", {}, "この紙は状態のメモです。支払の合意書ではありません。法律相談でもありません。"));
    M.CATALOG.forEach(function (room) {
      var block = el("section", { className: "print-block" }, "");
      block.appendChild(el("h2", {}, room.name));
      if (record.roomNotes[room.id]) block.appendChild(el("p", {}, record.roomNotes[room.id]));
      room.items.forEach(function (spec) {
        var item = M.getItem(record, room.id, spec[0]);
        var line = spec[1] + "： " + damageLabel(item.damage);
        if (item.note) line += " / " + item.note;
        if (item.photo) line += " / 撮影済み";
        if (item.amount) line += " / 言われた金額 " + item.amount;
        block.appendChild(el("p", {}, line));
      });
      printSheet.appendChild(block);
    });
    printSheet.appendChild(el("h2", {}, "請求書が来てから"));
    M.visibleChecks(true).forEach(function (check) {
      printSheet.appendChild(el("h3", {}, check.title));
      printSheet.appendChild(el("p", {}, check.body));
    });
    printSheet.appendChild(el("p", {}, "出典：国土交通省「原状回復をめぐるトラブルとガイドライン」（再改訂版、平成23年8月）の案内とQ&A。契約が優先です。"));
  }

  function damageLabel(value) {
    if (value === M.DAMAGE.none) return "目立った傷はない";
    if (value === M.DAMAGE.yes) return "傷や汚れがある";
    return "まだ見ていない";
  }

  function choiceRow(pairs, current, onPick) {
    var row = el("div", { className: "choice-row" }, "");
    pairs.forEach(function (pair) {
      var b = el("button", { type: "button", className: "choice" }, pair[1]);
      b.setAttribute("aria-pressed", current === pair[0] ? "true" : "false");
      b.addEventListener("click", function () { onPick(pair[0]); });
      row.appendChild(b);
    });
    return row;
  }

  function field(labelText, type, value, onInput) {
    var input = document.createElement("input");
    input.type = type;
    input.value = value || "";
    input.maxLength = type === "date" ? 10 : 80;
    input.addEventListener("input", function () { onInput(input.value); });
    var wrap = el("div", {}, "");
    wrap.appendChild(el("label", {}, labelText));
    wrap.appendChild(input);
    return wrap;
  }

  function button(text, onClick, kind) {
    var node = el("button", { type: "button", className: kind ? "btn " + kind : "btn" }, text);
    node.addEventListener("click", onClick);
    return node;
  }

  function banner(text, kind) {
    return el("p", { className: "banner " + (kind || "") }, text);
  }

  function chipClass(label) {
    if (label === "見終わった") return "done";
    if (label === "途中") return "mid";
    return "";
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "className") node.className = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    if (text) node.textContent = text;
    return node;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  window.addEventListener("tachiai-summary", openSummary);
})();
