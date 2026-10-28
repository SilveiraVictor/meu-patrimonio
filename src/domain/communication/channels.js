import { digits } from '../shared/text.js';

export const subjects = { collection: 'Lembrete de pagamento', receipt: 'Recibo de pagamento', status: 'Situação do empréstimo' };
export const whatsappUrl = (phone, text) => { const d = digits(phone); return `https://wa.me/${d ? (d.length <= 11 ? `55${d}` : d) : ''}?text=${encodeURIComponent(text)}`; };
export const mailtoUrl = (email, kind, text) => `mailto:${email ?? ''}?subject=${encodeURIComponent(subjects[kind])}&body=${encodeURIComponent(text.replace(/\*/g, '').replace(/\n/g, '\r\n'))}`;
