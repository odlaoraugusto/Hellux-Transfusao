# logic_check/

Testes de lógica de negócio pura, extraídos literalmente dos services de
`app/`, mas reescritos sem dependência de FastAPI/SQLAlchemy — rodam com
Python puro (`unittest` da stdlib), então funcionam mesmo sem
`pip install -r requirements.txt`.

Existem porque o ambiente onde este projeto foi inicialmente escrito não
tinha rede/Postgres disponíveis para rodar a suíte real (`tests/`, que usa
FastAPI TestClient). Não substituem `tests/` — são um complemento que prova
que a lógica mais arriscada (máquina de estados, RBAC, numeração de bolsas
satélites, histórico de setor) está correta, independente do resto da
stack funcionar.

Rodar:
```bash
python3 -m unittest discover -p "test_*.py" -v
```
