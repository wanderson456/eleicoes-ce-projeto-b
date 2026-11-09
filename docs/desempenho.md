# Desempenho e SLO

## 1. Objetivo

Definir indicadores para acompanhar a disponibilidade e a latência da API de consulta de resultados eleitorais.

## 2. Objetivos de nível de serviço (SLO)

As metas iniciais propostas são:

| Indicador | Meta |
|---|---:|
| Disponibilidade | >= 99,5% |
| Latência p95 | <= 500 ms |

Essas metas são objetivos de referência para a avaliação experimental do projeto e ainda não representam resultados comprovados em produção.

## 3. Métricas disponíveis

A API disponibiliza o endpoint `GET /metrics`, em formato compatível com Prometheus.

| Métrica | Descrição |
|---|---|
| `http_requests_total` | Total de requisições, agrupadas por método, rota e status |
| `http_server_errors_total` | Total de respostas HTTP com status 5xx |
| `http_request_duration_ms` | Latência das requisições em milissegundos |

O percentil 95 é calculado sobre as últimas 10.000 amostras mantidas em memória.

## 4. Limitações atuais

- As métricas são mantidas em memória e reiniciadas quando o processo da API reinicia.
- Não existe armazenamento histórico de métricas.
- Não há monitoramento contínuo durante uma janela de 30 dias.
- O p95 representa uma janela limitada pelas últimas 10.000 amostras, não uma janela temporal fixa.
- As metas de SLO serão avaliadas por meio de testes controlados de carga em ambiente acadêmico.

## 5. Critérios de avaliação

Para avaliar os objetivos propostos, devem ser coletadas evidências de:

1. Quantidade de requisições recebidas.
2. Quantidade de respostas HTTP 5xx.
3. Distribuição da latência das requisições.
4. Percentil 95 durante testes de carga.
5. Comportamento da API durante o período de execução dos testes.

## 6. Próximas melhorias

- Persistir métricas em uma solução de monitoramento.
- Implementar acompanhamento histórico da disponibilidade.
- Automatizar testes de carga com k6.
- Criar alertas para erros 5xx e degradação da latência.

## 7. Resultados do teste de carga

### 7.1. Configuração

O teste foi executado localmente com k6, utilizando a seguinte configuração:

- Duração: 1 minuto.
- Usuários virtuais: 10.
- Endpoint: consulta de votos por município, zona e seção.
- Massa de dados: seção sintética com quatro registros.
- Total de requisições: 600.

### 7.2. Resultados medidos

| Indicador | Resultado |
|---|---:|
| Requisições HTTP | 600 |
| Taxa média de requisições | 9,96 req/s |
| Latência média | 3,39 ms |
| Latência mediana | 2,55 ms |
| Latência p90 | 4,76 ms |
| Latência p95 | 6,31 ms |
| Latência máxima | 43,12 ms |
| Falhas HTTP | 0% |
| Verificações aprovadas | 100% (1.200/1.200) |

### 7.3. Avaliação das metas

| Indicador | Meta | Resultado | Avaliação |
|---|---:|---:|---|
| Disponibilidade experimental | >= 99,5% | 100% | Atingida |
| Latência p95 | <= 500 ms | 6,31 ms | Atingida |

A disponibilidade experimental foi calculada considerando as 600 requisições HTTP realizadas, sem respostas de erro.

### 7.4. Conclusão

Durante o teste local de aproximadamente um minuto, a API atendeu às metas experimentais definidas para disponibilidade e latência.

Todas as requisições retornaram HTTP 200 e os dados esperados foram encontrados. O percentil 95 de latência foi de 6,31 ms, inferior ao limite estabelecido de 500 ms.

Os resultados são válidos para as condições específicas do experimento e não representam uma garantia de desempenho em produção ou sob cargas maiores.
