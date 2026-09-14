"use client";

import { useMemo, useState } from "react";
import { calculateAromaMatch, hasPublicSensoryContent, type AromaAnswers, type PublicSensoryOption, type PublicSensoryProfile } from "./khora-aroma-match";
import { SensorySummary } from "./khora-sensory-display";
import styles from "./tienda/store.module.css";

export type AromaFinderProduct = {
  id: number;
  name: string;
  priceCents: number;
  availableStock: number;
  imagePath: string | null;
  sensoryProfile: PublicSensoryProfile;
};

type AromaFinderProps = {
  products: AromaFinderProduct[];
  options: PublicSensoryOption[];
  saving: boolean;
  onOpenProduct: (id: number) => void;
  onAddProduct: (id: number) => Promise<boolean>;
  onBack: () => void;
};

type Question = {
  key: keyof AromaAnswers;
  kind: PublicSensoryOption["kind"];
  title: string;
  helper: string;
};

const questions: Question[] = [
  { key: "sensation", kind: "SENSATION", title: "¿Qué sensación buscás?", helper: "Elegí la forma en la que querés sentir tu espacio." },
  { key: "room", kind: "ROOM", title: "¿Dónde lo vas a usar?", helper: "Pensá en el ambiente que querés acompañar." },
  { key: "family", kind: "FAMILY", title: "¿Qué familia aromática preferís?", helper: "Podés elegir el carácter que más te atrae." },
  { key: "intensity", kind: "INTENSITY", title: "¿Qué intensidad te gusta?", helper: "Busquemos una presencia que se sienta natural para vos." },
];

const emptyAnswers: AromaAnswers = { sensation: "", room: "", family: "", intensity: "" };
const money = (cents: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100);

function FinderProductImage({ product }: { product: AromaFinderProduct }) {
  const [failed, setFailed] = useState(false);
  if (product.imagePath && /^(https?:|\/)/.test(product.imagePath) && !failed) {
    return <img src={product.imagePath} alt="" onError={() => setFailed(true)} />;
  }
  return <span className={styles.aromaProductPlaceholder} aria-hidden="true">KH</span>;
}

export function AromaFinder({ products, options, saving, onOpenProduct, onAddProduct, onBack }: AromaFinderProps) {
  const [answers, setAnswers] = useState<AromaAnswers>(emptyAnswers);
  const [step, setStep] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const optionsByKind = useMemo(() => new Map(questions.map((question) => [question.kind, options.filter((option) => option.kind === question.kind)])), [options]);
  const complete = questions.every((question) => Boolean(answers[question.key]));
  const matches = useMemo(() => products
    .filter((product) => product.availableStock > 0 && hasPublicSensoryContent(product.sensoryProfile))
    .map((product) => ({ product, match: calculateAromaMatch(product.sensoryProfile, answers) }))
    .filter(({ match }) => match.score > 0)
    .sort((left, right) => right.match.score - left.match.score || left.product.name.localeCompare(right.product.name, "es")), [answers, products]);
  const visibleMatches = showAll ? matches : matches.slice(0, 3);

  function chooseAnswer(key: keyof AromaAnswers, slug: string) {
    setAnswers((current) => ({ ...current, [key]: slug }));
    setShowResults(false);
    setShowAll(false);
  }

  function showRecommendations() {
    if (!complete) return;
    setShowResults(true);
    setShowAll(false);
  }

  function changeAnswers() {
    setShowResults(false);
    setShowAll(false);
    setStep(0);
  }

  return <main className={styles.aromaPage}>
    <button className={styles.backLink} type="button" onClick={onBack}><span className={styles.backLinkArrow} aria-hidden="true">←</span><span>Volver a la tienda</span></button>
    <section className={styles.aromaIntro} aria-labelledby="aroma-title">
      <p className={styles.eyebrow}>ENCONTRÁ TU AROMA</p>
      <h1 id="aroma-title">Un aroma para<br /><em>tu momento.</em></h1>
      <p>Respondé cuatro preguntas y descubrí las opciones de KHORA que mejor acompañan tu espacio.</p>
    </section>

    {!showResults ? <section className={styles.aromaQuestionnaire} aria-label="Preguntas para encontrar tu aroma">
      <div className={styles.aromaProgress} aria-hidden="true">{questions.map((question, index) => <span className={index <= step ? styles.aromaProgressActive : ""} key={question.key} />)}</div>
      {questions.map((question, index) => {
        const questionOptions = optionsByKind.get(question.kind) ?? [];
        return <fieldset className={`${styles.aromaQuestion} ${index === step ? styles.aromaQuestionActive : ""}`} key={question.key}>
          <legend>{question.title}</legend>
          <p>{question.helper}</p>
          {questionOptions.length ? <div className={styles.aromaChoices}>{questionOptions.map((option) => <button className={answers[question.key] === option.slug ? styles.aromaChoiceSelected : ""} type="button" onClick={() => chooseAnswer(question.key, option.slug)} aria-pressed={answers[question.key] === option.slug} key={option.slug}>{option.label}</button>)}</div> : <p className={styles.aromaQuestionEmpty}>Esta selección todavía no está disponible.</p>}
        </fieldset>;
      })}
      <div className={styles.aromaMobileControls}>
        <button className={styles.linkButton} type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Atrás</button>
        <button className={styles.linkButton} type="button" disabled={step === questions.length - 1} onClick={() => setStep((value) => Math.min(questions.length - 1, value + 1))}>Siguiente <span>→</span></button>
      </div>
      <button className={`${styles.primary} ${styles.aromaSubmit}`} type="button" onClick={showRecommendations} disabled={!complete}>VER RECOMENDACIONES <span>→</span></button>
    </section> : <section className={styles.aromaResults} aria-labelledby="aroma-results-title">
      <div className={styles.aromaResultsHeading}>
        <div><p className={styles.eyebrow}>TU SELECCIÓN KHORA</p><h2 id="aroma-results-title">Aromas para tu momento</h2></div>
        <button className={styles.linkButton} type="button" onClick={changeAnswers}>Cambiar respuestas <span>↗</span></button>
      </div>
      {matches.length ? <div className={styles.aromaResultGrid}>{visibleMatches.map(({ product, match }) => <article className={styles.aromaResultCard} key={product.id}>
        <button className={styles.aromaProductVisual} type="button" onClick={() => onOpenProduct(product.id)} aria-label={`Ver ${product.name}`}><FinderProductImage product={product} /></button>
        <div className={styles.aromaResultBody}><p className={styles.aromaMatchLabel}>{match.label}</p><h3>{product.name}</h3><SensorySummary profile={product.sensoryProfile} /><div className={styles.aromaResultMeta}><strong>{money(product.priceCents)}</strong><span>Disponible</span></div><div className={styles.aromaResultActions}><button className={styles.linkButton} type="button" onClick={() => onOpenProduct(product.id)}>Ver producto <span>→</span></button><button className={styles.primary} type="button" onClick={() => onAddProduct(product.id)} disabled={saving}>Agregar a la bolsa <span>→</span></button></div></div>
      </article>)}</div> : <div className={styles.aromaNoMatch}><h3>Probemos otro camino</h3><p>No encontramos una combinación exacta entre los aromas disponibles hoy.</p><button className={styles.primary} type="button" onClick={changeAnswers}>Cambiar respuestas <span>→</span></button></div>}
      {matches.length > 3 && !showAll && <button className={styles.linkButton} type="button" onClick={() => setShowAll(true)}>Ver todos los resultados <span>↓</span></button>}
    </section>}
  </main>;
}
