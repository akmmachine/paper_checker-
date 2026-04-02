
export enum UserRole {
  AUDITOR = 'AUDITOR',
  QC = 'QC'
}

export enum QuestionStatus {
  APPROVED = 'APPROVED',
  NEEDS_CORRECTION = 'NEEDS_CORRECTION',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING'
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  department: string;
}

export interface AuditLog {
  id: string;
  type: 'CONCEPTUAL' | 'NUMERICAL' | 'LOGICAL' | 'GRAMMATICAL';
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  questionId?: string;
  paperId?: string;
}

export interface QuestionData {
  id: string;
  topic: string;
  original: {
    question: string;
    options?: string[];
    /** Single-correct MCQ (0=A). For MSQ use correctOptionIndices instead or in addition. */
    correctOptionIndex?: number;
    /** Multiple-correct (JEE/NEET MSQ): 0-based indices, e.g. [0,1,2,3] = A–D. */
    correctOptionIndices?: number[];
    correctAnswer?: string;
    solution: string;
  };
  audit?: {
    status: QuestionStatus;
    logs: AuditLog[];
    redlines: {
      question: string;
      options?: string[];
      correctAnswer?: string;
      solution: string;
    };
    clean: {
      question: string;
      options?: string[];
      correctOptionIndex?: number;
      correctOptionIndices?: number[];
      correctAnswer?: string;
      solution: string;
    };
  };
  version: number;
  lastModified: number;
}

export interface Paper {
  id: string;
  title: string;
  subject: string;
  createdBy: string; // User ID
  creatorName: string;
  status: 'DRAFT' | 'PENDING_QC' | 'APPROVED' | 'REJECTED';
  questions: QuestionData[];
  createdAt: number;
  lastSyncedAt?: number;
}
