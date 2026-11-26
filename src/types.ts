export interface Student {
  id: string;
  name: string;
  seatNo?: string;
  present: boolean;
}

export interface DrawRecord {
  id: string;
  studentId: string;
  studentName: string;
  drawnAt: string;
  roundOrder: number;
}

export interface StudentGroup {
  id: string;
  index: number;
  name: string;
  members: Student[];
}

export type AppTab = 'picker' | 'groups' | 'roster';

export type RemainderStrategy = 'distribute' | 'keep_last';
