import DadataSuggest from "@/components/ui/dadata-suggest";
import dadata, { DadataAddressSuggestion } from "@/lib/dadata";
import Icon from "@/components/ui/icon";

interface AddressSuggestProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const AddressSuggest = ({ value, onChange, placeholder = "Начните вводить адрес...", className }: AddressSuggestProps) => (
  <DadataSuggest<DadataAddressSuggestion>
    value={value}
    onChange={onChange}
    fetchSuggestions={(q) => dadata.suggestAddress(q)}
    getSuggestionValue={(item) => item.value}
    renderSuggestion={(item) => (
      <div className="flex items-start gap-2">
        <Icon name="MapPin" size={14} className="text-muted-foreground mt-0.5 shrink-0" />
        <span>{item.value}</span>
      </div>
    )}
    placeholder={placeholder}
    className={className}
    minChars={3}
  />
);

export default AddressSuggest;
