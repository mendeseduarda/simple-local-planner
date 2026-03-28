function renderCalendarGrid(calendarDate, tasks, categories, filterByDay) {
    const weeklyView = document.getElementById('weeklyView');
    const calendarHeader = document.getElementById('calendarHeader');
    const calendarNav = document.getElementById('calendarNav');
    const calendarMonthTitle = document.getElementById('calendarMonthTitle');
    const viewWeekBtn = document.getElementById('viewWeekBtn');
    const viewMonthBtn = document.getElementById('viewMonthBtn');
    if (!weeklyView) return;

    // Ajustar botões e header
    if (calendarNav) calendarNav.classList.remove('hidden');
    if (calendarHeader) {
        calendarHeader.classList.remove('hidden');
        calendarHeader.classList.add('grid');
    }
    if (calendarMonthTitle) {
        calendarMonthTitle.innerText = calendarDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    
    if (viewMonthBtn) {
        viewMonthBtn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
        viewMonthBtn.classList.remove('text-slate-500');
    }
    if (viewWeekBtn) {
        viewWeekBtn.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm');
        viewWeekBtn.classList.add('text-slate-500');
    }

    weeklyView.innerHTML = '';
    weeklyView.className = "grid grid-cols-7 gap-1 sm:gap-2";

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const nowISO = new Date().toISOString().split('T')[0];

    // Espaços vazios para o início do mês
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = "aspect-square";
        weeklyView.appendChild(empty);
    }

    // Dias do mês
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dateISO = `${year}-${String(month+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        // Usar PlannerUtils.isTaskOnDate para incluir tarefas semanais
        const dayTasks = tasks.filter(t => {
            if (t.is_completed) return false;
            if (typeof PlannerUtils !== 'undefined') {
                return PlannerUtils.isTaskOnDate(t, dateISO);
            }
            return t.date === dateISO;
        });
        
        const isToday = dateISO === nowISO;

        const dayCell = document.createElement('div');
        dayCell.onclick = () => window.filterByDay(dateISO, `${d} de ${date.toLocaleDateString('pt-BR', { month: 'long' })}`);
        dayCell.className = `aspect-square p-0.5 sm:p-2 rounded-xl border flex flex-col items-center justify-between cursor-pointer transition-all hover:border-indigo-400 hover:bg-indigo-50/30 ${isToday ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-50 bg-white'}`;

        
        dayCell.innerHTML = `
            <span class="text-[10px] sm:text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-slate-600'}">${d}</span>
            <div class="flex flex-wrap justify-center gap-0.5 max-w-full">
                ${dayTasks.map(t => {
                    const cat = categories.find(c => c.id === t.category_id);
                    return `<div class="h-1 w-1 sm:h-1 sm:w-1 rounded-full" style="background-color: ${cat?.color || '#818cf8'}"></div>`;
                }).slice(0, 4).join('')}
            </div>
        `;
        weeklyView.appendChild(dayCell);
    }
}

function renderWeeklyView(tasks, categories, filterByDay) {
    const weeklyView = document.getElementById('weeklyView');
    const calendarHeader = document.getElementById('calendarHeader');
    const calendarNav = document.getElementById('calendarNav');
    const viewWeekBtn = document.getElementById('viewWeekBtn');
    const viewMonthBtn = document.getElementById('viewMonthBtn');
    if (!weeklyView) return;

    if (calendarHeader) calendarHeader.classList.add('hidden');
    if (calendarNav) calendarNav.classList.add('hidden');
    if (viewWeekBtn) {
        viewWeekBtn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
        viewWeekBtn.classList.remove('text-slate-500');
    }
    if (viewMonthBtn) {
        viewMonthBtn.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm');
        viewMonthBtn.classList.add('text-slate-500');
    }

    weeklyView.innerHTML = '';
    const today = new Date();
    weeklyView.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3";

    for (let i = 0; i < 7; i++) {
        const day = new Date();
        day.setDate(today.getDate() + i);
        
        const dateISO = day.toISOString().split('T')[0];
        const dayName = day.toLocaleDateString('pt-BR', { weekday: 'short' });
        const dayNum = day.getDate();
        const fullDateStr = day.toLocaleDateString('pt-BR');
        const isToday = i === 0;

        // Incluir tarefas semanais na visão semanal
        const dayTasks = tasks.filter(t => {
            if (t.is_completed) return false;
            if (typeof PlannerUtils !== 'undefined') {
                return PlannerUtils.isTaskOnDate(t, dateISO);
            }
            return t.date === dateISO;
        });
        
        const dayCol = document.createElement('div');
        dayCol.onclick = () => window.filterByDay(dateISO, fullDateStr);
        dayCol.className = `flex flex-col gap-2 p-3 rounded-2xl border cursor-pointer transition-all hover:scale-105 active:scale-95 ${isToday ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200'}`;

        
        dayCol.innerHTML = `
            <div class="text-center mb-1">
                <span class="block text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-indigo-100' : 'text-slate-400'}">${dayName}</span>
                <span class="text-xl font-black ${isToday ? 'text-white' : 'text-slate-700'}">${dayNum}</span>
            </div>
            <div class="flex justify-center gap-1">
                ${dayTasks.length > 0 ? dayTasks.slice(0, 3).map(t => {
                    const cat = categories.find(c => c.id === t.category_id);
                    const dotColor = isToday ? 'white' : (cat?.color || '#818cf8');
                    return `<div class="h-1.5 w-1.5 rounded-full" style="background-color: ${dotColor}"></div>`;
                }).join('') : '<div class="h-1.5 w-4 bg-slate-100 rounded-full opacity-30"></div>'}
            </div>
        `;
        weeklyView.appendChild(dayCol);
    }
}

window.PlannerCalendar = {
    renderCalendarGrid,
    renderWeeklyView
};
