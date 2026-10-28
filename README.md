# Meu Patrimônio

App móvel (PWA, sem servidor) para acompanhar **investimentos de renda fixa** e controlar **empréstimos feitos a pessoas**: parcelas, juros, atraso, recibos e cobrança. Os dados ficam no aparelho; a portabilidade é por backup em arquivo.

## Rodar

```bash
npm run serve        # http://localhost:8000  (precisa de servidor: módulos ES não abrem via file://)
```

Para instalar como app, publique a pasta em um servidor **HTTPS** estático. Sem dependências de execução nem etapa de build, apenas:

```bash
npm run build:sw     # gera sw.js (lista de arquivos + nome do cache). Rode a cada publicação.
```

## Testes

```bash
npm test             # unitários: domínio, serviços, apresentação, PWA (node --test, sem dependências)
npm run e2e          # ponta a ponta no Chromium (precisa de Playwright para Python)
```

## Estrutura

```
index.html            entrada do app        legacy/   versão anterior (um arquivo só)
manifest.webmanifest  sw.js (gerado)        icons/    docs/   tools/   tests/
src/
  domain/             regras puras (empréstimos, investimentos, cadastros, mensagens)
  application/        casos de uso: LoanService, InvestmentService, MessageService, BackupService…
  infrastructure/     localStorage, backup (v1 e v2), migração
  presentation/       telas puras, ações, formulários, shell (único que toca o DOM)
  main.js             raiz de composição (createApp)
```

Regras de negócio e fórmulas: `docs/regras-de-negocio.md`. Estado, decisões e pendências: `docs/PROJETO.md`.

## Como estender

- **Novo sistema de amortização:** `registerSystem(id, estratégia)` em `domain/loan/amortization.js`.
- **Novo indexador:** uma entrada em `annualRateBy` (`domain/investment/yield.js`).
- **Nova tela:** função `{ load, render }` registrada em `presentation/views/index.js`.
- **Nova ação:** função em `presentation/actions/*`, acionada por `data-action="nome"`.
- **Novo cadastro com busca:** `registerKind` em `presentation/combo.js` e um `kind` em `domain/registry/`.

## Migração e backup

Na primeira abertura, os dados da versão anterior (`mp:v1`) são convertidos sem alterar o original. O backup exportado é **versão 2**; a importação aceita as versões 1 e 2.
