# API Eleições Ceará 2022

API REST para consulta dos resultados eleitorais do Ceará nas eleições de 2022, com filtros por município, zona eleitoral, seção e tipo de voto.

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

Aplique o schema inicial:

```powershell
Get-Content db\001_schema.sql -Raw | docker compose exec -T db psql -U eleicoes_app -d eleicoes_ce -v ON_ERROR_STOP=1
```

Aplique a classificação dos tipos de voto:

```powershell
Get-Content db\002_classificacao_votos.sql -Raw | docker compose exec -T db psql -U eleicoes_app -d eleicoes_ce -v ON_ERROR_STOP=1
```

Os scripts criam a estrutura necessária e classificam os registros entre votos nominais, de legenda, brancos e nulos.

## 8. Importação dos dados

Crie e ative um ambiente virtual Python:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Instale as dependências:

```powershell
pip install -r requirements.txt
```

Importe a amostra utilizada no ambiente de testes:

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

### Consulta de votos por seção

```http
GET /municipios/{codigo}/secoes/{zona}/{secao}/votos
```

Exemplo:

```http
GET /municipios/23044/secoes/1/1/votos
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
GET /municipios/23044/secoes/1/1/votos?tipo=NOMINAL&pagina=1&limite=20
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