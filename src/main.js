// Raiz de composição: único lugar que conhece as implementações concretas.
import { startOfDay } from './domain/shared/dates.js';
import { LoanService } from './application/loanService.js';
import { InvestmentService } from './application/investmentService.js';
import { MessageService } from './application/messageService.js';
import { BackupService } from './application/backupService.js';
import { PreferencesService } from './application/preferences.js';
import { personService, institutionService } from './application/registryService.js';
import { HomeService } from './application/homeService.js';
import { presentationFormat } from './presentation/format.js';
import { demoData } from './application/demoData.js';
import { KEYS, DEFAULT_SETTINGS, DocumentStore, createRepositories, settingsPorts } from './infrastructure/storage.js';
import { initStorage } from './infrastructure/bootstrap.js';
import { backupCodec } from './infrastructure/backupCodec.js';

export async function createApp({ storage = globalThis.localStorage, clock = { today: () => startOfDay() }, newId } = {}) {
  const boot = await initStorage({ storage, seed: () => demoData(clock.today()) });
  const repos = createRepositories(storage), settings = settingsPorts(new DocumentStore(storage, KEYS.settings, DEFAULT_SETTINGS));
  const count = async (repo, test) => (await repo.list()).filter(test).length;
  return {
    boot, clock, settings,
    loans: new LoanService({ loans: repos.loans, people: repos.people, clock, newId }),
    investments: new InvestmentService({ investments: repos.investments, loans: repos.loans, institutions: repos.institutions, indicators: settings.indicators, clock, newId }),
    people: personService({ repo: repos.people, usageCount: (id) => count(repos.loans, (l) => l.personId === id), newId }),
    institutions: institutionService({ repo: repos.institutions, usageCount: (id) => count(repos.investments, (i) => i.custodianId === id || i.issuerId === id), newId }),
    messages: new MessageService({ loans: repos.loans, people: repos.people, creditor: settings.creditor, clock, fmt: presentationFormat }),
    home: new HomeService({ investments: repos.investments, loans: repos.loans, people: repos.people, clock }),
    backup: new BackupService({ ...repos, settings, codec: backupCodec, clock }),
    preferences: new PreferencesService(storage, KEYS.preferences),
  };
}
