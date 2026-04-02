
import { Paper, UserProfile, UserRole } from '../types';

const STORAGE_KEY = 'paperchecker_cloud_mock';

// Artificial delay to simulate network latency
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const MOCK_USERS: UserProfile[] = [
  { id: 'u1', name: 'Auditor', role: UserRole.AUDITOR, avatar: 'AU', department: 'Audit' },
  { id: 'u2', name: 'QC Supervisor', role: UserRole.QC, avatar: 'QC', department: 'Examination Cell' }
];

export const dbService = {
  async getPapers(): Promise<Paper[]> {
    await delay(800);
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  async savePaper(paper: Paper): Promise<void> {
    await delay(600);
    const papers = await this.getPapers();
    const index = papers.findIndex(p => p.id === paper.id);
    if (index > -1) {
      papers[index] = { ...paper, lastSyncedAt: Date.now() };
    } else {
      papers.unshift({ ...paper, lastSyncedAt: Date.now() });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
  },

  async deletePaper(id: string): Promise<void> {
    await delay(400);
    const papers = await this.getPapers();
    const filtered = papers.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  async updatePaperStatus(id: string, status: Paper['status']): Promise<void> {
    const papers = await this.getPapers();
    const index = papers.findIndex(p => p.id === id);
    if (index > -1) {
      papers[index].status = status;
      papers[index].lastSyncedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
    }
  }
};
