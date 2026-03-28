# ⚙️ Como o Projeto Funciona?

Este é um guia simplificado sobre como as engrenagens deste Planner pessoal se movem! 🛠️

---

## 🏗️ Arquitetura Geral

O projeto é dividido em **Backend** (Servidor) e **Frontend** (Interface), que se comunicam de forma eficiente para manter sua rotina organizada.

### 🏠 1. O Servidor (`server.js`)
O backend foi construído com **Node.js** e o framework **Express**. Ele é responsável por:
- **Gerenciar o Banco de Dados**: Utiliza o SQLite (`better-sqlite3`) para criar tabelas e gerenciar suas tarefas e categorias de forma persistente.
- **API REST**: Expõe rotas para criar, ler, atualizar e deletar tarefas e categorias.
- **Envio de E-mail**: Utiliza o `Nodemailer` para enviar o resumo das suas tarefas. Ele busca os dados de login em um arquivo seguro chamado `.env`.

### 💾 2. O Banco de Dados (`planner.db`)
Toda a mágica da persistência de dados acontece em um arquivo local chamado `planner.db`.
- **Tabelas**: Temos tabelas para `categories` (categorias) e `tasks` (tarefas).
- **Relações**: Cada tarefa está obrigatoriamente vinculada a uma categoria, facilitando a filtragem e organização.

### 🌐 3. O Frontend (`public/`)
A interface do usuário é construída de forma modular para ser leve e organizada:
- **`index.html` e `style.css`**: Estrutura e visual do Planner.
- **`js/api.js`**: O módulo que "conversa" com o servidor, fazendo as requisições para buscar e salvar dados.
- **`js/calendar.js`**: Gerencia toda a lógica das datas, dias da semana e a visualização do calendário.
- **`js/ui.js`**: Cuida da parte visual. Ele pega as tarefas do banco e as "desenha" na tela de forma organizada.
- **`js/utils.js`**: Pequenas funções utilitárias que ajudam em tarefas comuns de formatação e lógica.

---

## 🔄 Fluxo de Dados (Exemplo)

1. **Você clica em "Salvar Tarefa"**: O arquivo `ui.js` captura as informações do formulário.
2. **Requisição**: O `api.js` envia esses dados para a rota do servidor (`/api/tasks`).
3. **Escrita no Banco**: O servidor recebe a requisição e usa o `better-sqlite3` para gravar os dados no arquivo `planner.db`.
4. **Atualização**: O servidor confirma o sucesso, e o `ui.js` atualiza a lista de tarefas na tela sem você precisar atualizar a página inteira!

---

💡 **OBS**: Como tudo roda localmente, você não precisa de internet para ver suas tarefas (apenas para enviar e-mails). 
