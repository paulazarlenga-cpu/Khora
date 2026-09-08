"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";

export type CollectionRow = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  status: "DRAFT" | "PUBLISHED";
  visible_in_store: boolean;
  sort_order: number;
  item_count: number;
};

export type CollectionCatalogItem = {
  id: number;
  code: string;
  name: string;
  type: string;
  comboId?: number;
};

type CollectionItem = CollectionCatalogItem & { sortOrder: number };

type Props = {
  rows: CollectionRow[];
  products: CollectionCatalogItem[];
  loading: boolean;
  onChanged: (message: string) => void;
};

const typeLabel = (type: string) => type === "COMBO" ? "Combo" : "Producto";

function normalizedSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "coleccion";
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operación.");
  return data;
}

export function CollectionsManager({ rows, products, loading, onChanged }: Props) {
  const [editing, setEditing] = useState<CollectionRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CollectionRow | null>(null);
  const nextOrder = Math.max(0, ...rows.map((row) => Number(row.sort_order) || 0)) + 1;

  return <>
    <section className="panel collection-panel">
      <header className="panel-head collection-panel-head">
        <div><h2>Colecciones</h2><p>Organizá qué productos y combos querés mostrar juntos en KHORA Tienda.</p></div>
        <button className="primary-button" onClick={() => setEditing(null)}>＋ Nueva colección</button>
      </header>
      <div className="panel-body">
        <div className="data-table-wrap collection-table-wrap">
          <table className="data-table collection-table">
            <thead><tr><th>Colección</th><th>Elementos</th><th>Estado</th><th>Tienda</th><th>Orden</th><th>Acciones</th></tr></thead>
            <tbody>{rows.map((collection) => <tr key={collection.id}>
              <td><strong>{collection.name}</strong><small className="table-sub">/{collection.slug}</small></td>
              <td>{collection.item_count} {collection.item_count === 1 ? "elemento" : "elementos"}</td>
              <td><span className={`badge ${collection.status === "PUBLISHED" ? "success" : "neutral"}`}><i />{collection.status === "PUBLISHED" ? "Publicada" : "Borrador"}</span></td>
              <td><span className={`badge ${collection.visible_in_store ? "info" : "neutral"}`}><i />{collection.visible_in_store ? "Visible" : "Oculta"}</span></td>
              <td><strong>{collection.sort_order}</strong></td>
              <td><div className="collection-row-actions"><button className="table-open-button" onClick={() => setEditing(collection)}>Editar</button><button className="row-icon-button danger" title={`Eliminar ${collection.name}`} aria-label={`Eliminar ${collection.name}`} onClick={() => setDeleting(collection)}>⌫</button></div></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!loading && !rows.length && <div className="collection-empty"><strong>Todavía no hay colecciones creadas.</strong><button className="primary-button" onClick={() => setEditing(null)}>＋ Crear primera colección</button></div>}
        {loading && !rows.length && <div className="recipe-empty">Cargando colecciones…</div>}
      </div>
    </section>
    {editing !== undefined && <CollectionFormDrawer key={editing?.id ?? "new"} collection={editing ?? undefined} products={products} nextOrder={nextOrder} onCancel={() => setEditing(undefined)} onSaved={(message) => { setEditing(undefined); onChanged(message); }} />}
    {deleting && <CollectionDeleteDialog collection={deleting} onCancel={() => setDeleting(null)} onDeleted={(message) => { setDeleting(null); onChanged(message); }} />}
  </>;
}

function CollectionFormDrawer({ collection, products, nextOrder, onCancel, onSaved }: { collection?: CollectionRow; products: CollectionCatalogItem[]; nextOrder: number; onCancel: () => void; onSaved: (message: string) => void }) {
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(collection?.status ?? "DRAFT");
  const [visible, setVisible] = useState(collection ? Boolean(collection.visible_in_store) : true);
  const [sortOrder, setSortOrder] = useState(Number(collection?.sort_order ?? nextOrder));
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(Boolean(collection));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const slug = collection?.slug ?? normalizedSlug(name);

  useEffect(() => {
    if (!collection) return;
    let active = true;
    fetch(`/api/khora?entity=collection_definition&id=${collection.id}`)
      .then((response) => readJson<{ collection: CollectionRow; items: Array<CollectionCatalogItem & { sort_order: number }> }>(response))
      .then((data) => {
        if (!active) return;
        setName(data.collection.name); setDescription(data.collection.description ?? ""); setStatus(data.collection.status); setVisible(Boolean(data.collection.visible_in_store)); setSortOrder(Number(data.collection.sort_order));
        setItems(data.items.map((item, index) => ({ ...item, comboId: item.comboId, sortOrder: Number(item.sort_order) || index + 1 })));
        setError("");
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar la colección."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [collection]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  function reorder(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    setItems((current) => {
      const next = [...current]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
      return next.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    });
  }

  function dropAt(event: DragEvent<HTMLElement>, index: number) {
    event.preventDefault();
    if (draggedIndex !== null) reorder(draggedIndex, index);
    setDraggedIndex(null);
  }

  async function save() {
    if (!name.trim()) { setError("Ingresá el nombre de la colección."); return; }
    if (!Number.isInteger(sortOrder) || sortOrder < 1) { setError("El orden debe ser un número entero mayor que cero."); return; }
    setSaving(true); setError("");
    try {
      const data = await readJson<{ id: number }>(await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_collection", id: collection?.id, name: name.trim(), description: description.trim(), status, visibleInStore: visible, sortOrder, items: items.map((item) => ({ productId: item.id })) }) }));
      window.dispatchEvent(new CustomEvent("khora:data-changed", { detail: { entity: "collections", id: data.id } }));
      onSaved(collection ? `Colección ${name.trim()} actualizada.` : `Colección ${name.trim()} creada.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la colección."); }
    finally { setSaving(false); }
  }

  return <div className="drawer-layer collection-drawer-layer">
    <button className="drawer-backdrop" onClick={onCancel} aria-label="Cerrar colección" />
    <aside className="inventory-form-drawer collection-form-drawer" role="dialog" aria-modal="true" aria-labelledby="collection-form-title">
      <header><div><p>PRODUCTOS · COLECCIONES</p><h2 id="collection-form-title">{collection ? "Editar colección" : "Nueva colección"}</h2><span>Definí la selección comercial que verá KHORA Tienda.</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header>
      <div className="inventory-form-body collection-form-body">
        {loading ? <div className="recipe-empty">Cargando colección…</div> : <>
          <div className="form-grid"><label><span>Nombre de la colección *</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Regalos" /></label><label><span>Slug</span><input value={slug} readOnly /><small>Se crea automáticamente y permanece estable al cambiar el nombre.</small></label></div>
          <label><span>Descripción</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Nuestra selección esencial para todos los días." /></label>
          <div className="form-grid"><label><span>Estado</span><select value={status} onChange={(event) => setStatus(event.target.value as "DRAFT" | "PUBLISHED")}><option value="DRAFT">Borrador</option><option value="PUBLISHED">Publicada</option></select></label><label><span>Orden en la tienda</span><input type="number" min="1" step="1" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></label></div>
          <label className="collection-store-toggle"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /><span><strong>Mostrar en KHORA Tienda</strong><small>La colección será pública solo si además está en estado Publicada.</small></span><i aria-hidden="true" /></label>
          <section className="collection-items-editor" aria-labelledby="collection-items-title">
            <header><div><strong id="collection-items-title">Productos y combos</strong><p>Ordená la aparición y reutilizá los registros reales del catálogo.</p></div><button type="button" onClick={() => setPickerOpen(true)}>＋ Agregar productos o combos</button></header>
            <div className="collection-item-list">{items.map((item, index) => <article key={item.id} draggable onDragStart={() => setDraggedIndex(index)} onDragEnd={() => setDraggedIndex(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropAt(event, index)} className={draggedIndex === index ? "is-dragging" : ""}>
              <span className="collection-drag" aria-hidden="true">☰</span><div><strong>{item.name}</strong><small>{typeLabel(item.type)} · {item.code}</small></div><div className="collection-order-buttons"><button type="button" disabled={index === 0} onClick={() => reorder(index, index - 1)} aria-label={`Subir ${item.name}`}>↑</button><button type="button" disabled={index === items.length - 1} onClick={() => reorder(index, index + 1)} aria-label={`Bajar ${item.name}`}>↓</button></div><button className="collection-remove" type="button" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id).map((candidate, itemIndex) => ({ ...candidate, sortOrder: itemIndex + 1 })))}>Quitar</button>
            </article>)}{!items.length && <div className="collection-items-empty">Todavía no agregaste productos ni combos. Una colección en borrador puede quedar vacía.</div>}</div>
          </section>
          {error && <p className="form-error" role="alert">{error}</p>}
        </>}
      </div>
      <footer><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving || loading || !name.trim()} aria-busy={saving} onClick={save}>{saving ? "Guardando…" : collection ? "Guardar cambios" : "Crear colección"}</button></footer>
    </aside>
    {pickerOpen && <CollectionItemPicker products={products} selectedIds={new Set(items.map((item) => item.id))} onCancel={() => setPickerOpen(false)} onAdd={(selected) => { setItems((current) => [...current, ...selected.map((item, index) => ({ ...item, sortOrder: current.length + index + 1 }))]); setPickerOpen(false); }} />}
  </div>;
}

function CollectionItemPicker({ products, selectedIds, onCancel, onAdd }: { products: CollectionCatalogItem[]; selectedIds: Set<number>; onCancel: () => void; onAdd: (items: CollectionCatalogItem[]) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [checked, setChecked] = useState<number[]>([]);
  const available = useMemo(() => products.filter((product) => !selectedIds.has(product.id)).filter((product) => type === "ALL" || product.type === type).filter((product) => `${product.name} ${product.code} ${typeLabel(product.type)}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))), [products, query, selectedIds, type]);
  const chosen = new Set(checked);
  return <div className="collection-picker-layer"><button className="drawer-backdrop" onClick={onCancel} aria-label="Cerrar selector" /><section className="collection-picker" role="dialog" aria-modal="true" aria-labelledby="collection-picker-title"><header><div><p>COLECCIONES</p><h2 id="collection-picker-title">Agregar productos o combos</h2><span>Seleccioná varios elementos existentes y agregalos juntos.</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header><div className="collection-picker-body"><div className="collection-picker-filters"><label><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, código o tipo…" /></label><select aria-label="Filtrar por tipo" value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">Todos</option><option value="MANUFACTURED">Productos</option><option value="SIMPLE">Productos simples</option><option value="COMBO">Combos</option></select></div><div className="collection-picker-list">{available.map((product) => <label key={product.id} className={chosen.has(product.id) ? "selected" : ""}><input type="checkbox" checked={chosen.has(product.id)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} /><span className={`collection-type ${product.type === "COMBO" ? "combo" : "product"}`}>{typeLabel(product.type)}</span><span><strong>{product.name}</strong><small>{product.code}</small></span></label>)}{!available.length && <div className="recipe-empty">No hay elementos disponibles con ese criterio.</div>}</div></div><footer><span>{checked.length} seleccionados</span><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={!checked.length} onClick={() => onAdd(checked.map((id) => products.find((product) => product.id === id)).filter((product): product is CollectionCatalogItem => Boolean(product)))}>Agregar seleccionados</button></footer></section></div>;
}

function CollectionDeleteDialog({ collection, onCancel, onDeleted }: { collection: CollectionRow; onCancel: () => void; onDeleted: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setSaving(true); setError("");
    try {
      await readJson(await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete_collection", id: collection.id }) }));
      window.dispatchEvent(new CustomEvent("khora:data-changed", { detail: { entity: "collections", id: collection.id } }));
      onDeleted(`Colección ${collection.name} eliminada. Los productos y combos se conservaron.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo eliminar la colección."); }
    finally { setSaving(false); }
  }
  return <div className="drawer-layer confirm-layer"><button className="drawer-backdrop" onClick={onCancel} aria-label="Cerrar confirmación" /><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-collection-title"><header><div><p>COLECCIONES · ELIMINAR</p><h2 id="delete-collection-title">¿Eliminar esta colección?</h2><span>{collection.name}</span></div><button onClick={onCancel} aria-label="Cerrar">×</button></header><div><p>Los productos y combos no serán eliminados. Solo dejarán de pertenecer a esta colección.</p><div className="confirm-note"><i>i</i><p>Se eliminarán la colección y sus {collection.item_count} relaciones comerciales, sin modificar stock, precios, recetas, imágenes ni historial.</p></div>{error && <p className="form-error" role="alert">{error}</p>}</div><footer><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="danger-button" disabled={saving} onClick={remove}>{saving ? "Eliminando…" : "Eliminar colección"}</button></footer></section></div>;
}
