// server.js
const express = require("express");
const cors = require("cors");
const { db } = require("./data"); 

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());


/* 유틸 */
const toInt = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const byIdDesc = [...db.musics].sort((a, b) => Number(b.id) - Number(a.id));
const catNameById = Object.fromEntries(
  db.categories.map((c) => [c.category_id, c.category_name])
);

const withCategoryName = (m) => ({
  ...m,
  category_name: catNameById[m.category_id] ?? null,
});

const filterByCategory = (list, categoryParam) => {
  if (!categoryParam) return list;
  const n = Number(categoryParam);
  if (Number.isFinite(n)) return list.filter((m) => Number(m.category_id) === n);
  const lower = String(categoryParam).toLowerCase();
  return list.filter(
    (m) => (catNameById[m.category_id] || "").toLowerCase() === lower
  );
};

const parseCreatedAt = (iso) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

const attachReward = (m) => {
  const unit = toInt(m.amount ?? m.price ?? 0, 0);
  const reward_amount = Math.max(1, Math.round(unit * 0.01));
  const reward_count = 200;
  const reward_total = reward_amount * reward_count;
  const used_count = toInt(m.views, 0) % reward_count;
  const reward_remaining = Math.max(0, reward_total - reward_amount * used_count);
  return { ...m, reward_amount, reward_count, reward_total, reward_remaining };
};


/* 라우터 */
app.get("/api/v1/categories", (_req, res) => {
  res.json({ items: db.categories });
});


app.get("/api/v1/musics/popular", (req, res) => {
  try {
    const { category, limit } = req.query;
    const N = toInt(limit, 10);

    const filtered = filterByCategory(db.musics, category);
    const sorted = [...filtered].sort((a, b) => {
      const d = toInt(b.likes, 0) - toInt(a.likes, 0);
      if (d !== 0) return d;
      return parseCreatedAt(b.created_at) - parseCreatedAt(a.created_at);
    });

    const items = sorted.slice(0, N).map((m) => attachReward(withCategoryName(m)));
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: { code: "INTERNAL", message: e.message || "error" } });
  }
});


app.get("/api/v1/musics", (req, res) => {
  try {
    const { category, cursor = "first", limit, sort = "new" } = req.query;
    const LIMIT = toInt(limit, 40);

    const filtered = filterByCategory(byIdDesc, category);

    // 정렬 적용
    let ordered = filtered;
    if (String(sort) === "popular") {
      ordered = [...filtered].sort((a, b) => toInt(b.likes, 0) - toInt(a.likes, 0));
    } else {
      ordered = [...filtered].sort((a, b) => {
        const tb = parseCreatedAt(b.created_at);
        const ta = parseCreatedAt(a.created_at);
        return tb - ta || Number(b.id) - Number(a.id);
      });
    }

    let start = 0;
    if (cursor !== "first") {
      const curId = Number(cursor);
      if (!Number.isFinite(curId)) {
        return res
          .status(400)
          .json({ error: { code: "BAD_CURSOR", message: "cursor must be 'first' or a number" } });
      }
      const idx = ordered.findIndex((m) => Number(m.id) === curId);
      start = idx >= 0 ? idx + 1 : 0;
    }

    const slice = ordered.slice(start, start + LIMIT);
    const items = slice.map((m) => attachReward(withCategoryName(m)));

    const nextCursor = start + LIMIT < ordered.length ? items[items.length - 1].id : null;

    res.json({ items, nextCursor });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: { code: "INTERNAL", message: e.message || "error" } });
  }
});


app.get("/api/v1/musics/:id", (req, res) => {
  try {
    const one = db.musics.find((m) => String(m.id) === String(req.params.id));
    if (!one) return res.status(404).json({ error: { code: "NOT_FOUND", message: "music not found" } });
    res.json(attachReward(withCategoryName(one)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: { code: "INTERNAL", message: e.message || "error" } });
  }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`server on ~ http://localhost:${PORT}`);
});
