import { registerKind, cpfMask, digits } from './combo.js';

/** Cadastro de pessoas como tipo de campo de busca (mesmo mecanismo das instituições). */
registerKind('person', {
  service: (app) => app.people, newLabel: 'outra pessoa', register: 'Cadastrar pessoa', done: 'Pessoa cadastrada',
  fields: [
    ['name', 'Nome', { maxlength: 80 }], ['nickname', 'Apelido (opcional)', { maxlength: 40, hint: 'Ajuda a encontrar a pessoa mais rápido.' }],
    ['note', 'Observação (opcional)', { maxlength: 60, placeholder: 'Ex.: vizinho, colega da academia', hint: 'Ajuda a diferenciar pessoas com o mesmo nome.' }],
    ['cpf', 'CPF (opcional)', { placeholder: '000.000.000-00', inputmode: 'numeric', input: 'mask', arg: 'cpf' }], ['pix', 'Chave Pix (opcional)', { maxlength: 80 }],
    ['phone', 'Telefone (opcional)', { type: 'tel', inputmode: 'tel', placeholder: '(00) 00000-0000', input: 'mask', arg: 'phone' }], ['email', 'E-mail (opcional)', { type: 'email', inputmode: 'email', maxlength: 80 }],
  ],
  lines: (e, uses) => [[e.phone && `tel. final ${digits(e.phone).slice(-4)}`, e.cpf && `CPF ${cpfMask(e.cpf)}`, e.note], [uses ? `${uses} empréstimo${uses === 1 ? '' : 's'}` : 'sem empréstimos']],
  label: (e) => [e.name + (e.nickname ? ` “${e.nickname}”` : ''), e.phone && `tel. final ${digits(e.phone).slice(-4)}`, e.cpf && `CPF ${cpfMask(e.cpf)}`, e.note].filter(Boolean).join(' · '),
});
