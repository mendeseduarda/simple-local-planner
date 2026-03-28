// Funções globais que o HTML chama via onclick
window.toggleModal = (id) => PlannerUI.toggleModal(id);
window.closeDetails = () => PlannerUI.closeDetails();
window.renderWeeklyView = () => _renderWeeklyView();
window.renderCalendarGrid = () => _renderCalendarGrid();
window.changeMonth = (delta) => {
    calendarDate.setMonth(calendarDate.getMonth() + delta);
    _renderCalendarGrid();
};

window.addTask = (e) => _addTask(e);
window.addCategory = (e) => _addCategory(e);
window.deleteTask = (id) => _deleteTask(id);
window.deleteCategory = (id) => _deleteCategory(id);
window.toggleComplete = (id, status) => _toggleComplete(id, status);
window.loadData = () => _loadData();
window.sendEmailSummary = () => _sendEmailSummary();
window.generateWhatsAppSummary = () => _generateWhatsAppSummary();
window.sendGuestInvitation = (task) => _sendGuestInvitation(task);
window.sendGuestWhatsApp = (task) => _sendGuestWhatsApp(task);
window.editTask = (id) => _editTask(id);
window.filterByDay = (dateISO, label) => _filterByDay(dateISO, label);
window.handleRecurrenceChange = () => _handleRecurrenceChange();

let tasks = [];

let categories = [];
let calendarDate = new Date(); // Para controlar o mês sendo visualizado

const DAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function _handleRecurrenceChange() {
    const type = document.getElementById('taskRecurrence').value;
    const customUI = document.getElementById('customRecurrenceUI');
    const list = document.getElementById('customDaysList');
    
    if (type === 'custom') {
        customUI.classList.remove('hidden');
        if (list.children.length === 0) {
            const template = document.getElementById('customDayRow');
            DAYS_SHORT.forEach((day, index) => {
                const clone = template.content.cloneNode(true);
                clone.querySelector('.day-label').innerText = day;
                clone.querySelector('.day-check').dataset.dayIndex = index;
                list.appendChild(clone);
            });
        }
    } else {
        customUI.classList.add('hidden');
    }
}

// Bind explícito para o HTML chamar
window._handleRecurrenceChange = _handleRecurrenceChange;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM carregado, iniciando scripts...");
    
    // Bind explicito para garantir que as funções globais funcionem
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.onsubmit = (e) => {
            console.log("taskForm submetido");
            e.preventDefault();
            _addTask(e);
        };
    }
    
    const catForm = document.getElementById('categoryForm');
    if (catForm) {
        catForm.onsubmit = (e) => {
            console.log("categoryForm submetido");
            e.preventDefault();
            _addCategory(e);
        };
    }

    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dateDisplay = document.getElementById('currentDateDisplay');
    if (dateDisplay) dateDisplay.innerText = today;
    
    const taskDateInput = document.getElementById('taskDate');
    if (taskDateInput) taskDateInput.valueAsDate = new Date();

    if ("Notification" in window) {
        Notification.requestPermission();
    }
    
    _loadData();
    setInterval(_checkReminders, 60000); // Checa a cada minuto
});

let notifiedTasks = new Set();

