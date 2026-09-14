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

const questionStepLabels = ["Sensación", "Lugar", "Familia aromática", "Intensidad"];
const emptyAnswers: AromaAnswers = { sensation: "", room: "", family: "", intensity: "" };
const money = (cents: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100);

function FinderProductImage({ product }: { product: AromaFinderProduct }) {
  const [failed, setFailed] = useState(false);
  if (product.imagePath && /^(https?:|\/)/.test(product.imagePath) && !failed) {
    return <img src={product.imagePath} alt="" onError={() => setFailed(true)} />;
  }
  return <span className={styles.aromaProductPlaceholder} aria-hidden="true">KH</span>;
}

export function AromaFinder({ products, options, saving, onOpenProduct, onAddProduct }: AromaFinderProps) {
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

  return (
    <main className={styles.aromaPage}>

      <section className={`${styles.aromaIntro} ${styles.aromaHero}`} aria-labelledby="aroma-title">
        <p className={styles.eyebrow}>ENCONTRÁ TU AROMA</p>
        <h1 id="aroma-title">Un aroma para<br /><em>tu momento.</em></h1>
        <p>Respondé cuatro preguntas y descubrí las opciones de KHORA que mejor acompañan tu espacio.</p>
      </section>

      {!showResults ? <>
        <section className={styles.aromaQuestionnaire} aria-label="Preguntas para encontrar tu aroma">
          <div className={styles.aromaProgress} aria-label={`Paso ${step + 1} de ${questions.length}`}>
            {questions.map((question, index) => <div className={`${styles.aromaProgressStep} ${index <= step ? styles.aromaProgressActive : ""}`} key={question.key}>
              <span>{index + 1}</span><strong>{questionStepLabels[index]}</strong>
            </div>)}
          </div>
          <div className={styles.aromaQuestionsGrid}>
            {questions.map((question, index) => {
              const questionOptions = optionsByKind.get(question.kind) ?? [];
              return <fieldset className={`${styles.aromaQuestion} ${index === step ? styles.aromaQuestionActive : ""}`} key={question.key}>
                <legend>{question.title}</legend>
                <p>{question.helper}</p>
                {questionOptions.length ? <div className={styles.aromaChoices}>{questionOptions.map((option) => <button className={answers[question.key] === option.slug ? styles.aromaChoiceSelected : ""} type="button" onClick={() => chooseAnswer(question.key, option.slug)} aria-pressed={answers[question.key] === option.slug} key={option.slug}>{option.label}</button>)}</div> : <p className={styles.aromaQuestionEmpty}>Esta selección todavía no está disponible.</p>}
              </fieldset>;
            })}
          </div>
          <div className={styles.aromaMobileControls}>
            <button className={styles.linkButton} type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Atrás</button>
            <button className={styles.linkButton} type="button" disabled={step === questions.length - 1} onClick={() => setStep((value) => Math.min(questions.length - 1, value + 1))}>Siguiente <span>→</span></button>
          </div>
          <button className={`${styles.primary} ${styles.aromaSubmit}`} type="button" onClick={showRecommendations} disabled={!complete}>VER RECOMENDACIONES <span>→</span></button>
        </section>
        <section className={styles.aromaBenefits} aria-label="Beneficios KHORA">
          <article><span className={styles.aromaBenefitIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-6-3.6-6-9a3.4 3.4 0 0 1 6-2.1A3.4 3.4 0 0 1 18 11c0 5.4-6 9-6 9Z" /><path d="M12 8v8" /></svg></span><p>Aromas que transforman tu bienestar</p></article>
          <article><span className={styles.aromaBenefitIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M19 4C10 4 5 8.7 5 16c5.8 0 10-3.6 12-9" /><path d="M5 20c3.6-4.3 7-7 11-9" /></svg></span><p>Inspirados en la naturaleza</p></article>
          <article><span className={styles.aromaBenefitIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12 12 5l8 7v7H4v-7Z" /><path d="M9 19v-4h6v4" /></svg></span><p>Hogares más conscientes</p></article>
        </section>
      </> : <section className={styles.aromaResults} aria-labelledby="aroma-results-title">
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
    </main>
  );
}
