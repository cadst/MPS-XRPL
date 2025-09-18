// app/components/sections/FilterBar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryState } from "../../../hooks/useQueryState";

type Option = { label: string; value: string };

export default function FilterBar({
  categories = [],
  companies = [],
}: {
  categories?: Option[];
  companies?: Option[];
}) {
  const { get, set } = useQueryState();

  // URL 초기값 로딩
  const q0 = useMemo(() => get(), [get]);

  const [q, setQ] = useState(q0.q ?? "");
  const [category, setCategory] = useState(q0.category ?? "");
  const [company, setCompany] = useState(q0.company ?? "");
  const [minPrice, setMinPrice] = useState(q0.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(q0.maxPrice ?? "");
  const [sort, setSort] = useState<"latest" | "priceAsc" | "priceDesc" | "popular">(
    (q0.sort as any) ?? "latest"
  );

  // 검색 입력 디바운스
  useEffect(() => {
    const t = setTimeout(() => {
      set({
        q: q || undefined,
        page: 1, // 검색하면 첫 페이지로
      }, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [q, set]);

  // 드롭다운/숫자 변경 시 즉시 반영
  useEffect(() => {
    set(
      {
        category: category || undefined,
        company: company || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        sort,
        page: 1,
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, company, minPrice, maxPrice, sort]);

  const reset = () => {
    setQ("");
    setCategory("");
    setCompany("");
    setMinPrice("");
    setMaxPrice("");
    setSort("latest");
    set({}, { replace: true });
  };

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        {/* 검색어 */}
        <input
          placeholder="제목, 아티스트 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="col-span-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-white/25"
        />

        {/* 카테고리 */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
        >
          <option value="">전체 카테고리</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {/* 제공사 */}
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
        >
          <option value="">전체 제공사</option>
          {companies.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {/* 가격 */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="최소₩"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-white/25"
          />
          <span className="text-white/40">~</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="최대₩"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-white/25"
          />
        </div>

        {/* 정렬 */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
        >
          <option value="latest">최신순</option>
          <option value="popular">인기순</option>
          <option value="priceAsc">가격 낮은순</option>
          <option value="priceDesc">가격 높은순</option>
        </select>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <button
          onClick={reset}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
        >
          초기화
        </button>
      </div>
    </div>
  );
}
