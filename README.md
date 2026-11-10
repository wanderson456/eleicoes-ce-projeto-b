# API Eleições Ceará

API REST para consulta de dados eleitorais do Ceará, com filtros por município, zona eleitoral, seção, ano, turno, cargo e tipo de voto. Disponibiliza consultas de votos por seção e resultados eleitorais consolidados por município.
## 1. Objetivo

Disponibilizar consultas estruturadas aos votos registrados nas eleições de 2022 no Ceará, permitindo localizar os resultados de uma seção eleitoral e paginar os registros retornados.

## 2. Tecnologias

- Node.js 22
- TypeScript
- Express 5
- PostgreSQL 16
- Python 3.13 para importação dos dados
- Docker e Docker Compose
- Vitest e Supertest para testes
- Pino e pino-http para logs estruturados
- k6 para testes de carga

## 3. Arquitetura

O projeto utiliza organização em camadas e o padrão Repository.

| Camada | Responsabilidade |
|---|---|
| Controllers | Receber requisições HTTP e devolver respostas |
| Services | Aplicar regras de negócio e validar critérios |
| Repositories | Consultar os dados persistidos no PostgreSQL |
| Domain | Definir tipos, contratos e regras do domínio |
| Config | Centralizar configurações da aplicação |
| Middlewares | Tratar erros e comportamentos transversais |
| Observability | Disponibilizar métricas e indicadores HTTP |

O padrão Repository separa a lógica de acesso ao banco das regras de negócio, permitindo testar os serviços sem depender diretamente do PostgreSQL.

## 4. Requisitos

- Node.js 22
- npm
- Docker Desktop com Docker Compose
- Python 3.13
- Git

## 5. Configuração do ambiente

Clone o repositório:

```powershell
git clone https://github.com/wanderson456/eleicoes-ce-projeto-b.git
cd eleicoes-ce-projeto-b
```

Crie o arquivo de ambiente:

```powershell
Copy-Item .env.example .env
```

Configure os valores locais no arquivo `.env`. Não versione esse arquivo, pois ele pode conter credenciais.

O arquivo `.env.example` apresenta os nomes das variáveis necessárias.

## 6. Inicialização com Docker

Inicie os serviços:

```powershell
docker compose up -d --build
```

Verifique o estado dos contêineres:

```powershell
docker compose ps
```

A API fica disponível em:

- API: http://localhost:3001
- PostgreSQL: localhost:5433

Verifique a saúde da aplicação:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

Resposta esperada:

```json
{
  "status": "ok"
}
```


## 7. Preparação do banco de dados

Com o PostgreSQL em execução pelo Docker Compose, configure o ambiente Python:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Execute o gerenciador de migrações:

```powershell
python scripts/migrate.py
```

O gerenciador identifica as migrações pendentes em `db/`, aplica cada arquivo SQL em uma transação e registra sua execução na tabela `schema_migrations`.

**Bancos existentes:** se o banco já possuía as estruturas criadas pelas migrações `001` e `002`, utilize uma única vez:

```powershell
python scripts/migrate.py --baseline-existing
```

Essa opção valida o schema existente e registra as migrações iniciais no histórico, sem executá-las novamente.

## 8. Importação dos dados

### 8.1. Dependências Python

Com o ambiente virtual ativado:

```powershell
pip install -r requirements.txt
```

### 8.2. Importação da correspondência TSE–IBGE

O projeto mantém a correspondência oficial entre os códigos municipais do TSE e do IBGE para os 184 municípios do Ceará.

O arquivo utilizado é:

`dados/correspondencia-tse-ibge/ceara.csv`

Execute:

```powershell
python scripts/import_municipality_mapping.py
```

O script valida a quantidade de municípios, os códigos TSE e IBGE, os campos obrigatórios e a unicidade dos identificadores antes de importar os registros.

A importação utiliza transação e `ON CONFLICT` para atualizar registros existentes, permitindo sua execução repetida sem duplicações.

