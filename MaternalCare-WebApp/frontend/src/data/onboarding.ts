import {
  Activity,
  Baby,
  ClipboardList,
  Droplet,
  HeartPulse,
  Pill,
  Ruler,
  Smile,
  Stethoscope,
  Syringe,
  User,
  type LucideIcon,
} from 'lucide-react';

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'chips';

export interface Field {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  unit?: string;
  optional?: boolean;
  placeholder?: string;
}

export interface Step {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  fields: Field[];
  custom?: 'body-metrics';
}

export type Stage = 'pregnant' | 'new-mother' | 'parent' | 'planning' | 'general';

export const STAGE_LABEL: Record<Stage, string> = {
  pregnant: 'Pregnancy',
  'new-mother': 'New mother',
  parent: 'Parenting',
  planning: 'Planning',
  general: 'Your profile',
};

export function normalizeStage(s: string | null): Stage {
  const v = (s || '').toLowerCase();
  if (v.includes('planning')) return 'planning';
  if (v.includes('pregnant')) return 'pregnant';
  if (v.includes('new mother') || v === 'new-mother') return 'new-mother';
  if (v.includes('parent')) return 'parent';
  if (['pregnant', 'new-mother', 'parent', 'planning'].includes(v)) return v as Stage;
  return 'general';
}

/*
 * The shared intake — asked of every mother, but not identically.
 *
 * Height and weight mean different things at different stages: before a
 * pregnancy they set the weight-gain band the dashboard compares her to;
 * after one they are her own recovery; while planning they are the BMI a
 * clinician will ask about first. For the parent of a toddler nothing in
 * the application reads them, so she is not asked.
 */
const basics: Step = {
  icon: User,
  title: 'A few basics about you',
  subtitle: 'This helps us personalise your care from day one.',
  fields: [
    { id: 'dob', label: 'Date of birth', type: 'date' },
    { id: 'blood', label: 'Blood group', type: 'select', options: ['A+', 'A−', 'B+', 'B−', 'O+', 'O−', 'AB+', 'AB−', 'Not sure'] },
  ],
};

const bodyMetrics = (title: string, subtitle: string, weightLabel: string): Step => ({
  icon: Ruler,
  title,
  subtitle,
  custom: 'body-metrics',
  fields: [
    { id: 'height', label: 'Height', type: 'number', unit: 'cm' },
    { id: 'weight', label: weightLabel, type: 'number', unit: 'kg' },
  ],
});

const history: Step = {
  icon: ClipboardList,
  title: 'Medical history',
  subtitle: 'Select anything that applies — you can always update this later.',
  fields: [
    { id: 'conditions', label: 'Ongoing conditions', type: 'chips', options: ['Diabetes', 'Hypertension', 'Thyroid', 'Asthma', 'Anemia', 'PCOS', 'None'] },
    { id: 'allergies', label: 'Allergies', type: 'text', optional: true, placeholder: 'e.g. penicillin' },
  ],
};

const commonFor = (stage: Stage): Step[] => {
  switch (stage) {
    case 'pregnant':
      return [basics, bodyMetrics('Your body before pregnancy', 'Sets the healthy weight-gain range your dashboard compares you to.', 'Weight before pregnancy (or now, if unsure)'), history];
    case 'new-mother':
      return [basics, bodyMetrics('Your body now', 'Your recovery is tracked too, not only the baby’s growth.', 'Weight now'), history];
    case 'planning':
      return [basics, bodyMetrics('Your body metrics', 'BMI before conceiving is the first thing a clinician will ask about.', 'Weight now'), history];
    case 'parent':
      return [basics, history];
    default:
      return [basics, history];
  }
};

