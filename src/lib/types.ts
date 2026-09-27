
export type Participant = {
  id: string;
  firstName?: string;
  lastName?: string;
  /** Legacy full name, kept only for records created before the name split. */
  name?: string;
  club: string;
  licenseNumber: string;
  category: 'Jeune' | 'Confirmé' | 'Vétéran' | 'Catamaran' | 'Dériveur';
  sailType: 'Windsurf' | 'Wingfoil' | 'Catamaran' | 'Dinghy';
  profileType?: 'annualMember' | 'vacationRegular' | 'visitor' | 'unclassified';
};

export function participantDisplayName(participant: Pick<Participant, 'firstName' | 'lastName' | 'name'>): string {
  const structuredName = [participant.firstName, participant.lastName].filter(Boolean).join(' ').trim();
  return structuredName || participant.name?.trim() || 'Nom inconnu';
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() ?? '', lastName: parts.join(' ') };
}

export function participantSearchText(participant: Pick<Participant, 'firstName' | 'lastName' | 'name'>): string {
  return [
    participantDisplayName(participant),
    participant.firstName,
    participant.lastName,
    `${participant.lastName ?? ''} ${participant.firstName ?? ''}`,
    participant.name,
  ].filter(Boolean).join(' ');
}

// Represents an entry in a regatta (a boat, a windsurfer, etc.)
export type RegattaParticipant = {
    id: string; // Unique ID for this entry in the regatta
    bibNumber: string;
    entryName: string; // Name of the entry (e.g., Skipper's name, or a team name)
    crewIds: string[]; // Array of participant IDs for the crew members
};

export type Passage = {
  finish: string | null;
};

export type CompetitorRaceResult = {
  regattaParticipantId: string;
  passage: Passage;
  /** Explicit arrival sequence entered later from the committee's paper sheet. */
  arrivalOrder?: number | null;
  rank: number | null;
  points: number | null;
  status: 'Finished' | 'DNF' | 'DNS' | 'PEN';
};

export type Heat = {
  id: string;
  name: string;
  results: CompetitorRaceResult[];
  status: 'Not Started' | 'In Progress' | 'Finished';
  startTime: number | null;
};

export type Regatta = {
  id:string;
  name: string;
  date: string;
  type: 'individual' | 'team' | 'mixed';
  scoringRules?: ScoringRules;
  heats: Heat[];
};

/** Score awarded to a result status. `fleetPlus` preserves the club's current rule. */
export type PenaltyScoreRule =
  | { mode: 'fleetPlus'; offset: number }
  | { mode: 'fixed'; points: number };

export type ScoringRules = {
  pen: PenaltyScoreRule;
  dns: PenaltyScoreRule;
  dnf: PenaltyScoreRule;
  discards: number;
};

export type LandYachtSession = {
  id: string;
  title: string;
  date: string;
  location: string;
  challenge: string;
  status: 'planned' | 'active' | 'finished';
  createdAt: number;
};

export type SessionRider = {
  id: string;
  name: string;
  yachtNumber: string;
  checkedIn: boolean;
  points: number;
  createdAt?: number;
};

export type Score = {
    heatId: string;
    points: number;
    rank: number | string;
    isDiscarded: boolean;
};