### 8.3. Importação dos dados eleitorais

Para importar a base de amostra:

```powershell
python scripts/import_data.py --mode sample
```

Para importar a base completa, disponibilize os arquivos eleitorais esperados em `data/raw` e execute:

```powershell
python scripts/import_data.py --mode full
```

O modo `sample` utiliza os arquivos de `data/ci`. O modo `full` utiliza os arquivos de `data/raw`.

A importação executa o carregamento em tabelas de staging e, em seguida, insere os registros nas tabelas definitivas.


## 9. Endpoints

### Verificação de saúde

```http
GET /health
```

### Listagem de seções por município

```http
GET /municipios/{codigo}/secoes
```

Lista as seções eleitorais cadastradas para um município, incluindo suas zonas eleitorais e coordenadas geográficas quando disponíveis.

Exemplo:

```http
GET /municipios/2300200/secoes?ano=2022&pagina=1&limite=20
```

Parâmetros de rota:

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `codigo` | Sim | Código IBGE do município, com exatamente sete dígitos |

Parâmetros de consulta:

| Parâmetro | Obrigatório | Padrão | Descrição |
|---|---|---|---|
| `ano` | Sim | — | Ano da eleição, com quatro dígitos |
| `pagina` | Não | 1 | Página dos resultados |
| `limite` | Não | 20 | Registros por página, de 1 a 100 |
A resposta contém:

- `items`: lista de seções, com código do município, zona, seção, latitude e longitude;
- `total`: quantidade total de registros encontrados;
- `page`: página atual;
- `limit`: quantidade máxima de registros por página;
- `totalPages`: quantidade total de páginas.

Respostas HTTP principais:

| Código | Significado |
|---|---|
| 200 | Consulta realizada |
| 400 | Parâmetros inválidos |
| 500 | Erro interno do servidor |


### Consulta de votos por seção

```http
GET /municipios/{codigo}/secoes/{zona}/{secao}/votos
```

Exemplo:

```http
GET /municipios/23044/secoes/1/1/votos?ano=2022&turno=1
```

Parâmetros de rota:

| Parâmetro | Descrição |
|---|---|
| `codigo` | Código do município, com exatamente cinco dígitos |
| `zona` | Número positivo da zona eleitoral |
| `secao` | Número positivo da seção eleitoral |

Parâmetros de consulta:

| Parâmetro | Obrigatório | Padrão | Descrição |
|---|---|---|---|
| `ano` | Sim | — | Ano da eleição, com quatro dígitos |
| `turno` | Sim | — | Turno eleitoral: `1` ou `2` |
| `tipo` | Não | Todos | Tipo de voto |
| `pagina` | Não | 1 | Página dos resultados |
| `limite` | Não | 20 | Registros por página, de 1 a 100 |
Tipos de voto aceitos:

- `NOMINAL`
- `LEGENDA`
- `BRANCO`
- `NULO`

Exemplo com filtros:

```http
GET /municipios/23044/secoes/1/1/votos?ano=2022&turno=1&tipo=NOMINAL&pagina=1&limite=20
```

A resposta contém:

- `items`: registros encontrados;
- `total`: quantidade total de registros correspondentes;
- `page`: página atual;
- `limit`: quantidade máxima de registros por página;
- `totalPages`: quantidade total de páginas.

Respostas HTTP principais:

| Código | Significado |
|---|---|
| 200 | Consulta realizada |
| 400 | Parâmetros inválidos |
| 500 | Erro interno do servidor |


### Resultados eleitorais por município

```http
GET /municipios/{codigo}/resultados
```

Consulta os resultados eleitorais consolidados de um município, agrupados por cargo, incluindo votos nominais, de legenda, brancos e nulos, além dos totais por candidato e partido.

Exemplo:

```http
GET /municipios/13250/resultados?ano=2022&turno=1
```

