function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
}

function formatFullDate(date) {
    return date.toLocaleDateString('pt-BR');
}

function getTodayISO() {
    return new Date().toISOString().split('T')[0];
}

function isTaskOnDate(task, targetDateISO) {
    const startDate = new Date(task.date + 'T00:00:00');
    const targetDate = new Date(targetDateISO + 'T00:00:00');
    
    // Nenhuma tarefa aparece antes da sua data de início
    if (targetDate < startDate) return false;

    // Se for a mesma data exata do registro original
    if (task.date === targetDateISO) return true;
    
    // Regras de recorrência baseadas no campo 'recurrence'
    const type = task.recurrence || 'none';

    if (type === 'daily') {
        return true;
    }

    if (type === 'weekdays') {
        const day = targetDate.getDay();
        return day >= 1 && day <= 5; // 1 (Segunda) a 5 (Sexta)
    }

    if (type === 'weekly') {
        const diffTime = Math.abs(targetDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays % 7 === 0;
    }

    if (type === 'custom' && task.recurrence_config) {
        try {
            const configs = JSON.parse(task.recurrence_config);
            const targetDayIndex = targetDate.getDay();
            // Verifica se o dia da semana atual (0-6) está na lista configurada
            return configs.some(conf => parseInt(conf.dayIndex) === targetDayIndex);
        } catch (e) {
            console.error('Erro ao ler config personalizada:', e);
            return false;
        }
    }
    
    // Legado: suporte ao antigo checkbox is_weekly
    if (task.is_weekly) {
        const diffTime = Math.abs(targetDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays % 7 === 0;
    }
    
    return false;
}

window.PlannerUtils = {
    formatDate,
    formatFullDate,
    getTodayISO,
    isTaskOnDate
};

