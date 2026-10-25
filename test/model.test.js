var assert = require("assert");
var M = require("../site/js/model.js");

function memory(initial) {
  var data = Object.assign({}, initial || {});
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function (key, value) {
      data[key] = String(value);
    }
  };
}

var blank = M.blankRecord();
var emptySummary = M.summarize(blank);
assert.strictEqual(emptySummary.unseen, emptySummary.total);
assert.strictEqual(emptySummary.damaged.length, 0);
assert.ok(emptySummary.total > 20);

var marked = M.updateItem(blank, "genkan", "wall", {
  damage: "yes",
  note: "  窓の下  ",
  photo: true,
  talk: "amount",
  amount: "1万円"
});
var wall = M.getItem(marked, "genkan", "wall");
assert.strictEqual(wall.note, "窓の下");
assert.strictEqual(wall.amount, "1万円");
assert.strictEqual(M.roomProgress(marked, M.CATALOG[0]).label, "途中");

var cleared = M.updateItem(marked, "genkan", "wall", { talk: "none" });
assert.strictEqual(M.getItem(cleared, "genkan", "wall").amount, "");

var longNote = new Array(250).join("あ");
var clipped = M.updateItem(blank, "toilet", "bowl", { damage: "yes", note: longNote });
assert.strictEqual(M.getItem(clipped, "toilet", "bowl").note.length, 200);

assert.strictEqual(M.updateItem(blank, "nope", "wall", { damage: "yes" }), blank);

var badDamage = M.updateItem(blank, "genkan", "floor", { damage: "huge" });
assert.strictEqual(M.getItem(badDamage, "genkan", "floor").damage, "unknown");

assert.throws(function () { M.parseImport("not-json"); }, /JSON/);
assert.throws(function () { M.parseImport(JSON.stringify({ version: 2 })); }, /版/);

var round = M.parseImport(JSON.stringify(marked));
assert.strictEqual(M.getItem(round, "genkan", "wall").amount, "1万円");
assert.strictEqual(round.property.name, "");

var polluted = M.parseImport(JSON.stringify({
  version: 1,
  property: { name: "x", moveInPhotos: "sideways" },
  items: { "genkan:floor": { damage: "none", photo: "yes", talk: "amount", amount: "500" } }
}));
assert.strictEqual(polluted.property.moveInPhotos, "unknown");
assert.strictEqual(M.getItem(polluted, "genkan", "floor").photo, false);
assert.strictEqual(M.getItem(polluted, "genkan", "floor").amount, "500");

var store = memory();
assert.strictEqual(M.loadRecord(store).record.property.name, "");
assert.strictEqual(M.saveRecord(store, marked).ok, true);
assert.strictEqual(M.loadRecord(store).record.property.name, "");
assert.strictEqual(M.getItem(M.loadRecord(store).record, "genkan", "wall").note, "窓の下");
store.setItem(M.STORAGE_KEY, "{");
assert.ok(M.loadRecord(store).error);

var broken = {
  getItem: function () { return null; },
  setItem: function () { throw new Error("full"); }
};
assert.strictEqual(M.saveRecord(broken, blank).ok, false);

assert.strictEqual(M.isUnlocked(memory()), false);
var unlockedStore = memory();
M.setUnlocked(unlockedStore);
assert.strictEqual(M.isUnlocked(unlockedStore), true);
assert.strictEqual(M.visibleChecks(false).length, 1);
assert.strictEqual(M.visibleChecks(true).length, M.BILL_CHECKS.length);

assert.strictEqual(M.PRICE_YEN, 500);
assert.strictEqual(M.boothDownloadFeeYen(1480), 128);
assert.strictEqual(1480 - M.boothDownloadFeeYen(1480), 1352);
assert.throws(function () { M.boothDownloadFeeYen(14.8); }, /価格/);

var sample = M.sampleRecord();
assert.strictEqual(M.summarize(sample).damaged.length, 1);
assert.strictEqual(M.summarize(sample).amounts.length, 1);
assert.strictEqual(sample.property.name, "サンプルマンション 101");

var allSeen = blank;
M.CATALOG.forEach(function (room) {
  room.items.forEach(function (item) {
    allSeen = M.updateItem(allSeen, room.id, item[0], { damage: "none" });
  });
  assert.strictEqual(M.roomProgress(allSeen, room).label, "見終わった");
});
assert.strictEqual(M.summarize(allSeen).unseen, 0);

console.log("model tests passed");
