"use client";

import { useMemo, useState } from "react";
import {
  SENSORY_KINDS,
  type SensoryKind,
  type SensoryOption,
  type SensoryProfile,
} from "./khora-sensory";

type ChipGroupProps = {
  label: string;
  help: string;
  options: SensoryOption[];
  selected: number[];
  multiple: boolean;
  onChange: (ids: number[]) => void;
};

function SensoryChipGroup({ label, help, options, selected, multiple, onChange }: ChipGroupProps) {
  const toggle = (id: number) => {
    if (multiple) {
      onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
      return;
    }
    onChange(selected[0] === id ? [] : [id]);
  };

  const buttons = options.map((option) => {
    const isSelected = selected.includes(option.id);
    return <button
      key={option.id}
      type="button"
      role={multiple ? undefined : "radio"}
      aria-checked={multiple ? undefined : isSelected}
      aria-pressed={multiple ? isSelected : undefined}
      className={isSelected ? "sensory-chip selected" : "sensory-chip"}
      onClick={() => toggle(option.id)}
    >
      {option.label}
    </button>;
  });

  return <fieldset className="sensory-fieldset">
    <legend>{label}</legend>
    <p>{help}</p>
    {multiple
      ? <div className="sensory-chip-list">{buttons}</div>
      : <div className="sensory-chip-list" role="radiogroup" aria-label={label}>{buttons}</div>}
  </fieldset>;
}

function AromaNotesSelector({ options, selected, onChange }: {
  options: SensoryOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("es");
  const visible = options.filter((option) => option.label.toLocaleLowerCase("es").includes(normalized));
  const chosen = selected
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is SensoryOption => Boolean(option));

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  };

  return <fieldset className="sensory-fieldset sensory-notes-fieldset">
    <legend>Notas aromáticas</legend>
    <p>Buscá y elegí todas las notas que describen el aroma.</p>
    <input
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Buscar una nota aromática…"
      aria-label="Buscar una nota aromática"
    />
    {chosen.length > 0 && <div className="sensory-selected-notes" aria-label="Notas seleccionadas">
      {chosen.map((option) => <button
        key={option.id}
        type="button"
        onClick={() => toggle(option.id)}
        aria-label={`Quitar ${option.label}`}
      >
        {option.label}<span aria-hidden="true">×</span>
      </button>)}
    </div>}
    <div className="sensory-note-results">
      {visible.map((option) => <button
        key={option.id}
        type="button"
        aria-pressed={selected.includes(option.id)}
        onClick={() => toggle(option.id)}
      >
        {option.label}
      </button>)}
      {!visible.length && <span>No encontramos notas con ese nombre.</span>}
    </div>
  </fieldset>;
}

type GroupedOptions = Record<SensoryKind, SensoryOption[]>;

function groupOptions(options: SensoryOption[]): GroupedOptions {
  const grouped = Object.fromEntries(SENSORY_KINDS.map((kind) => [kind, []])) as GroupedOptions;
  for (const option of options) grouped[option.kind].push(option);
  return grouped;
}

function labelsFor(ids: number[], options: SensoryOption[]) {
  return ids
    .map((id) => options.find((option) => option.id === id)?.label)
    .filter((label): label is string => Boolean(label))
    .join(", ");
}

function SensoryProfilePreview({ options, value, description }: {
  options: SensoryOption[];
  value: SensoryProfile;
  description: string;
}) {
  const rows = [
    ["Familia olfativa", labelsFor(value.families, options)],
    ["Notas aromáticas", labelsFor(value.notes, options)],
    ["Sensación", labelsFor(value.sensations, options)],
    ["Intensidad", labelsFor(value.intensity ? [value.intensity] : [], options)],
    ["Ambiente ideal", labelsFor(value.rooms, options)],
    ["Momento recomendado", labelsFor(value.moment ? [value.moment] : [], options)],
    ["Descripción pública", description.trim()],
  ].filter((row) => row[1]);

  return <aside className="sensory-profile-preview" aria-live="polite" aria-label="Vista previa del perfil sensorial">
    <header>
      <span>VISTA PREVIA</span>
      <h4>Perfil del producto</h4>
    </header>
    {rows.length > 0
      ? <dl>{rows.map(([label, value]) => <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>)}</dl>
      : <p className="sensory-profile-empty">Completá el perfil para ver el resumen.</p>}
  </aside>;
}

export function SensoryProfileEditor({
  options,
  value,
  description,
  loading,
  error,
  onChange,
  onDescriptionChange,
  onRetry,
}: {
  options: SensoryOption[];
  value: SensoryProfile;
  description: string;
  loading: boolean;
  error: string;
  onChange: (value: SensoryProfile) => void;
  onDescriptionChange: (value: string) => void;
  onRetry: () => void;
}) {
  const grouped = useMemo(() => groupOptions(options), [options]);

  return <section className="sensory-profile-editor" aria-labelledby="sensory-profile-title">
    <header>
      <div>
        <span>IDENTIDAD DEL PRODUCTO</span>
        <h3 id="sensory-profile-title">Perfil sensorial</h3>
        <p>Definí cómo se percibe el producto con opciones claras y consistentes.</p>
      </div>
    </header>

    {loading && <p className="sensory-profile-status" role="status">Cargando perfil sensorial…</p>}
    {!loading && error && <div className="sensory-profile-error" role="alert">
      <span>{error}</span>
      <button type="button" onClick={onRetry}>Reintentar</button>
    </div>}
    {!loading && !error && <div className="sensory-profile-layout">
      <div className="sensory-profile-fields">
        <SensoryChipGroup
          label="Familia olfativa"
          help="Elegí una o más familias principales."
          options={grouped.FAMILY}
          selected={value.families}
          multiple
          onChange={(families) => onChange({ ...value, families })}
        />
        <AromaNotesSelector
          options={grouped.NOTE}
          selected={value.notes}
          onChange={(notes) => onChange({ ...value, notes })}
        />
        <SensoryChipGroup
          label="Sensación"
          help="Marcá las sensaciones que transmite."
          options={grouped.SENSATION}
          selected={value.sensations}
          multiple
          onChange={(sensations) => onChange({ ...value, sensations })}
        />
        <SensoryChipGroup
          label="Intensidad"
          help="Elegí una intensidad predominante."
          options={grouped.INTENSITY}
          selected={value.intensity ? [value.intensity] : []}
          multiple={false}
          onChange={(ids) => onChange({ ...value, intensity: ids[0] ?? null })}
        />
        <SensoryChipGroup
          label="Ambiente ideal"
          help="Indicá todos los espacios donde funciona mejor."
          options={grouped.ROOM}
          selected={value.rooms}
          multiple
          onChange={(rooms) => onChange({ ...value, rooms })}
        />
        <SensoryChipGroup
          label="Momento recomendado"
          help="Elegí el momento que mejor acompaña."
          options={grouped.MOMENT}
          selected={value.moment ? [value.moment] : []}
          multiple={false}
          onChange={(ids) => onChange({ ...value, moment: ids[0] ?? null })}
        />
        <label className="sensory-public-description">
          <span>Descripción pública <small>OPCIONAL</small></span>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Contá brevemente qué hace especial a este producto…"
          />
          <small>Este texto puede mostrarse en KHORA Tienda.</small>
        </label>
      </div>
      <SensoryProfilePreview options={options} value={value} description={description} />
    </div>}
  </section>;
}