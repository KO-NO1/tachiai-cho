(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.TachiaiModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var STORAGE_KEY = "tachiai-cho-record-v1";
  var UNLOCK_KEY = "tachiai-cho-unlock-v1";
  var PRICE_YEN = 1480;
  var NOTE_MAX = 200;
  var AMOUNT_MAX = 80;
  var PROPERTY_MAX = 80;

  var DAMAGE = { unknown: "unknown", none: "none", yes: "yes" };
  var TALK = { none: "none", noted: "noted", amount: "amount" };
  var PHOTOS = { unknown: "unknown", yes: "yes", no: "no" };

  var QA = "https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000024.html";
  var GUIDE = "https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000020.html";
  var HOTLINE = "https://www.caa.go.jp/policies/policy/local_cooperation/local_consumer_administration/hotline/";

  var CATALOG = [
    {
      id: "genkan",
      name: "玄関・廊下",
      hint: "ドアを閉めた状態、床の全体、傷があればその近くを、自分のスマホのカメラで撮る。このアプリには写真を送りません。",
      items: [
        ["ceiling", "天井"],
        ["wall", "壁"],
        ["floor", "床"],
        ["door", "玄関ドア"],
        ["key", "鍵"],
        ["shoe", "下駄箱"],
        ["light", "照明"],
        ["post", "郵便受け"]
      ]
    },
    {
      id: "living",
      name: "台所・居間",
      hint: "壁と床は部屋の端から全体が分かるように撮り、コンロやシンクは別に撮る。",
      items: [
        ["ceiling", "天井"],
        ["wall", "壁"],
        ["floor", "床"],
        ["sink", "流し台・コンロ"],
        ["fan", "換気扇"],
        ["water", "給湯・給排水"],
        ["light", "照明"],
        ["shelf", "戸棚"]
      ]
    },
    {
      id: "bath",
      name: "浴室",
      hint: "排水口、浴槽のフチ、換気扇を分けて見る。カビは場所と範囲をメモする。",
      items: [
        ["surface", "天井・壁・床"],
        ["door", "ドア"],
        ["tub", "浴槽"],
        ["shower", "シャワー"],
        ["fan", "換気扇"],
        ["drain", "排水"]
      ]
    },
    {
      id: "wash",
      name: "洗面所",
      hint: "洗面ボウルの中、水栓の根元、洗濯機の防水パンを見る。",
      items: [
        ["surface", "天井・壁・床"],
        ["basin", "洗面台"],
        ["washer", "洗濯機置場"],
        ["water", "給排水"],
        ["light", "照明"]
      ]
    },
    {
      id: "toilet",
      name: "トイレ",
      hint: "便器の中だけなく、床との境目と壁の下部を見る。",
      items: [
        ["surface", "天井・壁・床"],
        ["bowl", "便器"],
        ["tank", "タンク"],
        ["fan", "換気扇"],
        ["holder", "ペーパーホルダー"]
      ]
    },
    {
      id: "room",
      name: "洋室・和室",
      hint: "2部屋目以降は、メモの先頭に「洋室2」のように部屋名を書く。",
      items: [
        ["ceiling", "天井"],
        ["wall", "壁"],
        ["floor", "床・畳"],
        ["storage", "収納"],
        ["fittings", "ドア・襖"],
        ["light", "照明"]
      ]
    },
    {
      id: "other",
      name: "設備・バルコニー",
      hint: "エアコンはフィルターではなく、本体の固定と水漏れ跡を見る。",
      items: [
        ["ac", "エアコン"],
        ["outlet", "コンセント・スイッチ"],
        ["balcony", "バルコニー"],
        ["pole", "物干し"]
      ]
    }
  ];

  var BILL_CHECKS = [
    {
      id: "sign",
      free: true,
      title: "傷の確認と、金額の了承を分けて残す",
      body: "国交省のQ&A（Q14）では、傷があることを確認したことと、その修理代を払うことを了承したことは区別されています。金額の負担を了承した場合は、その内容が負担額の基準になりうるとされています。金額を書く欄が出たら、その場で埋めず、内訳は後でもらうと伝えて、ここへ記録してください。故意や過失でない傷まで払う義務がある、という意味には読み替えないでください。特約がある契約は別です。"
    },
    {
      id: "unit",
      free: false,
      title: "クロスの一部の傷が、部屋全体の枚数になっていないか",
      body: "Q7では、不注意で付けた傷は修理が必要だとしたうえで、経過年数を考慮し、最低限の施工単位（傷を含む一面の張替えまではやむを得ない場合がある）が妥当、としています。部屋全部の張替え枚数で請求されたら、一面なのか部屋全体なのかを請求書で確認します。このアプリは枚数の正否を判定しません。"
    },
    {
      id: "detail",
      free: false,
      title: "敷金から差し引くなら、明細を求める",
      body: "Q17の公表されている答えでは、敷金から差し引く原状回復費用について説明があり、明細を請求できるとされています。部位、単価、数量、入居年数の扱いが無い請求は、払う前に明細を求めてください。"
    },
    {
      id: "price",
      free: false,
      title: "単価だけを見て高いと判断しない",
      body: "Q13は、クロスの単価が以前より高いと感じたときの質問です。単価の感じ方だけでは負担の有無は決まりません。単価、数量、経過年数、入居時からの差をセットで見ます。"
    },
    {
      id: "clean",
      free: false,
      title: "クリーニング特約は、文面だけで有効とも無効とも言えない",
      body: "Q16では、負担する内容と範囲が示されているか、通常損耗も負担する趣旨と範囲が書かれているか説明されているか、費用として妥当か、から特約の効力が判断されるとされています。契約書のその条項を読んでから相談してください。"
    },
    {
      id: "ask",
      free: false,
      title: "一人で決めず、消費生活相談窓口へ電話する",
      body: "どこへ相談するか分からないときは、消費者ホットライン188（消費者庁）。郵便番号を入力すると、近くの消費生活センター等へ案内されます。相談自体は無料で、窓口につながったあとの通話料はかかります。年末年始（12月29日〜1月3日）を除き原則毎日ですが、窓口の受付時間は自治体で違います。このアプリの運営者は交渉を代行しません。"
    }
  ];

  function blankItem() {
    return { damage: DAMAGE.unknown, note: "", photo: false, talk: TALK.none, amount: "" };
  }

  function blankRecord() {
    return {
      version: 1,
      property: { name: "", address: "", moveOut: "", moveInPhotos: PHOTOS.unknown },
      items: {},
      roomNotes: {}
    };
  }

  function itemKey(roomId, itemId) {
    return roomId + ":" + itemId;
  }

  function clip(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
  }

  function findRoom(roomId) {
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].id === roomId) return CATALOG[i];
    }
    return null;
  }

  function findItem(room, itemId) {
    for (var i = 0; i < room.items.length; i++) {
      if (room.items[i][0] === itemId) return room.items[i];
    }
    return null;
  }

  function getItem(record, roomId, itemId) {
    var current = record.items[itemKey(roomId, itemId)];
    if (!current) return blankItem();
    return {
      damage: current.damage,
      note: current.note,
      photo: current.photo,
      talk: current.talk,
      amount: current.amount
    };
  }

  function updateProperty(record, patch) {
    var next = cloneRecord(record);
    var src = patch || {};
    if (Object.prototype.hasOwnProperty.call(src, "name")) next.property.name = clip(src.name, PROPERTY_MAX);
    if (Object.prototype.hasOwnProperty.call(src, "address")) next.property.address = clip(src.address, PROPERTY_MAX);
    if (Object.prototype.hasOwnProperty.call(src, "moveOut")) next.property.moveOut = clip(src.moveOut, 10);
    if (Object.prototype.hasOwnProperty.call(src, "moveInPhotos") && PHOTOS[src.moveInPhotos]) {
      next.property.moveInPhotos = src.moveInPhotos;
    }
    return next;
  }

  function updateRoomNote(record, roomId, note) {
    if (!findRoom(roomId)) return record;
    var next = cloneRecord(record);
    next.roomNotes[roomId] = clip(note, NOTE_MAX);
    return next;
  }

  function updateItem(record, roomId, itemId, patch) {
    var room = findRoom(roomId);
    if (!room || !findItem(room, itemId)) return record;
    var next = cloneRecord(record);
    var current = getItem(record, roomId, itemId);
    var src = patch || {};
    if (Object.prototype.hasOwnProperty.call(src, "damage") && DAMAGE[src.damage]) current.damage = src.damage;
    if (Object.prototype.hasOwnProperty.call(src, "note")) current.note = clip(src.note, NOTE_MAX);
    if (Object.prototype.hasOwnProperty.call(src, "photo")) current.photo = src.photo === true;
    if (Object.prototype.hasOwnProperty.call(src, "talk") && TALK[src.talk]) current.talk = src.talk;
    if (Object.prototype.hasOwnProperty.call(src, "amount")) current.amount = clip(src.amount, AMOUNT_MAX);
    if (current.talk !== TALK.amount) current.amount = "";
    next.items[itemKey(roomId, itemId)] = current;
    return next;
  }

  function cloneRecord(record) {
    return {
      version: 1,
      property: {
        name: record.property.name,
        address: record.property.address,
        moveOut: record.property.moveOut,
        moveInPhotos: record.property.moveInPhotos
      },
      items: JSON.parse(JSON.stringify(record.items)),
      roomNotes: JSON.parse(JSON.stringify(record.roomNotes))
    };
  }

  function roomProgress(record, room) {
    var total = room.items.length;
    var decided = 0;
    var damaged = 0;
    var amounts = 0;
    for (var i = 0; i < room.items.length; i++) {
      var item = getItem(record, room.id, room.items[i][0]);
      if (item.damage !== DAMAGE.unknown) decided += 1;
      if (item.damage === DAMAGE.yes) damaged += 1;
      if (item.talk === TALK.amount && item.amount) amounts += 1;
    }
    var label = "未着手";
    if (decided === total && total > 0) label = "見終わった";
    else if (decided > 0) label = "途中";
    return { total: total, decided: decided, damaged: damaged, amounts: amounts, label: label };
  }

  function summarize(record) {
    var damaged = [];
    var amounts = [];
    var unseen = 0;
    var decided = 0;
    var total = 0;
    var photos = 0;
    for (var r = 0; r < CATALOG.length; r++) {
      var room = CATALOG[r];
      for (var i = 0; i < room.items.length; i++) {
        total += 1;
        var spec = room.items[i];
        var item = getItem(record, room.id, spec[0]);
        if (item.damage === DAMAGE.unknown) unseen += 1;
        else decided += 1;
        if (item.photo) photos += 1;
        if (item.damage === DAMAGE.yes) {
          damaged.push({
            roomId: room.id,
            roomName: room.name,
            itemId: spec[0],
            itemName: spec[1],
            note: item.note,
            talk: item.talk,
            amount: item.amount
          });
        }
        if (item.talk === TALK.amount && item.amount) {
          amounts.push({
            roomName: room.name,
            itemName: spec[1],
            amount: item.amount
          });
        }
      }
    }
    return {
      damaged: damaged,
      amounts: amounts,
      unseen: unseen,
      decided: decided,
      total: total,
      photos: photos,
      moveInPhotos: record.property.moveInPhotos
    };
  }

  function sampleRecord() {
    var record = blankRecord();
    record = updateProperty(record, {
      name: "サンプルマンション 101",
      address: "実在しない例です",
      moveOut: "2026-11-01",
      moveInPhotos: PHOTOS.yes
    });
    record = updateItem(record, "genkan", "wall", {
      damage: DAMAGE.yes,
      note: "下駄箱の横に幅2cmほどの擦れ",
      photo: true,
      talk: TALK.amount,
      amount: "張替え一式3万円と言われた"
    });
    record = updateItem(record, "genkan", "floor", {
      damage: DAMAGE.none,
      photo: true,
      talk: TALK.none
    });
    return record;
  }

  function parseImport(raw) {
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error("JSONとして読めませんでした。");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("記録の形式ではありません。");
    }
    if (data.version !== 1) {
      throw new Error("この版では読めない記録です。");
    }
    var record = blankRecord();
    record = updateProperty(record, data.property || {});
    var notes = data.roomNotes || {};
    for (var r = 0; r < CATALOG.length; r++) {
      if (typeof notes[CATALOG[r].id] === "string") {
        record = updateRoomNote(record, CATALOG[r].id, notes[CATALOG[r].id]);
      }
    }
    var items = data.items || {};
    var keys = Object.keys(items);
    for (var k = 0; k < keys.length; k++) {
      var parts = keys[k].split(":");
      if (parts.length !== 2) continue;
      var src = items[keys[k]];
      if (!src || typeof src !== "object") continue;
      record = updateItem(record, parts[0], parts[1], {
        damage: src.damage,
        note: src.note,
        photo: src.photo === true,
        talk: src.talk,
        amount: src.amount
      });
    }
    return record;
  }

  function loadRecord(storage) {
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) return { record: blankRecord(), error: "" };
      return { record: parseImport(raw), error: "" };
    } catch (e) {
      return { record: blankRecord(), error: "保存済みの記録を読めなかったので、新しく始めます。" };
    }
  }

  function saveRecord(storage, record) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(record));
      return { ok: true, error: "" };
    } catch (e) {
      return { ok: false, error: "このブラウザには保存できませんでした。まとめを書き写すか、別のブラウザで開いてください。" };
    }
  }

  function isUnlocked(storage) {
    try {
      return storage.getItem(UNLOCK_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setUnlocked(storage) {
    storage.setItem(UNLOCK_KEY, "1");
  }

  function boothDownloadFeeYen(priceYen) {
    if (!isSafeYen(priceYen)) throw new Error("価格が不正です");
    return Math.ceil((priceYen * 56) / 1000 + 45);
  }

  function isSafeYen(priceYen) {
    return typeof priceYen === "number" && priceYen >= 0 && priceYen <= 1000000 && Math.floor(priceYen) === priceYen;
  }

  function visibleChecks(unlocked) {
    return BILL_CHECKS.filter(function (item) {
      return item.free || unlocked;
    });
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    UNLOCK_KEY: UNLOCK_KEY,
    PRICE_YEN: PRICE_YEN,
    CATALOG: CATALOG,
    BILL_CHECKS: BILL_CHECKS,
    DAMAGE: DAMAGE,
    TALK: TALK,
    PHOTOS: PHOTOS,
    QA: QA,
    GUIDE: GUIDE,
    HOTLINE: HOTLINE,
    blankRecord: blankRecord,
    getItem: getItem,
    updateProperty: updateProperty,
    updateRoomNote: updateRoomNote,
    updateItem: updateItem,
    roomProgress: roomProgress,
    summarize: summarize,
    sampleRecord: sampleRecord,
    parseImport: parseImport,
    loadRecord: loadRecord,
    saveRecord: saveRecord,
    isUnlocked: isUnlocked,
    setUnlocked: setUnlocked,
    boothDownloadFeeYen: boothDownloadFeeYen,
    visibleChecks: visibleChecks,
    findRoom: findRoom
  };
});