async function triggerEmailReminder(task) {
    await fetch(`${API}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            tasks: [{ 
                title: task.title, 
                category_name: task.category_name, 
                date: task.date,
                time: task.time 
            }], 
            email: null,
            subject: `LEMBRETE: ${task.title}`
        })
    });
}

function _checkReminders() {
    const now = new Date();
    tasks.filter(t => !t.is_completed && t.reminder_minutes > 0 && !notifiedTasks.has(t.id)).forEach(task => {
        const taskDate = new Date(`${task.date}T${task.time || '00:00'}`);
        const diffMs = taskDate - now;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes > 0 && diffMinutes <= task.reminder_minutes) {
            // Notificação Visual
            if (Notification.permission === "granted") {
                new Notification("Lembrete do Planner", {
                    body: `Tarefa "${task.title}" em ${diffMinutes} minutos!`,
                });
            }
            // Notificação por E-mail
            triggerEmailReminder(task);
            notifiedTasks.add(task.id);
        }
    });
}

async function _loadData() {
    try {
        console.log("Tentando carregar dados via PlannerAPI...");
        tasks = await PlannerAPI.fetchTasks();
        categories = await PlannerAPI.fetchCategories();
        console.log("Sucesso! Dados carregados:", { tasks, categories });
        _renderUI();
    } catch (err) {
        console.error('Erro ao usar PlannerAPI:', err);
    }
}

// Helper para normalizar e ordenar tarefas por horário
function _sortTasksByTime(taskArray, dateISO) {
    return taskArray.map(t => {
        let displayTask = { ...t };
        if (t.recurrence === 'custom' && t.recurrence_config) {
            try {
                const configs = JSON.parse(t.recurrence_config);
                const targetDayIndex = new Date(dateISO + 'T00:00:00').getDay();
                const specificConfig = configs.find(c => parseInt(c.dayIndex) === targetDayIndex);
                if (specificConfig && specificConfig.time) {
                    displayTask.time = specificConfig.time;
                }
            } catch (e) { console.error('Erro ao ajustar horário:', e); }
        }
        return displayTask;
    }).sort((a, b) => {
        const normalize = (timeStr) => {
            if (!timeStr || timeStr === 'Sem horário') return '23:59';
            const parts = timeStr.toString().split(':');
            return `${(parts[0] || '00').padStart(2, '0')}:${(parts[1] || '00').padStart(2, '0')}`;
        };
        return normalize(a.time).localeCompare(normalize(b.time));
    });
}

function _renderUI() {
    // Renderizar Categorias no seletor e no container
    const catSelect = document.getElementById('taskCategory');
    const catContainer = document.getElementById('categoryContainer');
    if (catSelect) catSelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    if (catContainer) catContainer.innerHTML = '';
    
    categories.forEach(cat => {
        if (catSelect) {
            const option = document.createElement('option');
            option.value = cat.id;
            option.innerText = cat.name;
            catSelect.appendChild(option);
        }

        if (catContainer) {
            const count = tasks.filter(t => t.category_id === cat.id && !t.is_completed).length;
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-colors group cursor-default';
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cat.color || '#6366f1'}"></span>
                    <span class="font-semibold text-slate-700 text-sm">${cat.name}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="bg-white px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-400 border border-slate-100 group-hover:text-indigo-500 group-hover:border-indigo-100 transition-colors">${count}</span>
                    <button onclick="_deleteCategory(${cat.id})" class="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            catContainer.appendChild(item);
        }
    });

    // Renderizar Tarefas
    const taskList = document.getElementById('taskList');
    const weeklyView = document.getElementById('weeklyView');
    const completedList = document.getElementById('completedTasks');
    const labelEl = document.getElementById('selectedDayLabel');
    
    if (taskList) taskList.innerHTML = '';
    if (weeklyView) weeklyView.innerHTML = '';
    if (completedList) completedList.innerHTML = '';
    
    // Resetar label para "Hoje" ao carregar/recarregar
    if (labelEl) labelEl.innerText = 'Hoje';

    const todayISO = new Date().toISOString().split('T')[0];
    const activeTasks = tasks.filter(t => !t.is_completed);
    const todayTasks = activeTasks.filter(t => {
        if (typeof PlannerUtils !== 'undefined') {
            return PlannerUtils.isTaskOnDate(t, todayISO);
        }
        return t.date === todayISO;
    });
    
    const doneTasks = tasks.filter(t => t.is_completed);

    // Renderizar Visão Semanal
    if (document.getElementById('viewMonthBtn').classList.contains('bg-white')) {
        _renderCalendarGrid();
    } else {
        _renderWeeklyView();
    }

    // Atualizar Contadores
    const pendingCount = document.getElementById('pendingCount');
    if (pendingCount) pendingCount.innerText = `${todayTasks.length} para hoje`;

    if (taskList && todayTasks.length === 0) {
        taskList.innerHTML = `
            <div class="text-center py-12 card border-dashed border-2 bg-slate-50/50">
                <i class="fas fa-check-double text-slate-300 text-4xl mb-3"></i>
                <p class="text-slate-500 font-medium">Tudo limpo por hoje!</p>
                <p class="text-slate-400 text-sm">Clique em um dia no calendário para ver outras datas.</p>
            </div>
        `;
    }

    // Ordenar tarefas de hoje
    const sortedTodayTasks = _sortTasksByTime(todayTasks, todayISO);

    sortedTodayTasks.forEach(task => {
        const cat = categories.find(c => c.id === task.category_id);
        renderTaskItem(task, taskList, cat?.color);
    });

    doneTasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'card p-3 flex items-center justify-between border-slate-100 bg-slate-50/50';
        div.innerHTML = `
            <div class="flex items-center gap-4 opacity-50">
                <div onclick="_toggleComplete(${task.id}, 0)" class="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center text-white cursor-pointer">
                    <i class="fas fa-check text-[10px]"></i>
                </div>
                <span class="text-sm font-medium line-through text-slate-500">${task.title}</span>
            </div>
            <button onclick="_deleteTask(${task.id})" class="text-slate-300 hover:text-red-400">
                <i class="fas fa-times"></i>
            </button>
        `;
        if (completedList) completedList.appendChild(div);
    });
}

function toggleCompletedList() {
    const list = document.getElementById('completedTasks');
    const icon = document.getElementById('completedIcon');
    if (list && icon) {
        const isHidden = list.classList.contains('hidden');
        list.classList.toggle('hidden');
        icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    }
}

// Funções de ação
async function _addTask(e) {
    if (e && e.preventDefault) e.preventDefault();
    try {
        const titleEl = document.getElementById('taskTitle');
        const dateEl = document.getElementById('taskDate');
        const timeEl = document.getElementById('taskTime');
        const catEl = document.getElementById('taskCategory');
        const impEl = document.getElementById('taskImportant');
        const recTypeEl = document.getElementById('taskRecurrence');
        const remEl = document.getElementById('taskReminder');
        const descEl = document.getElementById('taskDescription');
        const gEmailEl = document.getElementById('taskGuestEmail');
        const gPhoneEl = document.getElementById('taskGuestPhone');
        const idEl = document.getElementById('taskId');
        const taskId = idEl ? idEl.value : null;

        // Configuração de recorrência customizada
        let recurrenceConfig = null;
        if (recTypeEl.value === 'custom') {
            const rows = document.querySelectorAll('#customDaysList > div');
            const configs = [];
            rows.forEach((row, idx) => {
                const check = row.querySelector('.day-check');
                const timeInput = row.querySelector('.day-time');
                if (check && check.checked) {
                    configs.push({
                        dayIndex: parseInt(check.dataset.dayIndex),
                        time: timeInput ? timeInput.value : null
                    });
                }
            });
            recurrenceConfig = configs.length > 0 ? JSON.stringify(configs) : null;
        }

        const taskData = {
            title: titleEl ? titleEl.value : '',
            date: dateEl ? dateEl.value : '',
            time: timeEl ? timeEl.value : '',
            category_id: catEl ? catEl.value : null,
            is_important: impEl ? impEl.checked : false,
            recurrence: recTypeEl ? recTypeEl.value : 'none',
            recurrence_config: recurrenceConfig,
            reminder_minutes: remEl ? parseInt(remEl.value) : 0,
            description: descEl ? descEl.value : '',
            guest_email: gEmailEl ? gEmailEl.value : '',
            guest_phone: gPhoneEl ? gPhoneEl.value : ''
        };

        if (!taskData.title || !taskData.date) {
            alert('Por favor, preencha o título e a data.');
            return;
        }

        await PlannerAPI.saveTask(taskData, taskId);
        
        // Enviar convite imediato se houver email
        if (taskData.guest_email) {
            _sendGuestInvitation(taskData);
        }

        const taskForm = document.getElementById('taskForm');
        if (taskForm) taskForm.reset();
        
        const taskDateInput = document.getElementById('taskDate');
        if (taskDateInput) taskDateInput.valueAsDate = new Date();
        
        toggleModal('taskModal');
        await _loadData();
        
        // Se estava editando, fechar e reabrir os detalhes para atualizar a mensagem visual
        if (taskId) {
            closeDetails();
            showTaskDetails(parseInt(taskId));
        }

        // Recarregar a visão atual (semana ou mês)
        const monthBtn = document.getElementById('viewMonthBtn');
        const isMonthView = monthBtn && monthBtn.classList.contains('bg-white');
        if (isMonthView) renderCalendarGrid();
        else renderWeeklyView();
    } catch (err) {
        console.error('Erro detalhado:', err);
        alert('Erro ao adicionar tarefa. Verifique o console do navegador.');
    }
}

async function _addCategory(e) {
    if (e && e.preventDefault) e.preventDefault();
    const nameInput = document.getElementById('catName');
    const colorInput = document.getElementById('catColor');
    if (!nameInput) return;
    
    const name = nameInput.value;
    const color = colorInput ? colorInput.value : '#6366f1';
    
    try {
        await PlannerAPI.saveCategory({ name, color });
        
        const catForm = document.getElementById('categoryForm');
        if (catForm) catForm.reset();
        
        window.toggleModal('categoryModal');
        await _loadData();
    } catch (err) {
        console.error('Erro ao adicionar categoria:', err);
    }
}

async function _toggleComplete(id, status) {
    await PlannerAPI.toggleTaskComplete(id, status);
    _loadData();
}

async function _deleteTask(id) {
    if (confirm('Deseja excluir esta tarefa?')) {
        await PlannerAPI.deleteTaskById(id);
        _loadData();
    }
}

async function _generateWhatsAppSummary() {
    const today = new Date().toISOString().split('T')[0];
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const todayTasks = tasks.filter(t => t.date === today && !t.is_completed);
    
    if (todayTasks.length === 0) {
        alert('Nenhuma tarefa pendente para hoje!');
        return;
    }

    let msg = `*Resumo do Dia ${todayStr}*\n\n`;
    
    // Agrupar por categoria
    const grouped = {};
    todayTasks.forEach(t => {
        const cat = t.category_name || 'Geral';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(t);
    });

    for (const [cat, items] of Object.entries(grouped)) {
        msg += `*${cat}:*\n`;
        items.forEach(t => {
            const timeStr = t.time ? `${t.time}: ` : '';
            const impStr = t.is_important ? ' (Importante!)' : '';
            const weekStr = t.is_weekly ? ' (Semanal)' : '';
            msg += `- ${timeStr}${t.title}${impStr}${weekStr}\n`;
        });
        msg += '\n';
    }

    // Buscar número do servidor para segurança
    try {
        const configRes = await fetch(`http://localhost:3000/api/config`);
        const config = await configRes.json();
        const phone = config.whatsappNumber;
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    } catch (err) {
        console.error('Erro ao buscar configuração:', err);
        const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    }
}

