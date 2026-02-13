import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { Member } from "@/lib/api";

interface MemberSearchProps {
  members: Member[];
  value: string;
  onChange: (memberId: string, memberName: string) => void;
  placeholder?: string;
}

const MemberSearch = ({ members, value, onChange, placeholder = "Начните вводить ФИО или номер..." }: MemberSearchProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = members.find(m => String(m.id) === value);

  useEffect(() => {
    if (selected) setQuery("");
  }, [selected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.length > 0
    ? members.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.member_no.toLowerCase().includes(query.toLowerCase()) ||
        m.inn?.toLowerCase().includes(query.toLowerCase()) ||
        m.phone?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
    : members.slice(0, 10);

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
          <Icon name={selected.member_type === "FL" ? "User" : "Building2"} size={14} className="text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block">{selected.name}</span>
            <span className="text-xs text-muted-foreground">{selected.member_no}{selected.inn ? ` / ИНН ${selected.inn}` : ""}</span>
          </div>
          <button type="button" className="text-muted-foreground hover:text-foreground p-0.5" onClick={() => { onChange("", ""); setQuery(""); }}>
            <Icon name="X" size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-9"
          />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              {query ? "Пайщик не найден" : "Нет пайщиков"}
            </div>
          ) : (
            filtered.map(m => (
              <button
                key={m.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                onClick={() => { onChange(String(m.id), m.name); setOpen(false); setQuery(""); }}
              >
                <Icon name={m.member_type === "FL" ? "User" : "Building2"} size={14} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.member_no}{m.inn ? ` / ИНН ${m.inn}` : ""}{m.phone ? ` / ${m.phone}` : ""}</div>
                </div>
                {m.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default MemberSearch;
