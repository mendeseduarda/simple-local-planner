function toggleModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.toggle('hidden');
        modal.classList.toggle('flex');
        
        // Lógica de reset específica para o modal de tarefa
        if (id === 'taskModal') {
            const idEl = document.getElementById('taskId');
            const modalTitle = document.querySelector('#taskModal h2');
            
            if (modal.classList.contains('flex')) {
                if (idEl && !idEl.value && modalTitle) {
                    modalTitle.innerText = 'Próximo Compromisso';
                }
            } else {
                if (idEl) idEl.value = '';
                const taskForm = document.getElementById('taskForm');
                if (taskForm) taskForm.reset();
                
                // Reset da interface de recorrência customizada
                const customUI = document.getElementById('customRecurrenceUI');
                if (customUI) customUI.classList.add('hidden');
                const customDays = document.getElementById('customDaysList');
                if (customDays) customDays.innerHTML = ''; 

                if (modalTitle) modalTitle.innerText = 'Próximo Compromisso';
            }
        }
    }
}

function closeDetails() {
    const panel = document.getElementById('taskDetailsPanel');
    if (panel) panel.classList.add('hidden');
}

window.PlannerUI = {
    toggleModal,
    closeDetails
};
