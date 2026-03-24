
import type { Regatta, Participant, RegattaParticipant } from './types';

// This is the central database of all possible individual participants
export const sampleAllParticipants: Participant[] = [
  { id: 'p1', name: 'Alexandre Dubois', club: 'CN La Rochelle', licenseNumber: 'FRA12345', category: 'Confirmé', sailType: 'Windsurf' },
  { id: 'p2', name: 'Béatrice Martin', club: 'YC Cannes', licenseNumber: 'FRA12346', category: 'Confirmé', sailType: 'Windsurf' },
  { id: 'p3', name: 'Clément Bernard', club: 'SR Brest', licenseNumber: 'FRA12347', category: 'Catamaran', sailType: 'Catamaran' },
  { id: 'p4', name: 'Diane Petit', club: 'SR Brest', licenseNumber: 'FRA12348', category: 'Catamaran', sailType: 'Catamaran' },
  { id: 'p5', name: 'Étienne Moreau', club: 'CN Lorient', licenseNumber: 'FRA12349', category: 'Jeune', sailType: 'Wingfoil' },
  { id: 'p6', name: 'Florence Garcia', club: 'CV Martigues', licenseNumber: 'FRA12350', category: 'Confirmé', sailType: 'Windsurf' },
  { id: 'p7', name: 'Guillaume Richard', club: 'SNO Nantes', licenseNumber: 'FRA12351', category: 'Dériveur', sailType: 'Dinghy' },
  { id: 'p8', name: 'Hélène Fournier', club: 'SNO Nantes', licenseNumber: 'FRA12352', category: 'Dériveur', sailType: 'Dinghy' },
  { id: 'p9', name: 'Isabelle Roussel', club: 'CNBPP', licenseNumber: 'FRA12353', category: 'Vétéran', sailType: 'Windsurf' },
  { id: 'p10', name: 'Jean-Luc Girard', club: 'YC Toulon', licenseNumber: 'FRA12354', category: 'Vétéran', sailType: 'Windsurf' },
  { id: 'p11', name: 'Karine Lefebvre', club: 'CV Bordeaux', licenseNumber: 'FRA12355', category: 'Confirmé', sailType: 'Wingfoil' },
  { id: 'p12', name: 'Lucas Andre', club: 'ASPTT Marseille', licenseNumber: 'FRA12256', category: 'Jeune', sailType: 'Windsurf' },
];


// These are the entries for a specific sample regatta
export const sampleRegattaParticipants: (Omit<RegattaParticipant, "id"> & { id: string})[] = [
    { id: 'rp1', bibNumber: '1', entryName: 'Alexandre Dubois', crewIds: ['p1'] },
    { id: 'rp2', bibNumber: '2', entryName: 'Béatrice Martin', crewIds: ['p2'] },
    { id: 'rp3', bibNumber: '3', entryName: 'Team Brest', crewIds: ['p3', 'p4'] },
    { id: 'rp5', bibNumber: '5', entryName: 'Étienne Moreau', crewIds: ['p5'] },
    { id: 'rp7', bibNumber: '7', entryName: 'SNO Team', crewIds: ['p7', 'p8'] },
    { id: 'rp9', bibNumber: '9', entryName: 'Isabelle Roussel', crewIds: ['p9'] },
    { id: 'rp11', bibNumber: '11', entryName: 'Karine Lefebvre', crewIds: ['p11'] },
];


export const sampleRegattas: (Omit<Regatta, 'id' | 'heats'> & { participants: RegattaParticipant[], heats: any[] })[] = [
  {
    name: 'Régate de Démonstration',
    date: new Date().toISOString().split('T')[0],
    type: "mixed",
    participants: sampleRegattaParticipants,
    heats: []
  },
];
