# ADR 0001 — Organização em camadas e padrão Repository

- **Status:** Aceito
- **Data:** 08/11/2026

## 1. Contexto

A API Eleições Ceará 2022 precisa consultar dados eleitorais armazenados em PostgreSQL, validar critérios de pesquisa e disponibilizar os resultados por meio de uma API REST.

Era necessário definir uma organização que separasse as responsabilidades da aplicação, facilitasse os testes e reduzisse o acoplamento entre as regras de negócio e a persistência dos dados.

## 2. Decisão

Foi adotada uma arquitetura organizada em camadas, utilizando o padrão Repository para abstrair o acesso aos dados.

As responsabilidades foram distribuídas da seguinte maneira:

- **Controllers:** recebem requisições HTTP, encaminham os critérios de consulta e produzem as respostas.
- **Services:** concentram as validações e regras de negócio.
- **Repositories:** implementam o acesso aos dados e as consultas SQL.
- **Domain:** define os contratos, tipos e conceitos do domínio.

A implementação utiliza a interface `VoteRepository` como contrato de acesso aos dados e `PostgresVoteRepository` como implementação para PostgreSQL.

## 3. Justificativa

A decisão foi tomada pelos seguintes motivos:

1. Separar regras de negócio das operações de banco de dados.
2. Facilitar os testes unitários por meio de dependências substituíveis.
3. Permitir que a implementação de persistência seja modificada sem reescrever as regras do serviço.
4. Melhorar a organização e a manutenção do código.
5. Aplicar o princípio da inversão de dependência na relação entre o serviço e o contrato do repositório.

## 4. Alternativas consideradas

### Acesso direto ao banco nos controllers

Essa alternativa foi descartada porque concentraria responsabilidades HTTP e persistência na mesma camada, aumentando o acoplamento e dificultando os testes.

### Consultas SQL diretamente nos services

Também foi descartada porque misturaria regras de negócio com detalhes de persistência, reduzindo a separação de responsabilidades.

## 5. Consequências

### Benefícios

- Melhor separação de responsabilidades.
- Maior facilidade para testar regras de negócio.
- Menor acoplamento entre serviço e banco de dados.
- Organização adequada para a evolução da API.

### Custos e limitações

- Maior quantidade de arquivos e interfaces.
- Necessidade de manter contratos entre as camadas.
- Para o escopo atual, a abstração pode representar uma estrutura adicional em comparação com uma implementação mais simples.

## 6. Referências na implementação

- `src/domain/vote-repository.ts`
- `src/services/vote-service.ts`
- `src/repositories/postgres-vote-repository.ts`
- `src/controllers/vote-controller.ts`
- `src/routes/vote-routes.ts`