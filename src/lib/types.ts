
export type Participant = {
  id: string;
  name: string;
  club: string;
  licenseNumber: string;
  category: 'Jeune' | 'Confirmé' | 'Vétéran' | 'Catamaran' | 'Dériveur';
  sailType: 'Windsurf' | 'Wingfoil' | 'Catamaran' | 'Dinghy';
};

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
  heats: Heat[];
};

export type Score = {
    heatId: string;
    points: number;
    rank: number | string;
    isDiscarded: boolean;
};
