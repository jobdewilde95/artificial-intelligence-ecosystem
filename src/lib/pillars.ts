import type { PillarId } from '@/types';

export interface Pillar {
  id: PillarId;
  path: string;
  name: string;
  /** Which categorical slot this pillar owns. Colour follows the entity, so a
   *  pillar keeps its hue everywhere it appears. Slots are assigned in the
   *  validated fixed order and never cycled. */
  slot: number;
  tagline: string;
  question: string;
}

export const PILLARS: Pillar[] = [
  { id: 'capability', path: '/capability', name: 'Capability & Models', slot: 0,
    tagline: 'What the frontier can do, and what it cost to get there',
    question: 'How fast is model capability advancing, and who is producing it?' },
  { id: 'compute', path: '/compute', name: 'Compute & Infrastructure', slot: 1,
    tagline: 'The physical substrate: clusters, chips, and power',
    question: 'Where is the world’s AI compute, and who controls it?' },
  { id: 'capital', path: '/capital', name: 'Capital & Industry', slot: 2,
    tagline: 'Money in, prices down, market structure shifting',
    question: 'What is being invested, and what does intelligence cost to buy?' },
  { id: 'opensource', path: '/open-source', name: 'Open Source & Developers', slot: 3,
    tagline: 'The tools and weights anyone can pick up',
    question: 'How much of the stack is open, and what are builders using?' },
  { id: 'research', path: '/research', name: 'Research', slot: 4,
    tagline: 'The publication record underneath the products',
    question: 'How much AI research is being produced, and at what rate?' },
  { id: 'policy', path: '/policy', name: 'Policy & Governance', slot: 5,
    tagline: 'Rules arriving, unevenly, across jurisdictions',
    question: 'How is AI actually being regulated, and where?' },
  { id: 'safety', path: '/safety', name: 'Safety & Risk', slot: 6,
    tagline: 'Incidents, evaluations, and the frameworks meant to catch them',
    question: 'What has gone wrong, and what is being done about it?' },
  { id: 'adoption', path: '/adoption', name: 'Adoption & Impact', slot: 7,
    tagline: 'Where AI has actually landed in the economy',
    question: 'Who is using this, and what changed as a result?' },
];

export const pillarById = (id: PillarId): Pillar =>
  PILLARS.find((p) => p.id === id) ?? PILLARS[0];
