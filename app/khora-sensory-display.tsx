import { hasPublicSensoryContent, type PublicSensoryOption, type PublicSensoryProfile } from "./khora-aroma-match";
import styles from "./tienda/store.module.css";

type SensoryProfileDisplayProps = {
  profile: PublicSensoryProfile;
  description: string;
};

type SensoryGroupProps = {
  label: string;
  options: PublicSensoryOption[];
};

const intensityLevelBySlug: Record<string, number> = {
  suave: 2,
  baja: 2,
  media: 3,
  intensa: 5,
  alta: 5,
};

function SensoryGroup({ label, options }: SensoryGroupProps) {
  if (!options.length) return null;
  return <div className={styles.sensoryGroup}>
    <dt>{label}</dt>
    <dd>{options.map((option) => <span className={styles.sensoryChip} key={`${option.kind}-${option.slug}`}>{option.label}</span>)}</dd>
  </div>;
}

function Intensity({ option }: { option: PublicSensoryOption | null }) {
  if (!option) return null;
  const level = intensityLevelBySlug[option.slug] ?? 3;
  return <div className={styles.sensoryGroup}>
    <dt>Intensidad</dt>
    <dd className={styles.intensityWrap}>
      <span className={styles.intensityDots} aria-label={`Intensidad ${option.label}: ${level} de 5`}>
        {Array.from({ length: 5 }, (_, index) => <i aria-hidden="true" className={index < level ? styles.intensityDotActive : ""} key={index} />)}
      </span>
      <span className={styles.intensityLabel}>{option.label}</span>
    </dd>
  </div>;
}

export function SensoryProfileDisplay({ profile, description }: SensoryProfileDisplayProps) {
  if (!hasPublicSensoryContent(profile)) return null;
  const publicDescription = description.trim();

  return <section className={styles.sensoryProfile} aria-labelledby="sensory-profile-title">
    <p className={styles.sensoryEyebrow}>PERFIL SENSORIAL</p>
    <h2 id="sensory-profile-title">Cómo se percibe</h2>
    <dl className={styles.sensoryGroups}>
      <SensoryGroup label="Familia aromática" options={profile.families} />
      <SensoryGroup label="Notas principales" options={profile.notes} />
      <SensoryGroup label="Sensaciones" options={profile.sensations} />
      <Intensity option={profile.intensity} />
      <SensoryGroup label="Ideal para" options={profile.rooms} />
      {profile.moment && <SensoryGroup label="Momento recomendado" options={[profile.moment]} />}
    </dl>
    {publicDescription && <p className={styles.sensoryDescription}>{publicDescription}</p>}
  </section>;
}

export function SensorySummary({ profile }: { profile: PublicSensoryProfile }) {
  const labels = [
    ...profile.families.map((option) => option.label),
    ...profile.sensations.map((option) => option.label),
    profile.intensity?.label,
  ].filter((label): label is string => Boolean(label));
  if (!labels.length) return null;
  return <p className={styles.sensorySummary}>{labels.slice(0, 3).join(" · ")}</p>;
}