async function _sendEmailSummary() {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => {
        const onDate = (typeof PlannerUtils !== 'undefined') ? PlannerUtils.isTaskOnDate(t, today) : t.date === today;
        return onDate && !t.is_completed;
    });
    
    // Garantir que a data, a categoria e a descrição sejam enviadas corretamente para cada tarefa
    const tasksWithDetails = todayTasks.map(t => ({
        title: t.title,
        category_name: t.category_name || 'Geral',
        date: t.date,
        time: t.time || 'Sem horário',
        description: t.description || ''
    }));
    
    if (todayTasks.length === 0) {
        alert('Nenhuma tarefa pendente para hoje!');
        return;
    }

    const email = prompt("Informe o e-mail de destino (Deixe em branco para usar o do .env):");
    
    try {
        const res = await fetch(`http://localhost:3000/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks: tasksWithDetails, email })
        });
        
        if (res.ok) {
            alert('Resumo enviado para o e-mail com sucesso!');
        } else {
            const err = await res.json();
            alert(`Erro: ${err.error || 'Falha ao enviar e-mail'}`);
        }
    } catch (err) {
        console.error(err);
        alert('Erro ao conectar com o servidor de e-mail.');
    }
}

async function _deleteCategory(id) {
    if (confirm('Deseja excluir esta categoria? As tarefas vinculadas ficarão sem categoria.')) {
        try {
            await PlannerAPI.deleteCategoryById(id);
            await _loadData();
        } catch (err) {
            console.error('Erro ao excluir categoria:', err);
        }
    }
}

function _filterByDay(dateISO, label) {
    const labelEl = document.getElementById('selectedDayLabel');
    if (labelEl) labelEl.innerText = label;

    // Usar PlannerUtils.isTaskOnDate para incluir tarefas semanais no filtro
    const filteredTasks = tasks.filter(t => {
        if (t.is_completed) return false;
        if (typeof PlannerUtils !== 'undefined') {
            return PlannerUtils.isTaskOnDate(t, dateISO);
        }
        return t.date === dateISO;
    });
    
    const taskList = document.getElementById('taskList');
    const pendingCount = document.getElementById('pendingCount');
    
    if (taskList) {
        taskList.innerHTML = '';
        if (pendingCount) pendingCount.innerText = `${filteredTasks.length} tarefas`;
        
        if (filteredTasks.length === 0) {
            taskList.innerHTML = `
                <div class="text-center py-12 card border-dashed border-2 bg-slate-50/50">
                    <i class="fas fa-calendar-day text-slate-300 text-4xl mb-3"></i>
                    <p class="text-slate-500 font-medium">Nenhuma tarefa para ${label}</p>
                    <button onclick="_loadData()" class="mt-2 text-xs text-indigo-500 underline">Voltar para hoje</button>
                </div>
            `;
        }

        // Ordenar por horário usando helper
        const sortedTasks = _sortTasksByTime(filteredTasks, dateISO);

        sortedTasks.forEach(task => {
            const cat = categories.find(c => c.id === task.category_id);
            renderTaskItem(task, taskList, cat?.color);
        });

        // Scroll suave para a lista de tarefas
        taskList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}


function renderTaskItem(task, container, catColor) {
    const div = document.createElement('div');
    div.onclick = () => showTaskDetails(task.id);
    div.className = `task-item card p-4 flex items-center justify-between group cursor-pointer border-l-4 ${task.is_important ? 'task-important' : 'border-l-indigo-500'}`;
    
    if (catColor) {
        div.style.borderLeftColor = catColor;
    }

    const isRecurring = (task.recurrence && task.recurrence !== 'none') || task.is_weekly;

    div.innerHTML = `
        <div class="flex items-center gap-5 flex-1 min-w-0">
            <div onclick="event.stopPropagation(); _toggleComplete(${task.id}, 1)" class="checkbox-custom ${task.is_important ? 'border-orange-200' : ''}">
                <i class="fas fa-check text-[10px] text-white transition-opacity opacity-0 group-hover:opacity-20" style="${catColor ? 'color: ' + catColor : ''}"></i>
            </div>
            <div class="min-w-0">
                <div class="flex items-center gap-3 flex-wrap">
                    <h4 class="font-bold text-slate-800 truncate">${task.title}</h4>
                    ${task.is_important ? '<span class="px-2 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-black uppercase rounded">Prioridade</span>' : ''}
                    ${isRecurring ? '<span class="text-indigo-400 text-[10px] font-bold uppercase tracking-tighter"><i class="fas fa-redo-alt mr-1"></i>Repetição</span>' : ''}
                </div>
                <div class="text-[11px] font-semibold text-slate-400 flex items-center gap-3 mt-1 uppercase tracking-wider">
                    <span class="flex items-center gap-1.5"><i class="far fa-folder" style="color: ${catColor || '#6366f1'}"></i> ${task.category_name || 'Geral'}</span>
                    <span class="flex items-center gap-1.5">
                        <i class="far fa-clock text-slate-300"></i> 
                        ${isRecurring ? '' : formatDate(task.date) + ' às '} 
                        ${task.time || 'Sem horário'}
                    </span>
                </div>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <button onclick="event.stopPropagation(); deleteTask(${task.id})" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
                <i class="fas fa-trash-alt text-sm"></i>
            </button>
        </div>
    `;
    container.appendChild(div);
}

function _renderWeeklyView() {
    if (typeof PlannerCalendar !== 'undefined') {
        PlannerCalendar.renderWeeklyView(tasks, categories, _filterByDay);
    } else {
        console.error('PlannerCalendar não carregado');
    }
}

function _renderCalendarGrid() {
    if (typeof PlannerCalendar !== 'undefined') {
        PlannerCalendar.renderCalendarGrid(calendarDate, tasks, categories, _filterByDay);
    } else {
        console.error('PlannerCalendar não carregado');
    }
}

// Helpers
function showTaskDetails(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const panel = document.getElementById('taskDetailsPanel');
    const content = document.getElementById('detailsContent');

    if (panel && content) {
        panel.classList.remove('hidden');
        
        const cat = categories.find(c => c.id === task.category_id);
        const descHtml = task.description ? task.description.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-indigo-600 underline">$1</a>') : '<i>Sem descrição</i>';

        content.innerHTML = `
            <div class="space-y-4">
                <div>
                    <h4 class="text-xs font-black uppercase text-slate-400 tracking-widest mb-1">Título</h4>
                    <p class="font-bold text-slate-800 text-lg">${task.title}</p>
                </div>
                
                <div>
                    <h4 class="text-xs font-black uppercase text-slate-400 tracking-widest mb-1">Status</h4>
                    <span class="px-2 py-1 ${cat?.color ? '' : 'bg-indigo-50 text-indigo-600'} rounded-lg text-xs font-bold" style="${cat?.color ? `background-color: ${cat.color}22; color: ${cat.color}` : ''}">
                        ${task.category_name || 'Geral'}
                    </span>
                </div>

                <div>
                    <h4 class="text-xs font-black uppercase text-slate-400 tracking-widest mb-1">Descrição & Links</h4>
                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap break-words overflow-hidden">${descHtml}</div>
                </div>

                ${task.guest_email || task.guest_phone ? `
                <div class="pt-4 border-t border-slate-100">
                    <h4 class="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 text-center">Convidados & Ações</h4>
                    <div class="grid grid-cols-2 gap-2">
                        ${task.guest_email ? `
                        <button onclick="_sendGuestInvitation(${JSON.stringify(task).replace(/"/g, '&quot;')})" class="flex flex-col items-center gap-1 p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition shadow-sm border border-blue-100">
                            <i class="fas fa-envelope text-lg"></i>
                            <span class="text-[10px] font-black uppercase">E-mail (${task.guest_email.split(',').length})</span>
                        </button>` : ''}
                        ${task.guest_phone ? `
                        <button onclick="_sendGuestWhatsApp(${JSON.stringify(task).replace(/"/g, '&quot;')})" class="flex flex-col items-center gap-1 p-3 bg-green-50 text-green-600 rounded-2xl hover:bg-green-100 transition shadow-sm border border-green-100">
                            <i class="fab fa-whatsapp text-lg"></i>
                            <span class="text-[10px] font-black uppercase">WhatsApp (${task.guest_phone.split(',').length})</span>
                        </button>` : ''}
                    </div>
                </div>` : ''}
                
                <div class="pt-4 mt-6">
                    <button onclick="_editTask(${task.id})" class="w-full flex items-center justify-center gap-3 py-4 bg-slate-800 text-white rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95">
                        <i class="fas fa-edit"></i>
                        <span class="font-black uppercase tracking-widest text-xs">Alterar Tarefa</span>
                    </button>
                    <button onclick="closeDetails()" class="w-full mt-2 py-2 text-slate-400 text-[10px] font-bold uppercase hover:text-slate-600">Fechar Detalhes</button>
                </div>
            </div>
        `;
    }
}

function _editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Preencher o modal
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDate').value = task.date;
    document.getElementById('taskTime').value = task.time || '';
    document.getElementById('taskCategory').value = task.category_id || '';
    document.getElementById('taskImportant').checked = task.is_important === 1 || task.is_important === true;
    document.getElementById('taskRecurrence').value = task.recurrence || 'none';
    document.getElementById('taskReminder').value = task.reminder_minutes || 0;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskGuestEmail').value = task.guest_email || '';
    document.getElementById('taskGuestPhone').value = task.guest_phone || '';

    // Mudar o título do modal
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.innerText = 'Alterar Tarefa';

    // Reset UI custom
    _handleRecurrenceChange(); 

    if (task.recurrence === 'custom' && task.recurrence_config) {
        try {
            const configs = JSON.parse(task.recurrence_config);
            const list = document.getElementById('customDaysList');
            configs.forEach(conf => {
                const check = list.querySelector(`.day-check[data-day-index="${conf.dayIndex}"]`);
                if (check) {
                    check.checked = true;
                    const row = check.closest('div');
                    const timeInput = row.querySelector('.day-time');
                    if (timeInput) timeInput.value = conf.time || '';
                }
            });
        } catch (e) {
            console.error('Erro ao processar config de recorrência:', e);
        }
    }

    // Abrir o modal
    toggleModal('taskModal');
}

function toggleModal(id) {
    if (typeof PlannerUI !== 'undefined') {
        PlannerUI.toggleModal(id);
    } else {
        console.error('PlannerUI não carregado');
    }
}

async function _sendGuestInvitation(task) {
    if (!task.guest_email) return;
    
    // Suportar múltiplos e-mails separados por vírgula
    const emails = task.guest_email.split(',').map(e => e.trim()).filter(e => e);
    
    for (const email of emails) {
        try {
            await fetch(`http://localhost:3000/api/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    tasks: [{ 
                        title: task.title, 
                        category_name: task.category_name || 'Geral', 
                        date: task.date,
                        time: task.time,
                        description: task.description // Incluindo a descrição
                    }], 
                    email: email,
                    subject: `CONVITE: ${task.title}`
                })
            });
            console.log('Convite enviado para:', email);
        } catch (e) { console.error(`Erro convite para ${email}:`, e); }
    }
}

function _sendGuestWhatsApp(task) {
    if (!task.guest_phone) return;
    
    // Suportar múltiplos números separados por vírgula
    const phones = task.guest_phone.split(',').map(p => p.trim()).filter(p => p);
    const msg = `Olá! Gostaria de confirmar o compromisso: *${task.title}* no dia ${formatDate(task.date)}${task.time ? ' às ' + task.time : ''}. Detalhes: ${task.description || ''}`;

    phones.forEach(phone => {
        const cleanPhone = phone.replace(/\D/g, ''); // Limpar caracteres não numéricos
        if (cleanPhone) {
            const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
        }
    });
}

function closeDetails() {
    if (typeof PlannerUI !== 'undefined') {
        PlannerUI.closeDetails();
    } else {
        console.error('PlannerUI não carregado');
    }
}

function formatDate(dateStr) {
    if (typeof PlannerUtils !== 'undefined') {
        return PlannerUtils.formatDate(dateStr);
    }
    return dateStr;
}

// Bind events usando IDs do HTML para garantir funcionamento
document.addEventListener('DOMContentLoaded', () => {
    // Escutas de formulário já configuradas no topo do DOMContentLoaded principal
});
