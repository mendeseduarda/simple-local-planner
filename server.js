require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;
const dbPath = path.resolve(__dirname, 'planner.db');

// Configurações
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Rota para configurações seguras
app.get('/api/config', (req, res) => {
  res.json({
    whatsappNumber: process.env.WHATSAPP_NUMBER || ""
  });
});

// Banco de Dados
const db = new Database(dbPath);

// Inicializar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6366f1'
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    category_id INTEGER,
    is_important INTEGER DEFAULT 0,
    recurrence TEXT DEFAULT 'none',
    recurrence_config TEXT,
    is_completed INTEGER DEFAULT 0,
    reminder_minutes INTEGER DEFAULT 0,
    description TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    FOREIGN KEY (category_id) REFERENCES categories (id)
  );
`);

// Migração manual: Verificar se as colunas novas existem e adicioná-las se necessário
try {
  const columns = db.prepare("PRAGMA table_info(tasks)").all();
  const hasRecurrence = columns.some(c => c.name === 'recurrence');
  if (!hasRecurrence) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN recurrence TEXT DEFAULT 'none';
      ALTER TABLE tasks ADD COLUMN recurrence_config TEXT;
    `);
    console.log("Colunas de recorrência adicionadas via migração.");
  }
} catch (e) {
  console.warn("Erro na migração automática:", e.message);
}

// Adicionar categorias padrão se estiver vazio
db.exec(`
  INSERT OR IGNORE INTO categories (name, color) VALUES 
  ('Pesquisa', '#6366f1'), 
  ('Universidade', '#ec4899'), 
  ('Projetos', '#10b981'), 
  ('Esporte', '#f59e0b');
`);

// Rotas: Categorias
app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  res.json(categories);
});

app.post('/api/categories', (req, res) => {
  const { name, color } = req.body;
  try {
    const result = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(name, color || '#6366f1');
    res.json({ id: result.lastInsertRowid, name, color: color || '#6366f1' });
  } catch (err) {
    res.status(400).json({ error: 'Categoria já existe ou inválida' });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  // Opcional: Impedir exclusão se houver tarefas vinculadas ou desvincular
  db.prepare('UPDATE tasks SET category_id = NULL WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ success: true });
});

// Rotas: Tarefas
app.get('/api/tasks', (req, res) => {
  const tasks = db.prepare(`
    SELECT t.*, c.name as category_name 
    FROM tasks t 
    LEFT JOIN categories c ON t.category_id = c.id
    ORDER BY t.date ASC, t.time ASC
  `).all();
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { title, date, time, category_id, is_important, recurrence, recurrence_config, reminder_minutes, description, guest_email, guest_phone } = req.body;
  const result = db.prepare(`
    INSERT INTO tasks (title, date, time, category_id, is_important, recurrence, recurrence_config, reminder_minutes, description, guest_email, guest_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, date, time, category_id, is_important ? 1 : 0, recurrence || 'none', recurrence_config || null, reminder_minutes || 0, description || null, guest_email || null, guest_phone || null);
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { is_completed, title, date, time, category_id, is_important, recurrence, recurrence_config, reminder_minutes, description, guest_email, guest_phone } = req.body;
  
  if (is_completed !== undefined) {
      if (is_completed) {
          db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
          return res.json({ success: true, deleted: true });
      } else {
          db.prepare('UPDATE tasks SET is_completed = ? WHERE id = ?').run(0, id);
      }
  } else {
      // Edição completa da tarefa
      db.prepare(`
          UPDATE tasks SET 
          title = ?, date = ?, time = ?, category_id = ?, 
          is_important = ?, recurrence = ?, recurrence_config = ?, reminder_minutes = ?, 
          description = ?, guest_email = ?, guest_phone = ?
          WHERE id = ?
      `).run(
          title, date, time, category_id, 
          is_important ? 1 : 0, recurrence || 'none', recurrence_config || null, reminder_minutes, 
          description, guest_email, guest_phone, id
      );
  }
  res.json({ success: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Enviar Resumo por E-mail
app.post('/api/send-email', async (req, res) => {
  const { tasks, email, subject } = req.body;
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ error: 'Configuração de e-mail ausente no .env' });
  }

  const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
      }
  });

  // Ordenar tarefas por horário (ex: 09:00 vem antes de 13:00)
  const sortedTasks = [...tasks].sort((a, b) => {
      const normalize = (t) => {
          if (!t) return '23:59';
          const [h, m] = t.split(':');
          return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
      };
      return normalize(a.time).localeCompare(normalize(b.time));
  });

  const taskListHtml = sortedTasks.map(t => {
      // Regra de Data: Mostrar APENAS se NÃO for recorrente
      const isRecurring = (t.recurrence && t.recurrence !== 'none') || t.is_weekly;
      let dateInfo = '';
      
      if (t.date && !isRecurring) {
          const p = t.date.includes('-') ? t.date.split('-') : t.date.split('/');
          if (p.length === 3) {
              const d = p[0].length === 4 ? `${p[2]}/${p[1]}` : `${p[0]}/${p[1]}`;
              dateInfo = `<span style="color: #6366f1;">📅 ${d}</span> | `;
          }
      }

      return `
      <li style="margin-bottom: 10px; list-style: none; padding: 10px; border-bottom: 1px solid #eee;">
          <div style="font-weight: bold; color: #333;">${t.title}</div>
          <div style="font-size: 0.9em; color: #666; margin-top: 4px;">
              ${dateInfo}
              <span style="font-weight: bold; color: #4f46e5;">⏰ ${t.time || 'Sem horário'}</span>
              <span style="margin-left: 10px; opacity: 0.7;">(${t.category_name || 'Geral'})</span>
          </div>
          ${t.description ? `<div style="margin-top: 5px; font-size: 0.85em; color: #888;">${t.description}</div>` : ''}
      </li>`;
  }).join('');

  const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email || process.env.EMAIL_USER,
      subject: subject || `Resumo do Planner - ${new Date().toLocaleDateString('pt-BR')}`,
      html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: auto;">
              <h2 style="color: #4f46e5; border-bottom: 2px solid #eef2ff; padding-bottom: 10px;">🗓️ Seu Planejamento</h2>
              <ul style="padding: 0;">${taskListHtml}</ul>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="font-size: 0.8em; color: #94a3b8; text-align: center;">Enviado com 💜 pelo seu Planner VibeCodado.</p>
          </div>
      `
  };

  try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Falha ao enviar e-mail' });
  }
});

// Iniciar servidor
const server = app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`!!!! ERRO: A porta ${port} já está sendo usada por outro programa.`);
    console.error(`Tente fechar outros terminais ou mude a porta no arquivo .env`);
  } else {
    console.error("Erro inesperado no servidor:", err);
  }
});

process.on('uncaughtException', (err) => {
  console.error('!!!! ERRO CRÍTICO (Uncaught Exception):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('!!!! ERRO CRÍTICO (Unhandled Rejection):', reason);
});