O código `13250` corresponde ao código TSE de Araripe-CE.

Parâmetros de rota:

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `codigo` | Sim | Código TSE do município, com exatamente cinco dígitos |

Parâmetros de consulta:

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `ano` | Sim | Ano da eleição, com quatro dígitos |
| `turno` | Sim | Turno eleitoral: `1` ou `2` |
| `cargo` | Não | Código positivo do cargo eleitoral para filtrar os resultados |

Códigos de cargo utilizados na base:

| Código | Cargo |
|---|---|
| 3 | Governador |
| 5 | Senador |
| 6 | Deputado Federal |
| 7 | Deputado Estadual |

Exemplo com filtro por cargo:

```http
GET /municipios/13250/resultados?ano=2022&turno=1&cargo=7
```

A resposta contém:

- `municipalityCode`: código TSE do município;
- `municipalityName`: nome do município;
- `year`: ano eleitoral;
- `round`: turno eleitoral;
- `offices`: resultados agrupados por cargo.

Cada cargo apresenta:

- `totalVotes`: total de votos registrados;
- `validVotes`: total de votos válidos, considerando nominais e de legenda;
- `nominalVotes`: total de votos nominais;
- `legendVotes`: total de votos de legenda;
- `blankVotes`: total de votos brancos;
- `nullVotes`: total de votos nulos;
- `candidates`: relação de candidatos, com votos e percentual;
- `parties`: relação de partidos, com votos nominais, de legenda, total e percentual.

Respostas HTTP principais:

| Código | Significado |
|---|---|
| 200 | Consulta realizada |
| 400 | Parâmetros inválidos |
| 404 | Nenhum resultado encontrado para os critérios informados |
| 500 | Erro interno do servidor |

**Observação:** o endpoint recebe ano e turno como parâmetros, mas a importação atualmente disponibilizada pelo projeto contempla os dados eleitorais de 2022. A consulta de outros anos depende da disponibilização e importação das respectivas bases.

### Métricas

```http
GET /metrics
```

Disponibiliza métricas HTTP em formato compatível com Prometheus, incluindo quantidade de requisições, respostas 5xx e latência p95.

## 10. Testes e qualidade

Instale as dependências Node.js:

```powershell
npm ci
```

Execute os testes unitários:

```powershell
npm run test:unit
```

Execute os testes de integração:

```powershell
npm run test:integration
```

Execute todos os testes:

```powershell
npm test
```

Verifique a cobertura:

```powershell
npm run test:coverage
```

Compile o projeto:

```powershell
npm run build
```

Execute o lint:

```powershell
npm run lint
```

Os testes de integração dependem de um PostgreSQL configurado e acessível pela porta definida em `TEST_DATABASE_PORT`.

## 11. Logs e observabilidade

A aplicação utiliza Pino e pino-http para produzir logs estruturados em JSON.

As informações incluem dados da requisição, método HTTP, rota, código de resposta e duração.

O endpoint `/metrics` disponibiliza indicadores de requisições, erros HTTP 5xx e latência.

As métricas são mantidas em memória e reiniciadas quando o processo da API é reiniciado. As limitações e metas experimentais estão documentadas em [docs/desempenho.md](docs/desempenho.md).

## 12. Integração contínua

O GitHub Actions executa:

1. Instalação das dependências Node.js e Python.
2. Inicialização do PostgreSQL de testes.
3. Aplicação dos scripts SQL.
4. Importação da amostra eleitoral.
5. Compilação TypeScript.
6. Verificação de lint.
7. Testes unitários.
8. Testes de integração.
9. Verificação de cobertura.

O workflow está em `.github/workflows/ci.yml`.

## 13. Documentação complementar

- [Desempenho e SLO](docs/desempenho.md)
- [Decisões de arquitetura](docs/adr/0001-decisao.md)
- [Especificação OpenAPI](docs/openapi.yaml)
- [Declaração de uso de IA](docs/ia.md)