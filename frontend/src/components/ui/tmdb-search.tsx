"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, Film, Check, Sparkles } from "lucide-react";
import Modal from "@/components/ui/modal";
import FormInput from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import { adminAPI } from "@/lib/api";
import type { TMDBSearchResult } from "@/lib/types";

export interface TMDBSelection {
  title: string;
  description: string;
  year: number;
  rating: number;
  poster_url: string;
  backdrop_url: string;
}

interface TMDBSearchButtonProps {
  initialQuery?: string;
  mediaType?: "movie" | "series";
  onSelect: (result: TMDBSelection) => void;
  className?: string;
}

export default function TMDBSearchButton({
  initialQuery = "",
  mediaType = "movie",
  onSelect,
  className = "",
}: TMDBSearchButtonProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [year, setYear] = useState("");
  const [type, setType] = useState<string>(mediaType);
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleOpen = () => {
    setQuery(initialQuery);
    setYear("");
    setType(mediaType);
    setResults([]);
    setSearched(false);
    setOpen(true);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const res = await adminAPI.searchTMDB(query, year ? Number(year) : 0, type);
      setResults(res.data.data || []);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelect = (result: TMDBSearchResult) => {
    onSelect({
      title: result.title,
      description: result.overview,
      year: result.year,
      rating: result.rating,
      poster_url: result.poster_url,
      backdrop_url: result.backdrop_url,
    });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20 ${className}`}
      >
        <Sparkles size={14} />
        Buscar en TMDB
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Buscar en TMDB" size="lg">
        <div className="space-y-4">
          {/* Search form */}
          <div className="flex gap-2">
            <div className="flex-1" onKeyDown={handleKeyDown}>
              <FormInput
                label="Titulo"
                name="tmdb_q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar pelicula o serie..."
              />
            </div>
            <div className="w-24" onKeyDown={handleKeyDown}>
              <FormInput
                label="Año"
                name="tmdb_y"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Año"
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <FormSelect
              label="Tipo"
              name="tmdb_t"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[
                { value: "movie", label: "Pelicula" },
                { value: "series", label: "Serie" },
              ]}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm mb-0.5"
            >
              <Search size={14} />
              {searching ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {results.map((r) => (
                <div
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className="flex gap-3 p-3 rounded-lg bg-dark-800/50 hover:bg-dark-700/50 cursor-pointer transition-colors group"
                >
                  {r.poster_url ? (
                    <div className="w-12 h-[72px] relative shrink-0 rounded overflow-hidden">
                      <Image
                        src={r.poster_url}
                        alt={r.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-[72px] bg-dark-700 rounded flex items-center justify-center shrink-0">
                      <Film size={16} className="text-dark-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-200 group-hover:text-dark-100 transition-colors">
                      {r.title}
                    </p>
                    <p className="text-xs text-dark-400">
                      {r.year > 0 ? r.year : "—"} · {r.rating > 0 ? `${r.rating.toFixed(1)}/10` : "Sin rating"}
                    </p>
                    {r.overview && (
                      <p className="text-xs text-dark-500 line-clamp-2 mt-1">{r.overview}</p>
                    )}
                  </div>
                  <div className="self-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Check size={18} className="text-primary-400" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {searched && results.length === 0 && !searching && (
            <p className="text-center text-dark-500 text-sm py-6">
              Sin resultados para &quot;{query}&quot;
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
