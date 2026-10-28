import { collectionModel, receiptModel, statusModel, personCollectionModel, personStatusModel } from '../domain/communication/models.js';
import { messageRenderers, documentRenderers, emptyMessage } from '../domain/communication/render.js';
import { whatsappUrl, mailtoUrl } from '../domain/communication/channels.js';
import { defaultFormat } from '../domain/shared/format.js';

/** Monta cobrança, recibo e situação (mensagem ou documento) de um empréstimo ou de uma pessoa. */
export class MessageService {
  /** @param {{loans, people, creditor:{get():Promise<{name?:string,pix?:string}>}, clock, fmt?}} deps */
  constructor({ loans, people, creditor, clock, fmt = defaultFormat }) { Object.assign(this, { loans, people, creditor, clock, fmt }); }

  /** scope: 'loan' | 'person'; kind: 'collection' | 'receipt' | 'status'; format: 'message' | 'document'. */
  async compose({ scope, id, kind, format = 'message', receiptIndex = 0 }) {
    if (scope === 'person' && (format === 'document' || kind === 'receipt')) throw new Error('Documento e recibo existem só por empréstimo');
    const today = this.clock.today(), all = await this.loans.list();
    const loan = scope === 'loan' ? await this.loans.get(id) : null;
    const debtor = await this.people.get(scope === 'loan' ? loan.personId : id);
    const ctx = { fmt: this.fmt, today, creditor: await this.creditor.get(), debtor, loan };
    const mine = scope === 'loan' ? [loan] : all.filter((l) => l.personId === id);
    const model = { collection: () => scope === 'loan' ? collectionModel(loan, today) : personCollectionModel(mine, today),
      receipt: () => receiptModel(loan, receiptIndex), status: () => scope === 'loan' ? statusModel(loan, today) : personStatusModel(mine, today) }[kind]();
    const contact = { name: debtor.name, phone: debtor.phone, email: debtor.email };
    if (!model) return { empty: emptyMessage[kind], contact };
    if (format === 'document') return { document: documentRenderers[kind](model, ctx), contact };
    const text = messageRenderers[kind](model, ctx);
    return { text, contact, links: { whatsapp: whatsappUrl(debtor.phone, text), email: mailtoUrl(debtor.email, kind, text) } };
  }
}