/* --- stage-specific questions --- */
const byStage: Record<Stage, Step[]> = {
  pregnant: [
    {
      icon: Baby,
      title: 'Your pregnancy',
      subtitle: 'So we can calculate your current week and due date.',
      fields: [
        { id: 'lmp', label: 'First day of your last period', type: 'date' },
        { id: 'first', label: 'Is this your first pregnancy?', type: 'select', options: ['Yes', 'No'] },
      ],
    },
    {
      icon: ClipboardList,
      title: 'Pregnancy history',
      subtitle: 'Helps us watch early for anything that needs extra care.',
      fields: [
        { id: 'prev', label: 'Previous pregnancies', type: 'number', optional: true },
        { id: 'complications', label: 'Any past complications?', type: 'chips', options: ['Miscarriage', 'Preterm birth', 'Gestational diabetes', 'Pre-eclampsia', 'C-section', 'None'] },
      ],
    },
    {
      icon: Stethoscope,
      title: 'Your current care',
      fields: [
        { id: 'care', label: 'Are you already under a doctor’s care?', type: 'select', options: ['Yes', 'Not yet'] },
        { id: 'multiples', label: 'Are you expecting multiples?', type: 'select', options: ['No', 'Twins', 'Triplets or more'] },
      ],
    },
    {
      icon: Activity,
      title: 'How are you feeling?',
      subtitle: 'We’ll track symptoms and flag anything unusual.',
      fields: [
        {
          id: 'symptoms',
          label: 'Any symptoms lately?',
          type: 'chips',
          options: ['Nausea', 'Vomiting', 'Fatigue', 'Back pain', 'Swelling', 'Headaches', 'Heartburn', 'Constipation', 'Dizziness', 'None'],
        },
      ],
    },
  ],
  'new-mother': [
    {
      icon: Baby,
      title: 'About your baby',
      fields: [
        { id: 'baby_name', label: 'Baby’s name', type: 'text', placeholder: 'What you call them' },
        { id: 'baby_dob', label: 'Baby’s date of birth', type: 'date' },
        /*
         * Sex is clinical here, not a formality: every centile on the growth
         * screen is read from the WHO curve for that sex, and the comparator
         * declines to state one when it does not know. It was never asked.
         */
        { id: 'baby_sex', label: 'Baby’s sex', type: 'select', options: ['Girl', 'Boy', 'Prefer not to say'] },
        { id: 'delivery', label: 'Delivery type', type: 'select', options: ['Vaginal', 'C-section'] },
      ],
    },
    {
      icon: Droplet,
      title: 'Feeding',
      fields: [
        { id: 'feeding', label: 'Feeding method', type: 'select', options: ['Breastfeeding', 'Formula', 'Mixed'] },
        { id: 'birth_weight', label: 'Baby’s birth weight', type: 'number', unit: 'kg', optional: true },
        /*
         * A weight today, as well as the birth weight. Two points make a
         * direction; one makes a dot. The dashboard offers "Update baby" and
         * the growth screen states a centile, and neither had anywhere to get
         * a current measurement from.
         */
        { id: 'child_weight_now', label: 'Weight today', type: 'number', unit: 'kg', optional: true },
        { id: 'child_height_now', label: 'Length today', type: 'number', unit: 'cm', optional: true },
      ],
    },
    {
      icon: Syringe,
      title: 'Baby’s health',
      fields: [{ id: 'baby_vax', label: 'Vaccinations up to date?', type: 'select', options: ['Yes', 'No', 'Not sure'] }],
    },
    {
      icon: Smile,
      title: 'Your wellbeing',
      subtitle: 'Your health matters just as much as your baby’s.',
      fields: [{ id: 'mood', label: 'In the past 2 weeks, have you often felt down or anxious?', type: 'select', options: ['Rarely', 'Sometimes', 'Often'] }],
    },
  ],
  parent: [
    {
      icon: Baby,
      title: 'About your child',
      fields: [
        { id: 'child_name', label: 'Child’s name', type: 'text', placeholder: 'What you call them' },
        { id: 'child_dob', label: 'Child’s date of birth', type: 'date' },
        { id: 'child_sex', label: 'Child’s sex', type: 'select', options: ['Girl', 'Boy', 'Prefer not to say'] },
        { id: 'num_children', label: 'Number of children', type: 'number' },
      ],
    },
    {
      icon: Activity,
      title: 'Growth & development',
      fields: [
        /*
         * This step asked two opinions about growth and recorded no growth.
         * The parent hero's button says "Add a measurement" and brings her
         * here, so here is where a measurement has to be possible.
         */
        { id: 'child_weight_now', label: 'Weight today', type: 'number', unit: 'kg', optional: true },
        { id: 'child_height_now', label: 'Height today', type: 'number', unit: 'cm', optional: true },
        { id: 'growth', label: 'Any concerns about growth?', type: 'select', options: ['No', 'Some', 'Not sure'] },
        { id: 'milestones', label: 'Are milestones on track?', type: 'select', options: ['Yes', 'No', 'Not sure'] },
      ],
    },
    {
      icon: Syringe,
      title: 'Vaccinations',
      fields: [{ id: 'child_vax', label: 'Immunizations up to date?', type: 'select', options: ['Yes', 'No', 'Not sure'] }],
    },
  ],
  planning: [
    {
      icon: HeartPulse,
      title: 'Your journey',
      fields: [
        { id: 'trying', label: 'How long have you been trying?', type: 'select', options: ['Just starting', 'Under 6 months', '6–12 months', 'Over a year'] },
        { id: 'cycle', label: 'How are your cycles?', type: 'select', options: ['Regular', 'Irregular', 'Not sure'] },
      ],
    },
    {
      icon: Pill,
      title: 'Preconception health',
      fields: [
        { id: 'folic', label: 'Are you taking folic acid?', type: 'select', options: ['Yes', 'No', 'Not yet'] },
        { id: 'prev_preg', label: 'Any previous pregnancies?', type: 'select', options: ['Yes', 'No'] },
      ],
    },
  ],
  general: [],
};

export function stepsFor(stage: Stage): Step[] {
  return [...commonFor(stage), ...byStage[stage]];
}

/**
 * The answers with a column of their own are mapped by name when saving;
 * everything else — the stage-specific questions that describe her
 * situation — travels as `intake`, keyed by these ids, and comes back the
 * same way to pre-fill the form.
 */
const MAPPED = new Set([
  'dob', 'blood', 'height', 'weight', 'height_cm', 'height_ft', 'height_in', 'weight_kg', 'weight_lb',
  'conditions', 'allergies', 'lmp', 'symptoms',
  'baby_name', 'baby_dob', 'baby_sex', 'delivery', 'feeding', 'birth_weight',
  'child_name', 'child_dob', 'child_sex', 'child_weight_now', 'child_height_now',
]);
export const isIntakeField = (id: string) => !MAPPED.has(id);

/** The step a field is on, so a dashboard button can open the form there. */
export function stepIndexFor(steps: Step[], fieldId: string | null): number {
  if (!fieldId) return 0;
  const i = steps.findIndex((s) => s.fields.some((f) => f.id === fieldId));
  return i < 0 ? 0 : i;
}

/** Which question each dashboard button is really about. */
export const FOCUS_FOR_STAGE: Record<Stage, string> = {
  pregnant: 'lmp',
  'new-mother': 'child_weight_now',
  parent: 'child_weight_now',
  planning: 'trying',
  general: 'dob',
};
